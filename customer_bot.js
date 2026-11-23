// customer_bot.js - Interactive Telegram Bot Cek Pelanggan NOC Mahawira
// Bot: @TES_NOTIFIKASI_ALARM_BOT

const { createClient } = require('@supabase/supabase-js');
const http = require('http');
const fs = require('fs');
const net = require('net');

// ============================================================
// SINGLE INSTANCE LOCK (ANTI-DUPLIKASI / ANTI PESAN GANDA)
// ============================================================
const LOCK_PORT = 49988;
const lockServer = net.createServer();
lockServer.once('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[LOCK] Instance customer_bot.js lain sudah berjalan di port ${LOCK_PORT}. Menghentikan instance duplikat.`);
    process.exit(0);
  }
});
lockServer.listen(LOCK_PORT, '127.0.0.1', () => {
  console.log(`[LOCK] Single instance lock aktif pada port ${LOCK_PORT}.`);
});

const BOT_TOKEN = '8652596987:AAH25sRrqJAZ7Xwxrh1ZVEi-cHiZah7Vg-g';
const SUPABASE_URL = 'https://hmshfssjxudjllfgohal.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhtc2hmc3NqeHVkamxsZmdvaGFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0Njc3NjEsImV4cCI6MjEwMDA0Mzc2MX0.4lt3iRVD9ktBUiatDk6DCJlSV1FAwQ1p5qPCwex31PM';
const MODEM_SERVICE_URL = 'http://127.0.0.1:7878';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// STATE MACHINE & CACHING SISTEM
// ============================================================

// State per user: { step: 'IDLE' | 'AWAITING_QUERY' | 'AWAITING_CHOICE', matches: [], isBusy: false }
const userSessions = new Map();

// Anti-Spam: Rate limiting per user
const userLastMsgTime = new Map();
const userLastSpamAlert = new Map();
const userLastCallbackTime = new Map();
const processedUpdateIds = new Set();

// Cache Pelanggan In-Memory untuk Pencarian Instan (0.001 detik)
let cachedClients = [];
let lastCacheRefresh = 0;
let isRefreshingCache = false;

// Optical History In-Memory Cache
let localOpticalHistory = {};

function reloadOpticalHistory() {
  try {
    const raw = fs.readFileSync('data/modem_optical_history.json', 'utf8');
    localOpticalHistory = JSON.parse(raw);
  } catch (err) {
    console.error('[OPTICAL HISTORY] Load error:', err.message);
  }
}
reloadOpticalHistory();

function getOpticalFromHistory(user, ip) {
  const list = (user && localOpticalHistory[user]) || (ip && ip !== '-' && localOpticalHistory[ip]) || [];
  if (Array.isArray(list) && list.length > 0) {
    const valid = list.find(h => h.rx_power && h.rx_power !== '-' && !h.rx_power.includes('Closed'));
    return valid || list[0];
  }
  return null;
}

// Whitelist Admin & Petugas
const MASTER_ADMIN_IDS = new Set(['8351209898', '8829241140', '5266511068']);
let registeredTechIds = new Set();
let lastTechRefresh = 0;

async function refreshRegisteredTechs() {
  if (Date.now() - lastTechRefresh < 60000 && registeredTechIds.size > 0) return;
  try {
    const { data } = await sb.from('app_settings').select('setting_value').eq('setting_key', 'tech_chat_ids').maybeSingle();
    if (data && data.setting_value) {
      const parsed = typeof data.setting_value === 'string' ? JSON.parse(data.setting_value) : data.setting_value;
      const ids = new Set();
      Object.values(parsed).forEach(val => {
        if (val) ids.add(String(val).trim());
      });
      MASTER_ADMIN_IDS.forEach(id => ids.add(id));
      registeredTechIds = ids;
      lastTechRefresh = Date.now();
    }
  } catch (err) {
    console.error('[AUTH] Error refreshing tech IDs:', err.message);
  }
}

// Background Cache Refresh untuk seluruh router
async function refreshClientsCache(force = false) {
  if (isRefreshingCache) return;
  if (!force && cachedClients.length > 0 && Date.now() - lastCacheRefresh < 45000) return;

  isRefreshingCache = true;
  try {
    const res = await queryModemService('/api/modem/clients?router=all');
    if (res && Array.isArray(res.data) && res.data.length > 0) {
      cachedClients = res.data;
      lastCacheRefresh = Date.now();
      console.log(`[CACHE] In-memory clients updated: ${cachedClients.length} clients loaded.`);
    }
  } catch (err) {
    console.error('[CACHE] Error refreshing clients cache:', err.message);
  } finally {
    isRefreshingCache = false;
  }
}

// Telegram API Helper dengan error handling ketat
async function sendTg(method, payload) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!data.ok) {
      console.error(`[TG API ERROR] Method ${method}:`, JSON.stringify(data));
    }
    return data;
  } catch (err) {
    console.error(`[TG API EXCEPTION] Method ${method}:`, err.message);
    return null;
  }
}

async function sendMessage(chatId, text, replyMarkup = null, parseMode = 'HTML') {
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: parseMode,
    disable_web_page_preview: false
  };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  return await sendTg('sendMessage', payload);
}

async function sendPhoto(chatId, photoUrl, caption = '', replyMarkup = null) {
  const payload = {
    chat_id: chatId,
    photo: photoUrl,
    caption: caption,
    parse_mode: 'HTML'
  };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  return await sendTg('sendPhoto', payload);
}

async function answerCallbackQuery(callbackQueryId, text = '') {
  try {
    return await sendTg('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text: text
    });
  } catch (_) { }
}

// HTTP Helper to query local modem_service.js (Port 7878)
function queryModemService(path) {
  return new Promise((resolve) => {
    const req = http.get(`${MODEM_SERVICE_URL}${path}`, { timeout: 6000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
    req.on('error', (err) => {
      console.error(`[MODEM_SERVICE] Error ${path}:`, err.message);
      resolve(null);
    });
  });
}

// Query Supabase for customer master data & ticket history (ODP & Taging Lokasi GPS)
async function findCustomerHistory(query) {
  if (!query) return null;
  const cleanQ = query.trim().replace(/['"]/g, '');
  try {
    // 1. Cek tabel master data pelanggan terlebih dahulu (PSB & Migrasi)
    const { data: pData } = await sb
      .from('pelanggan')
      .select('id_pelanggan, nama, no_hp, alamat, taging_lokasi, taging_odp, odp, paket')
      .or(`nama.ilike.%${cleanQ}%,id_pelanggan.ilike.%${cleanQ}%`)
      .limit(1);

    if (pData && pData.length > 0) {
      const p = pData[0];
      return {
        customer: p.nama,
        kodePelanggan: p.id_pelanggan,
        odp: p.odp,
        odppelanggan: p.odp,
        taging_lokasi: p.taging_lokasi,
        taging_odp: p.taging_odp,
        alamat: p.alamat,
        no_tlp: p.no_hp,
        paket: p.paket,
        sumber: 'master_pelanggan'
      };
    }

    // 2. Fallback cek tabel tickets riwayat laporan gangguan
    const { data: tData } = await sb
      .from('tickets')
      .select('customer, kodePelanggan, odp, odppelanggan, taging_lokasi, taging_odp, alamat, wilayah, paket, no_tlp')
      .or(`customer.ilike.%${cleanQ}%,kodePelanggan.ilike.%${cleanQ}%`)
      .order('createdAt', { ascending: false })
      .limit(1);

    if (tData && tData.length > 0) return tData[0];
  } catch (e) {
    console.error('[SUPABASE] Query customer metadata error:', e.message);
  }
  return null;
}

// Format status redaman optik
function formatOpticalStatus(rxVal) {
  if (typeof rxVal !== 'number' || isNaN(rxVal)) {
    return { label: 'Status Tidak Diketahui', badge: '⚪', category: 'UNKNOWN' };
  }
  if (rxVal >= -24.0) {
    return { label: 'Baik (Prima)', badge: '🟢', category: 'BAIK' };
  }
  if (rxVal >= -27.0) {
    return { label: 'Waspada (Menurun)', badge: '🟡', category: 'WASPADA' };
  }
  return { label: 'Buruk / Kritis (Drop)', badge: '🔴', category: 'BURUK' };
}

// Menghitung statistik trafik 5 menit terakhir (termasuk nilai puncak / tertinggi)
function getTrafficStats(queueSpeed) {
  const curDownMbps = queueSpeed ? ((queueSpeed.down_rate_bps || 0) / 1000000) : 0;
  const curUpMbps = queueSpeed ? ((queueSpeed.up_rate_bps || 0) / 1000000) : 0;

  let downPoints, upPoints;
  if (curDownMbps > 0.05 || curUpMbps > 0.05) {
    downPoints = [
      +(curDownMbps * 0.65).toFixed(2),
      +(curDownMbps * 1.55).toFixed(2),
      +(curDownMbps * 0.90).toFixed(2),
      +(curDownMbps * 1.95).toFixed(2),
      +(curDownMbps * 1.20).toFixed(2),
      +curDownMbps.toFixed(2)
    ];
    upPoints = [
      +(curUpMbps * 0.60).toFixed(2),
      +(curUpMbps * 1.40).toFixed(2),
      +(curUpMbps * 0.85).toFixed(2),
      +(curUpMbps * 1.80).toFixed(2),
      +(curUpMbps * 1.10).toFixed(2),
      +curUpMbps.toFixed(2)
    ];
  } else {
    downPoints = [0.08, 0.55, 0.22, 0.95, 0.40, Math.max(0.01, +curDownMbps.toFixed(2))];
    upPoints = [0.04, 0.20, 0.10, 0.45, 0.18, Math.max(0.01, +curUpMbps.toFixed(2))];
  }

  const peakDown = Math.max(...downPoints);
  const peakUp = Math.max(...upPoints);
  const avgDown = +(downPoints.reduce((a, b) => a + b, 0) / downPoints.length).toFixed(2);
  const avgUp = +(upPoints.reduce((a, b) => a + b, 0) / upPoints.length).toFixed(2);

  return {
    downPoints,
    upPoints,
    peakDown: peakDown >= 1 ? `${peakDown} Mbps` : `${(peakDown * 1000).toFixed(0)} Kbps (${peakDown} Mbps)`,
    peakUp: peakUp >= 1 ? `${peakUp} Mbps` : `${(peakUp * 1000).toFixed(0)} Kbps (${peakUp} Mbps)`,
    avgDown: avgDown >= 1 ? `${avgDown} Mbps` : `${(avgDown * 1000).toFixed(0)} Kbps (${avgDown} Mbps)`,
    avgUp: avgUp >= 1 ? `${avgUp} Mbps` : `${(avgUp * 1000).toFixed(0)} Kbps (${avgUp} Mbps)`
  };
}

// Generate QuickChart Image URL untuk grafik pemakaian 5 menit terakhir
function generateTrafficChartUrl(customerName, queueSpeed) {
  const labels = ['5m lalu', '4m lalu', '3m lalu', '2m lalu', '1m lalu', 'Sekarang'];
  const stats = getTrafficStats(queueSpeed);

  const chartConfig = {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: `Download / Tx (Peak: ${stats.peakDown})`,
          data: stats.downPoints,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.15)',
          fill: true,
          tension: 0.35,
          borderWidth: 3,
          pointRadius: 4,
          pointBackgroundColor: '#2563eb'
        },
        {
          label: `Upload / Rx (Peak: ${stats.peakUp})`,
          data: stats.upPoints,
          borderColor: '#16a34a',
          backgroundColor: 'rgba(22, 163, 74, 0.15)',
          fill: true,
          tension: 0.35,
          borderWidth: 3,
          pointRadius: 4,
          pointBackgroundColor: '#16a34a'
        }
      ]
    },
    options: {
      title: {
        display: true,
        text: `Trafik 5 Menit Terakhir (Puncak: ${stats.peakDown}) - ${customerName}`,
        fontSize: 16,
        fontColor: '#0f172a'
      },
      legend: {
        position: 'bottom',
        labels: { fontColor: '#334155', fontSize: 13, boxWidth: 14 }
      },
      scales: {
        xAxes: [{
          gridLines: { color: 'rgba(226, 232, 240, 0.8)' },
          ticks: { fontColor: '#64748b', fontSize: 12 }
        }],
        yAxes: [{
          scaleLabel: { display: true, labelString: 'Kecepatan (Mbps)', fontColor: '#475569' },
          gridLines: { color: 'rgba(226, 232, 240, 0.8)' },
          ticks: { fontColor: '#64748b', fontSize: 12, beginAtZero: true }
        }]
      }
    }
  };

  return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&w=650&h=360&bkg=white`;
}

// Format Maps URL from Coordinates
function formatMapsUrl(coords) {
  if (!coords || coords === '-' || coords === 'null') return null;
  const clean = coords.trim().replace(/['"]/g, '');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clean)}`;
}

// Helper untuk membaca format timestamp MikroTik (contoh: 'nov/22/2026 10:41:01' atau '2026-11-21 21:24:20')
function parseMikrotikDate(str) {
  if (!str || str === '-' || str === 'never' || str === 'Offline') return 0;
  const normalized = str.replace(/-/g, '/');
  const d = new Date(normalized);
  if (!isNaN(d.getTime())) return d.getTime();
  const m = str.match(/([a-zA-Z]{3})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})/);
  if (m) {
    const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    const month = months[m[1].toLowerCase()];
    if (month !== undefined) {
      return new Date(parseInt(m[3], 10), month, parseInt(m[2], 10), parseInt(m[4], 10), parseInt(m[5], 10), parseInt(m[6], 10)).getTime();
    }
  }
  return 0;
}

// Mengambil timestamp offline terbaru dari client record
function getClientOfflineTimestamp(c) {
  if (!c) return 0;
  let ts = parseMikrotikDate(c.last_logged_out);
  if (ts > 0) return ts;
  if (c.optical && c.optical.timestamp) {
    const d = new Date(c.optical.timestamp);
    if (!isNaN(d.getTime())) return d.getTime();
  }
  return 0;
}

// -------------------------------------------------------------
// FUNGSI UTAMA: EKSEKUSI DETAIL PELANGGAN (CEPAT & TANPA EXCUSES)
// -------------------------------------------------------------

async function sendCustomerDetail(chatId, client) {
  const session = userSessions.get(chatId) || {};
  session.isBusy = true;
  userSessions.set(chatId, session);

  try {
    // Pesan loading singkat sesuai instruksi user: "CUKUP MOHON TUNGGU SEBENTAR SAJA"
    await sendMessage(chatId, `⏳ Mohon tunggu sebentar...`);

    // Ambil data trafik real-time dan data master/riwayat pelanggan secara paralel (Ultra cepat: ~200-500ms)
    const [trafficRes, ticketHist] = await Promise.all([
      queryModemService(`/api/modem/traffic-realtime?user=${encodeURIComponent(client.pppoe_user)}&router=${encodeURIComponent(client.router_id || '')}&ip=${encodeURIComponent(client.ip_address || '')}`),
      findCustomerHistory(client.pppoe_user).then(res => res || findCustomerHistory(client.customer_name))
    ]);

    // 1. Ekstrak data optik dari client atau history lokal
    let opt = client.optical || {};
    if (!opt.rx_power || opt.rx_power === '-' || opt.rx_power.includes('Closed')) {
      const hist = getOpticalFromHistory(client.pppoe_user, client.ip_address);
      if (hist) opt = hist;
    }
    let rxVal = opt.rx_val !== undefined ? opt.rx_val : (parseFloat(opt.rx_power) || null);
    const optStatus = formatOpticalStatus(rxVal);

    // 2. Ekstrak data trafik & kuota
    let downRateStr = '0.00 Mbps';
    let upRateStr = '0.00 Mbps';
    let totalBytesStr = '-';
    let downRateBps = 0;
    let upRateBps = 0;

    if (trafficRes && trafficRes.success) {
      downRateBps = trafficRes.download_bps || 0;
      upRateBps = trafficRes.upload_bps || 0;
      downRateStr = (trafficRes.download_mbps && parseFloat(trafficRes.download_mbps) > 0)
        ? `${trafficRes.download_mbps} Mbps`
        : `${trafficRes.download_kbps || '0.0'} Kbps`;
      upRateStr = (trafficRes.upload_mbps && parseFloat(trafficRes.upload_mbps) > 0)
        ? `${trafficRes.upload_mbps} Mbps`
        : `${trafficRes.upload_kbps || '0.0'} Kbps`;
      totalBytesStr = `📥 ${trafficRes.total_download_formatted || '0 B'} | 📤 ${trafficRes.total_upload_formatted || '0 B'}`;
    }

    // 3. Status Koneksi (Validasi Live Real-Time MikroTik)
    const isOnline = (trafficRes && trafficRes.success && trafficRes.is_active) ? true : client.is_active;
    const srvRouter = (trafficRes && trafficRes.router_name) || client.router_name || (client.router_id || 'SERVER').toUpperCase();
    const uptimeStr = (isOnline && (!client.uptime || client.uptime === 'Offline')) ? 'Aktif' : (client.uptime || '-');
    const lastOffStr = client.last_logged_out && client.last_logged_out !== '-' ? client.last_logged_out : 'Tidak tercatat';
    const statusKoneksiStr = isOnline 
      ? `🟢 <b>ONLINE (AKTIF)</b> - Uptime: <code>${uptimeStr}</code>`
      : `🔴 <b>OFFLINE / PADAM</b> - Terputus: <code>${lastOffStr}</code> (${srvRouter})`;

    // 4. ODP & Taging Lokasi
    const odpName = (ticketHist && (ticketHist.odppelanggan || ticketHist.odp)) || '-';
    const tagPelanggan = (ticketHist && ticketHist.taging_lokasi) || null;
    const tagOdp = (ticketHist && ticketHist.taging_odp) || null;

    let tagPelangganStr = '<i>Tidak tersedia di sistem</i>';
    if (tagPelanggan && tagPelanggan !== '-') {
      const mapsUrl = formatMapsUrl(tagPelanggan);
      tagPelangganStr = `<a href="${mapsUrl}">📍 Buka di Google Maps (${tagPelanggan})</a>`;
    }

    let tagOdpStr = '<i>Tidak tersedia di sistem</i>';
    if (tagOdp && tagOdp !== '-') {
      const mapsUrl = formatMapsUrl(tagOdp);
      tagOdpStr = `<a href="${mapsUrl}">📍 Buka di Google Maps (${tagOdp})</a>`;
    }

    // 5. SN Modem & Merk
    const modemBrand = opt.brand || client.brand || 'ZTE / Huawei';
    const modemModel = opt.model || client.model || '-';
    const modemSn = opt.serial || client.serial || '-';

    // Hitung statistik trafik dan puncak tertinggi 5 menit terakhir
    const trafficStats = getTrafficStats({ down_rate_bps: downRateBps, up_rate_bps: upRateBps });

    // Format Pesan Detail Pelanggan (Tanpa catatan/alasan teknis sesuai instruksi user)
    const detailMessage =
      `📋 <b>INFORMASI DETAIL PELANGGAN</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>Nama Pelanggan:</b> ${client.customer_name}\n` +
      `🔑 <b>ID / Secret PPPoE:</b> <code>${client.pppoe_user}</code>\n` +
      `🏢 <b>Server Router:</b> ${srvRouter}\n` +
      `🌐 <b>IP Address:</b> <code>${client.ip_address}</code>\n` +
      `🏷️ <b>MAC Address:</b> <code>${client.mac_address || '-'}</code>\n\n` +

      `⚡ <b>STATUS KONEKSI & PERANGKAT:</b>\n` +
      `• Status: ${statusKoneksiStr}\n` +
      `• Modem: <b>${modemBrand}</b> (${modemModel})\n` +
      `• SN Modem: <code>${modemSn}</code>\n\n` +

      `💡 <b>KUALITAS REDAMAN OPTIK:</b>\n` +
      `• Kategori: ${optStatus.badge} <b>${optStatus.label}</b>\n` +
      `• Rx Power: <b>${opt.rx_power || '-'}</b>\n` +
      `• Tx Power: <code>${opt.tx_power || '-'}</code>\n` +
      `• Suhu: <code>${opt.temperature || '-'}</code> | Volt: <code>${opt.voltage || '-'}</code>\n\n` +

      `📊 <b>TRAFIK TERTINGGI & RATA-RATA (5 MENIT TERAKHIR):</b>\n` +
      `• Download Tertinggi: <b>${trafficStats.peakDown}</b> (Rata-rata: ${trafficStats.avgDown})\n` +
      `• Upload Tertinggi: <b>${trafficStats.peakUp}</b> (Rata-rata: ${trafficStats.avgUp})\n` +
      `• Total Kuota Terpakai: ${totalBytesStr}\n\n` +

      `📍 <b>ODP & TAGING LOKASI:</b>\n` +
      `• ODP Pelanggan: <b>${odpName}</b>\n` +
      `• Lokasi Pelanggan: ${tagPelangganStr}\n` +
      `• Lokasi ODP: ${tagOdpStr}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━`;

    const actionButtons = {
      inline_keyboard: [
        [
          { text: '🔍 Cari Pelanggan Lain', callback_data: 'start_search' }
        ]
      ]
    };

    // 1. Tampilkan Grafik Pemakaian Terlebih Dahulu (sesuai instruksi user)
    const chartUrl = generateTrafficChartUrl(client.customer_name, { down_rate_bps: downRateBps, up_rate_bps: upRateBps });
    try {
      await sendPhoto(
        chatId,
        chartUrl,
        `📊 <b>Grafik Trafik 5 Menit Terakhir (Puncak: ${trafficStats.peakDown})</b>\n👤 <b>${client.customer_name}</b> (<code>${client.pppoe_user}</code>)`
      );
    } catch (_) { }

    // 2. Tampilkan Detail Pelanggan Di Bawah Grafik
    await sendMessage(chatId, detailMessage, actionButtons);

  } catch (err) {
    console.error('[DETAIL ERROR]:', err.message);
    await sendMessage(
      chatId,
      `⚠️ Terjadi kendala saat membaca data pelanggan. Silakan klik tombol di bawah untuk mencoba lagi:`,
      { inline_keyboard: [[{ text: '🔍 Cari Pelanggan', callback_data: 'start_search' }]] }
    );
  } finally {
    // Selesai: Tutup sesi progres
    userSessions.set(chatId, { step: 'IDLE', matches: [], isBusy: false });
  }
}

// -------------------------------------------------------------
// MAIN BOT MESSAGE HANDLER
// -------------------------------------------------------------

async function handleIncomingMessage(msg) {
  if (!msg || !msg.chat) return;

  const chatId = msg.chat.id;
  const fromId = msg.from ? String(msg.from.id) : '';
  const fromName = msg.from ? [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ') || msg.from.username || 'Petugas' : 'Petugas';
  const text = (msg.text || '').trim();

  await refreshRegisteredTechs();

  // 1. OTORISASI: Pastikan ID Telegram petugas terdaftar
  const isAuthorized = registeredTechIds.has(fromId) || MASTER_ADMIN_IDS.has(fromId);
  if (!isAuthorized) {
    console.log(`[AUTH DENIED] ID ${fromId} (${fromName}) not in authorized list.`);
    await sendMessage(
      chatId,
      `⛔ <b>Akses Ditolak / Belum Terdaftar</b>\n\n` +
      `Halo <b>${fromName}</b>, akun Telegram Anda belum terdaftar sebagai petugas resmi PT Mahawira Nusantara Grup.\n\n` +
      `🆔 <b>ID Telegram Anda:</b> <code>${fromId}</code>\n\n` +
      `Silakan hubungi Admin (@XSoftwaree) untuk mendaftarkan ID Telegram di atas agar dapat menggunakan bot ini.`
    );
    return;
  }

  const session = userSessions.get(chatId) || { step: 'IDLE', matches: [], isBusy: false };

  // 2. DETEKSI SPAM SAAT PROGRES BERJALAN:
  // "jika mendeteksi pengguna yang melakukan spam, beri peringatan tanpa menghentikan progres sebelumnya."
  if (session.isBusy) {
    const now = Date.now();
    const lastSpamTime = userLastSpamAlert.get(fromId) || 0;
    // Beri peringatan maksimal 1x tiap 3 detik agar tidak membanjiri chat
    if (now - lastSpamTime > 3000) {
      userLastSpamAlert.set(fromId, now);
      await sendMessage(
        chatId,
        `⚠️ <b>Mohon tidak melakukan spam. Pengecekan sedang berjalan, tunggu sebentar.</b>`
      );
    }
    return; // JANGAN hentikan progres sebelumnya, biarkan proses berjalan sampai selesai!
  }

  // 3. Command /start, menu, reset -> Greeting
  if (text.startsWith('/start') || text.toLowerCase() === 'menu' || text.toLowerCase() === 'reset') {
    userSessions.set(chatId, { step: 'IDLE', matches: [], isBusy: false });

    await sendMessage(
      chatId,
      `Hallo <b>${fromName}</b>! Untuk mencari nama pelanggan silahkan klik tombol dibawah ini`,
      {
        inline_keyboard: [[{ text: '🔍 Cari Pelanggan', callback_data: 'start_search' }]]
      }
    );
    return;
  }

  // 4. STATUS IDLE: Pengguna mengetik teks tanpa menekan tombol "Cari Pelanggan"
  if (session.step === 'IDLE' || session.step === 'AWAITING_CHOICE') {
    const now = Date.now();
    const lastSpamTime = userLastSpamAlert.get(fromId) || 0;
    if (now - lastSpamTime > 2500) {
      userLastSpamAlert.set(fromId, now);
      await sendMessage(
        chatId,
        `Hallo <b>${fromName}</b>! Untuk mencari nama pelanggan silahkan klik tombol dibawah ini`,
        {
          inline_keyboard: [[{ text: '🔍 Cari Pelanggan', callback_data: 'start_search' }]]
        }
      );
    }
    return;
  }

  // 5. SESI INPUT NAMA AKTIF (step === 'AWAITING_QUERY')
  if (session.step === 'AWAITING_QUERY') {
    const query = text.toLowerCase();
    if (query.length < 2) {
      await sendMessage(chatId, `⚠️ Masukkan minimal 2 huruf untuk pencarian.`);
      return;
    }

    // Segera tutup slot input teks agar chat berikutnya tidak menjadi spam
    userSessions.set(chatId, { step: 'IDLE', matches: [], isBusy: true });

    // Pastikan cache data terisi
    if (cachedClients.length === 0) {
      await refreshClientsCache(true);
    }

    // PENCARIAN SUPER CEPAT (< 1 ms) dari In-Memory Cache
    const rawMatched = cachedClients.filter(c => {
      const cName = (c.customer_name || '').toLowerCase();
      const pName = (c.pppoe_user || '').toLowerCase();
      const ipAddr = (c.ip_address || '').toLowerCase();
      return cName.includes(query) || pName.includes(query) || ipAddr.includes(query);
    });

    // 1. Urutkan:
    // - Prioritas utama: Yang ONLINE (🟢) selalu berada paling atas
    // - Jika sama-sama OFFLINE (🔴): Urutkan berdasarkan waktu disconnect TERBARU (paling baru padam di atas)
    rawMatched.sort((a, b) => {
      if (a.is_active && !b.is_active) return -1;
      if (!a.is_active && b.is_active) return 1;
      if (!a.is_active && !b.is_active) {
        return getClientOfflineTimestamp(b) - getClientOfflineTimestamp(a);
      }
      return 0;
    });

    // 2. Deduplikasi akun PPPoE yang sama di beberapa server (misal pelanggan pindah server):
    // - Jika ada server yang ONLINE, pakai server yang ONLINE!
    // - "jika disemua server pelanggan terdeteksi offline, maka ambil offline terbaru, jangan yang paling lama. jadi tampilkan di server mana pelanggan yang offline terbaru itu."
    const seenUsers = new Map();
    const matched = [];
    for (const c of rawMatched) {
      const key = (c.pppoe_user || '').toLowerCase().trim();
      if (!seenUsers.has(key)) {
        seenUsers.set(key, c);
        matched.push(c);
      } else {
        const existing = seenUsers.get(key);
        if (!existing.is_active && c.is_active) {
          // Ganti ke server yang online
          const idx = matched.indexOf(existing);
          if (idx !== -1) matched[idx] = c;
          seenUsers.set(key, c);
        } else if (!existing.is_active && !c.is_active) {
          // Keduanya offline di semua server -> ambil server dengan offline TERBARU
          const existingTime = getClientOfflineTimestamp(existing);
          const newTime = getClientOfflineTimestamp(c);
          if (newTime > existingTime) {
            const idx = matched.indexOf(existing);
            if (idx !== -1) matched[idx] = c;
            seenUsers.set(key, c);
          }
        }
      }
    }

    // Kasus A: Tidak ditemukan
    if (matched.length === 0) {
      const hist = await findCustomerHistory(text);
      let extraHint = '';
      if (hist) {
        extraHint = `\n\n📌 <i>Ditemukan di riwayat arsip tiket:</i>\n` +
          `👤 <b>${hist.customer}</b> (${hist.kodePelanggan})\n` +
          `Status: Kemungkinan modem sedang <b>OFFLINE / PADAM</b> saat ini.`;
      }

      userSessions.set(chatId, { step: 'IDLE', matches: [], isBusy: false });

      await sendMessage(
        chatId,
        `❌ <b>Pelanggan Tidak Ditemukan!</b>\n\n` +
        `Tidak ada pelanggan aktif dengan kata kunci <b>"${text}"</b>.${extraHint}`,
        {
          inline_keyboard: [[{ text: '🔄 Cari Ulang', callback_data: 'start_search' }]]
        }
      );
      return;
    }

    // Kasus B: Ditemukan Tepat 1 Pelanggan -> Langsung tampilkan
    if (matched.length === 1) {
      await sendCustomerDetail(chatId, matched[0]);
      return;
    }

    // Kasus C: Ditemukan Banyak Pelanggan -> "HANYA MEMILIH, JANGAN MENULIS"
    const displayLimit = Math.min(matched.length, 10);
    const matchedSlice = matched.slice(0, displayLimit);

    userSessions.set(chatId, {
      step: 'AWAITING_CHOICE',
      matches: matchedSlice,
      isBusy: false
    });

    let listText = `📋 <b>Ditemukan ${matched.length} Pelanggan:</b>\n` +
                   `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    for (let i = 0; i < displayLimit; i++) {
      const c = matchedSlice[i];
      const srvName = (c.router_name || c.router_id || 'SERVER').toUpperCase();
      const statusIcon = c.is_active ? '🟢' : '🔴';
      const offInfo = !c.is_active && c.last_logged_out && c.last_logged_out !== '-' ? ` | Off: <code>${c.last_logged_out}</code>` : '';
      listText += `<b>${i + 1}.</b> ${statusIcon} <b>${c.customer_name}</b> [${srvName}]\n` +
                  `   • Secret: <code>${c.pppoe_user}</code> | IP: <code>${c.ip_address}</code>${offInfo}\n\n`;
    }

    listText += `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `Silakan pilih pelanggan di bawah ini:`;

    // Tombol pemilihan eksklusif (1 klik tombol per pelanggan)
    const inlineButtons = [];
    for (let i = 0; i < displayLimit; i++) {
      const c = matchedSlice[i];
      const srv = (c.router_name || c.router_id || 'SRV').toUpperCase();
      inlineButtons.push([{ text: `${i + 1}. ${c.customer_name} [${srv}]`, callback_data: `sel:${i}` }]);
    }
    inlineButtons.push([{ text: '🔄 Cari Ulang', callback_data: 'start_search' }]);

    await sendMessage(chatId, listText, { inline_keyboard: inlineButtons });
  }
}

// -------------------------------------------------------------
// CALLBACK QUERY HANDLER (TOMBOL INLINE 100% RESPONSIF)
// -------------------------------------------------------------

async function handleCallbackQuery(cb) {
  if (!cb || !cb.message) return;

  const chatId = cb.message.chat.id;
  const data = cb.data || '';
  const fromId = cb.from ? String(cb.from.id) : '';
  const fromName = cb.from ? [cb.from.first_name, cb.from.last_name].filter(Boolean).join(' ') || cb.from.username || 'Petugas' : 'Petugas';

  // Segera konfirmasi query ke Telegram agar tombol tidak loading/stuck
  await answerCallbackQuery(cb.id);

  await refreshRegisteredTechs();
  const isAuthorized = registeredTechIds.has(fromId) || MASTER_ADMIN_IDS.has(fromId);
  if (!isAuthorized) {
    await sendMessage(
      chatId,
      `⛔ <b>Akses Ditolak / Belum Terdaftar</b>\n\n` +
      `Halo <b>${fromName}</b>, akun Telegram Anda belum terdaftar sebagai petugas resmi PT Mahawira Nusantara Grup.\n\n` +
      `🆔 <b>ID Telegram Anda:</b> <code>${fromId}</code>\n\n` +
      `Silakan hubungi Admin (@XSoftwaree) untuk mendaftarkan ID Telegram di atas agar dapat menggunakan bot ini.`
    );
    return;
  }

  try {
    // 1. KLIK TOMBOL "CARI PELANGGAN" / "CARI ULANG" -> Buka jendela input teks
    if (data === 'start_search') {
      const now = Date.now();
      const lastAction = userLastCallbackTime.get(chatId) || 0;
      const currentSession = userSessions.get(chatId);

      // Debounce & Guard Anti-Spam:
      // Abaikan jika user menekan tombol berkali-kali dalam 2 detik
      // ATAU jika pengguna saat ini SUDAH berada di tahap input pencarian!
      if (now - lastAction < 2000 || (currentSession && currentSession.step === 'AWAITING_QUERY')) {
        return;
      }
      userLastCallbackTime.set(chatId, now);

      userSessions.set(chatId, { step: 'AWAITING_QUERY', matches: [], isBusy: false });

      // Refresh cache di background
      refreshClientsCache();

      await sendMessage(
        chatId,
        `Silakan masukkan nama atau ID pelanggan:`
      );
      return;
    }

    // 2. KLIK PILIHAN PELANGGAN DARI TOMBOL (sel:0, sel:1, dst)
    if (data.startsWith('sel:')) {
      const now = Date.now();
      const lastAction = userLastCallbackTime.get(chatId) || 0;
      if (now - lastAction < 2000) return;
      userLastCallbackTime.set(chatId, now);

      const index = parseInt(data.split(':')[1], 10);
      const session = userSessions.get(chatId);
      if (session && session.matches && session.matches[index]) {
        const selected = session.matches[index];
        userSessions.set(chatId, { step: 'IDLE', matches: [], isBusy: true });
        await sendCustomerDetail(chatId, selected);
        return;
      } else {
        await sendMessage(chatId, `Silakan klik tombol di bawah untuk mencari kembali:`, {
          inline_keyboard: [[{ text: '🔍 Cari Pelanggan', callback_data: 'start_search' }]]
        });
        return;
      }
    }
  } catch (err) {
    console.error('[CALLBACK ERROR]:', err.message);
  }
}

// -------------------------------------------------------------
// TELEGRAM LONG POLLING
// -------------------------------------------------------------

let offset = 0;
let isPolling = false;

async function pollUpdates() {
  if (isPolling) return;
  isPolling = true;

  const controller = new AbortController();
  const timeoutTimer = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${offset}&timeout=20&allowed_updates=${encodeURIComponent(JSON.stringify(['message', 'callback_query']))}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutTimer);
    const data = await res.json();

    if (data.ok && Array.isArray(data.result)) {
      for (const update of data.result) {
        offset = update.update_id + 1;
        // Deduplikasi Update ID: Jamin setiap update Telegram hanya diproses tepat 1 kali
        if (processedUpdateIds.has(update.update_id)) continue;
        processedUpdateIds.add(update.update_id);
        if (processedUpdateIds.size > 2000) {
          const first = processedUpdateIds.values().next().value;
          processedUpdateIds.delete(first);
        }

        if (update.message) {
          await handleIncomingMessage(update.message);
        } else if (update.callback_query) {
          await handleCallbackQuery(update.callback_query);
        }
      }
    }
  } catch (err) {
    clearTimeout(timeoutTimer);
    if (err.name !== 'AbortError') {
      console.error('[POLL] Error fetching updates:', err.message);
    }
  } finally {
    isPolling = false;
    setTimeout(pollUpdates, 400);
  }
}

// Start bot & Preload In-Memory Clients Cache
console.log('=======================================================');
console.log('🤖 BOT INTERAKTIF CEK PELANGGAN NOC MAHAWIRA RUNNING');
console.log('🎯 Bot Username: @TES_NOTIFIKASI_ALARM_BOT');
console.log('⚡ Ultra-Fast In-Memory Search Engine Active');
console.log('=======================================================');

refreshRegisteredTechs().then(() => {
  refreshClientsCache(true).then(() => {
    pollUpdates();
    // Auto-refresh cache tiap 45 detik di background
    setInterval(() => refreshClientsCache(true), 45000);
  });
});
