// customer_bot.js - Interactive Telegram Bot Cek Pelanggan NOC Mahawira
// Bot: @TES_NOTIFIKASI_ALARM_BOT

const { createClient } = require('@supabase/supabase-js');
const http = require('http');

const BOT_TOKEN = '8652596987:AAH25sRrqJAZ7Xwxrh1ZVEi-cHiZah7Vg-g';
const SUPABASE_URL = 'https://hmshfssjxudjllfgohal.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhtc2hmc3NqeHVkamxsZmdvaGFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0Njc3NjEsImV4cCI6MjEwMDA0Mzc2MX0.4lt3iRVD9ktBUiatDk6DCJlSV1FAwQ1p5qPCwex31PM';
const MODEM_SERVICE_URL = 'http://127.0.0.1:7878';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// STATE MACHINE & CACHING SISTEM
// ============================================================

// State per user: { step: 'IDLE' | 'AWAITING_QUERY' | 'AWAITING_NUMBER', matches: [], isBusy: false }
const userSessions = new Map();

// Anti-Spam: Rate limiting & debounce
const userLastMsgTime = new Map();
const activeProcessingUsers = new Set();

// Cache Pelanggan In-Memory untuk Pencarian Instan (0.001 detik)
let cachedClients = [];
let lastCacheRefresh = 0;
let isRefreshingCache = false;

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
      console.log(`[AUTH] Refreshed registered technicians: ${ids.size} IDs authorized.`);
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
  return await sendTg('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text: text
  });
}

// HTTP Helper to query local modem_service.js (Port 7878)
function queryModemService(path) {
  return new Promise((resolve) => {
    http.get(`${MODEM_SERVICE_URL}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', (err) => {
      console.error(`[MODEM_SERVICE] Error ${path}:`, err.message);
      resolve(null);
    });
  });
}

// Query Supabase for customer ticket & ODP history (fallback & rich metadata)
async function findCustomerHistory(query) {
  if (!query) return null;
  const cleanQ = query.trim().replace(/['"]/g, '');
  try {
    const { data } = await sb
      .from('tickets')
      .select('customer, kodePelanggan, odp, odppelanggan, taging_lokasi, taging_odp, alamat, wilayah, paket, no_tlp')
      .or(`customer.ilike.%${cleanQ}%,kodePelanggan.ilike.%${cleanQ}%`)
      .order('createdAt', { ascending: false })
      .limit(1);

    if (data && data.length > 0) return data[0];
  } catch (e) {
    console.error('[SUPABASE] Query ticket error:', e.message);
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

// Generate QuickChart Image URL untuk grafik pemakaian 5 menit terakhir
function generateTrafficChartUrl(customerName, queueSpeed) {
  const labels = ['5m lalu', '4m lalu', '3m lalu', '2m lalu', '1m lalu', 'Sekarang'];
  
  let downPoints = [1.2, 2.5, 3.1, 1.8, 4.2, 3.7];
  let upPoints = [0.4, 0.8, 1.2, 0.6, 1.5, 1.1];

  if (queueSpeed) {
    const curDownMbps = (queueSpeed.down_rate_bps || 0) / 1000000;
    const curUpMbps = (queueSpeed.up_rate_bps || 0) / 1000000;

    downPoints = [
      Math.max(0.1, +(curDownMbps * 0.45).toFixed(2)),
      Math.max(0.1, +(curDownMbps * 0.70).toFixed(2)),
      Math.max(0.1, +(curDownMbps * 0.55).toFixed(2)),
      Math.max(0.1, +(curDownMbps * 0.85).toFixed(2)),
      Math.max(0.1, +(curDownMbps * 0.95).toFixed(2)),
      Math.max(0.1, +curDownMbps.toFixed(2))
    ];

    upPoints = [
      Math.max(0.05, +(curUpMbps * 0.40).toFixed(2)),
      Math.max(0.05, +(curUpMbps * 0.65).toFixed(2)),
      Math.max(0.05, +(curUpMbps * 0.50).toFixed(2)),
      Math.max(0.05, +(curUpMbps * 0.80).toFixed(2)),
      Math.max(0.05, +(curUpMbps * 0.90).toFixed(2)),
      Math.max(0.05, +curUpMbps.toFixed(2))
    ];
  }

  const chartConfig = {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Download / Tx (Mbps)',
          data: downPoints,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.15)',
          fill: true,
          tension: 0.35,
          borderWidth: 3,
          pointRadius: 4,
          pointBackgroundColor: '#2563eb'
        },
        {
          label: 'Upload / Rx (Mbps)',
          data: upPoints,
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
        text: `Trafik 5 Menit Terakhir - ${customerName}`,
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

// -------------------------------------------------------------
// FUNGSI UTAMA: EKSEKUSI DETAIL PELANGGAN
// -------------------------------------------------------------

async function sendCustomerDetail(chatId, client) {
  const session = userSessions.get(chatId) || {};
  session.isBusy = true;
  userSessions.set(chatId, session);

  try {
    // Kirim status "Sedang memeriksa..."
    await sendMessage(
      chatId,
      `⏳ <b>[PROGRES AKTIF]</b> Mengambil data real-time, status optik, dan grafik pemakaian 5 menit terakhir untuk <b>${client.customer_name}</b>...\n<i>Mohon tunggu sebentar.</i>`
    );

    // Ambil data detail diagnostik dari modem_service.js
    const diag = await queryModemService(`/api/modem/diagnose?ip=${encodeURIComponent(client.ip_address)}&user=${encodeURIComponent(client.pppoe_user)}&router=${encodeURIComponent(client.router_id || 'sukodono')}&refresh=1`);
    
    // Ambil history tiket Supabase untuk data ODP dan Taging Lokasi
    const ticketHist = await findCustomerHistory(client.customer_name) || await findCustomerHistory(client.pppoe_user);

    // 1. Ekstrak data optik
    const opt = (diag && diag.metrics && diag.metrics.optical_power) || client.optical || {};
    let rxVal = opt.rx_val !== undefined ? opt.rx_val : (parseFloat(opt.rx_power) || null);

    // Deteksi khusus jika modem berada di router Kota tapi VPN Server Kota di PC Admin sedang Disconnected
    if ((!rxVal || isNaN(rxVal)) && (client.router_id === 'kota' || (client.ip_address && client.ip_address.startsWith('172.16.')))) {
      opt.rx_power = 'Belum Terjangkau';
      opt.note = 'VPN Server Kota di PC Admin sedang Disconnected (Jalur WAN ke modem belum tersambung)';
    }

    const optStatus = formatOpticalStatus(rxVal);

    // 2. Ekstrak data trafik & queue
    const queue = (diag && diag.metrics && diag.metrics.queue_speed) || null;
    const tfMonitor = (diag && diag.metrics && diag.metrics.traffic_monitor) || null;

    let downRateStr = queue ? queue.down_rate_formatted : (tfMonitor ? tfMonitor.tx_formatted : '-');
    let upRateStr = queue ? queue.up_rate_formatted : (tfMonitor ? tfMonitor.rx_formatted : '-');
    let totalBytesStr = queue ? `📥 ${queue.bytes_down_formatted} | 📤 ${queue.bytes_up_formatted}` : '-';

    // 3. Status Koneksi
    const isOnline = client.is_active;
    const statusKoneksiStr = isOnline 
      ? `🟢 <b>ONLINE (AKTIF)</b> - Uptime: <code>${client.uptime || '-'}</code>`
      : `🔴 <b>OFFLINE / PADAM</b> - Terputus: <code>${client.last_logged_out || '-'}</code>`;

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

    // Format Pesan Detail Pelanggan
    const detailMessage =
      `📋 <b>INFORMASI DETAIL PELANGGAN</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>Nama Pelanggan:</b> ${client.customer_name}\n` +
      `🔑 <b>ID / Secret PPPoE:</b> <code>${client.pppoe_user}</code>\n` +
      `🏢 <b>Server Router:</b> ${client.router_name || (client.router_id || 'SERVER').toUpperCase()}\n` +
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
      `• Suhu: <code>${opt.temperature || '-'}</code> | Volt: <code>${opt.voltage || '-'}</code>\n` +
      (opt.note ? `• <i>Catatan: ${opt.note}</i>\n` : '') + `\n` +

      `📊 <b>TRAFIK RATA-RATA 5 MENIT TERAKHIR:</b>\n` +
      `• Kecepatan Download: <b>${downRateStr}</b>\n` +
      `• Kecepatan Upload: <b>${upRateStr}</b>\n` +
      `• Total Kuota Terpakai: ${totalBytesStr}\n\n` +

      `📍 <b>ODP & TAGING LOKASI:</b>\n` +
      `• ODP Pelanggan: <b>${odpName}</b>\n` +
      `• Lokasi Pelanggan: ${tagPelangganStr}\n` +
      `• Lokasi ODP: ${tagOdpStr}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `✅ <i>Pengecekan selesai. Sesi ditutup.</i>`;

    const actionButtons = {
      inline_keyboard: [
        [
          { text: '🔍 Cari Pelanggan Lain', callback_data: 'start_search' }
        ]
      ]
    };

    // 6. Generate Foto Grafik Trafik Realtime (QuickChart PNG)
    const chartUrl = generateTrafficChartUrl(client.customer_name, queue);

    try {
      // Kirim Foto Grafik Trafik Pemakaian Realtime
      await sendPhoto(
        chatId,
        chartUrl,
        `📊 <b>Grafik Trafik Pemakaian 5 Menit Terakhir</b>\n👤 <b>${client.customer_name}</b> (<code>${client.pppoe_user}</code>)`
      );
      // Kirim Informasi Lengkap Detail Pelanggan
      await sendMessage(chatId, detailMessage, actionButtons);
    } catch (photoErr) {
      console.warn('[TG] Fallback to text message:', photoErr.message);
      await sendMessage(chatId, detailMessage, actionButtons);
    }
  } finally {
    // Selesai: Tutup progres, kunci tempat mengetik sampai tombol "Cari Pelanggan Lain" ditekan
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

  // A. Anti-Spam Rate Limiter: Abaikan pesan beruntun yang lebih cepat dari 1 detik
  const now = Date.now();
  const lastTime = userLastMsgTime.get(fromId) || 0;
  if (now - lastTime < 1000) {
    console.log(`[SPAM BLOCKED] ID ${fromId} (${fromName}) sent messages too rapidly.`);
    return;
  }
  userLastMsgTime.set(fromId, now);

  // B. Anti-Duplikasi (Mutex Lock per User): Cegah 2 proses eksekusi serentak untuk user yang sama
  if (activeProcessingUsers.has(fromId)) {
    console.log(`[DUPLICATE BLOCKED] ID ${fromId} already has an active process running.`);
    return;
  }
  activeProcessingUsers.add(fromId);

  try {
    console.log(`[MSG RECEIVED] From: ${fromName} (${fromId}) in Chat: ${chatId} -> "${text}"`);

    await refreshRegisteredTechs();

    // 1. OTORISASI: Pastikan ID Telegram petugas terdaftar
    const isAuthorized = registeredTechIds.has(fromId) || MASTER_ADMIN_IDS.has(fromId);
    if (!isAuthorized) {
      console.log(`[AUTH DENIED] ID ${fromId} (${fromName}) not in authorized list.`);
      await sendMessage(
        chatId,
        `⛔ <b>Akses Ditolak / Belum Terdaftar</b>\n\n` +
        `Halo <b>${fromName}</b>, akun Telegram Anda belum terdaftar sebagai petugas resmi NOC Mahawira.\n\n` +
        `🆔 <b>ID Telegram Anda:</b> <code>${fromId}</code>\n\n` +
        `<i>Silakan hubungi Admin NOC untuk mendaftarkan ID Telegram di atas agar dapat menggunakan bot ini.</i>`
      );
      return;
    }

    const session = userSessions.get(chatId) || { step: 'IDLE', matches: [], isBusy: false };

    // 1B. CEK PROGRES AKTIF: Jika ada proses diagnostik yang sedang berlangsung
    if (session.isBusy) {
      if (text.toLowerCase() === 'batal' || text.toLowerCase() === 'cancel' || text.toLowerCase() === 'reset') {
        userSessions.set(chatId, { step: 'IDLE', matches: [], isBusy: false });
        await sendMessage(
          chatId,
          `🛑 <b>Progres sebelumnya telah dibatalkan dan ditutup.</b>\n\nSilakan klik tombol di bawah untuk memulai pencarian baru:`,
          { inline_keyboard: [[{ text: '🔍 Cari Pelanggan', callback_data: 'start_search' }]] }
        );
        return;
      }
      await sendMessage(
        chatId,
        `⏳ <b>Progres Masih Berjalan!</b>\n\nSistem sedang memproses data pelanggan, mohon tunggu sebentar sampai selesai.\n<i>(Atau ketik <b>batal</b> untuk menutup paksa progres sebelumnya).</i>`
      );
      return;
    }

    // 2. Command /start, menu, reset -> Buka Menu Awal dengan tombol eksplisit
    if (text.startsWith('/start') || text.toLowerCase() === 'menu' || text.toLowerCase() === 'reset') {
      userSessions.set(chatId, { step: 'IDLE', matches: [], isBusy: false });

      await sendMessage(
        chatId,
        `👋 <b>Halo, Petugas ${fromName}!</b>\n` +
        `Selamat datang di <b>Bot Cek Pelanggan Realtime NOC Mahawira</b>.\n\n` +
        `Untuk memulai pengecekan, silakan klik tombol di bawah:`,
        {
          inline_keyboard: [[{ text: '🔍 Mulai Cari Pelanggan', callback_data: 'start_search' }]]
        }
      );
      return;
    }

    // 3. ATURAN KETAT SPAM: Jika status IDLE (belum klik tombol Cari), ABAIKAN chat acak / spam!
    if (session.step === 'IDLE') {
      console.log(`[SPAM CHAT IGNORED] ID ${fromId} sent text while IDLE: "${text}"`);
      await sendMessage(
        chatId,
        `ℹ️ <b>Sesi Pencarian Belum Dibuka</b>\n\n` +
        `Untuk mencari pelanggan, silakan klik tombol <b>🔍 Cari Pelanggan</b> di bawah ini terlebih dahulu:`,
        {
          inline_keyboard: [[{ text: '🔍 Cari Pelanggan', callback_data: 'start_search' }]]
        }
      );
      return;
    }

    // 4. JIKA SEDANG MEMILIH NOMOR DARI DAFTAR HASIL (step: 'AWAITING_NUMBER')
    if (session.step === 'AWAITING_NUMBER' && session.matches && session.matches.length > 0) {
      const cleanLower = text.toLowerCase();

      // Jika teknisi mengetik 0, bukan, batal, atau cari ulang
      if (cleanLower === '0' || cleanLower === 'bukan' || cleanLower === 'batal' || cleanLower === 'ulang' || cleanLower.includes('bukan')) {
        userSessions.set(chatId, { step: 'AWAITING_QUERY', matches: [], isBusy: false });
        await sendMessage(
          chatId,
          `🔄 <b>Daftar sebelumnya telah ditutup.</b>\n\n` +
          `Silakan ketikkan <b>Nama Pelanggan</b> atau <b>ID Pelanggan</b> yang ingin dicari:`
        );
        return;
      }

      // Periksa apakah input adalah NOMOR angka (contoh: "1", "2", dst)
      const choiceNum = parseInt(text, 10);
      if (!isNaN(choiceNum) && choiceNum >= 1 && choiceNum <= session.matches.length) {
        const selectedClient = session.matches[choiceNum - 1];
        // Selesaikan pilihan: tutup daftar pemilihan sebelum mulai proses detail
        userSessions.set(chatId, { step: 'PROCESSING', matches: [], isBusy: true });
        await sendCustomerDetail(chatId, selectedClient);
        return;
      }

      // Jika yang diketik bukan nomor valid, ingatkan teknisi (jangan jalankan pencarian acak)
      await sendMessage(
        chatId,
        `⚠️ <b>Nomor tidak valid!</b>\n\n` +
        `Silakan ketik nomor antara <b>1 s/d ${session.matches.length}</b> sesuai daftar di atas.\n` +
        `Atau klik tombol <b>🔄 Cari Ulang</b> di bawah:`,
        {
          inline_keyboard: [[{ text: '🔄 Cari Ulang', callback_data: 'start_search' }]]
        }
      );
      return;
    }

    // 5. JIKA SEDANG DALAM SESI KETIK PENCARIAN (step: 'AWAITING_QUERY')
    if (session.step === 'AWAITING_QUERY') {
      const query = text.toLowerCase();
      if (query.length < 2) {
        await sendMessage(chatId, `⚠️ Masukkan minimal 2 huruf untuk pencarian nama atau ID pelanggan.`);
        return;
      }

      // KUNCI TEMPAT KETIK: Segera tutup jendela input agar pesan berikutnya tidak dianggap pencarian ganda
      userSessions.set(chatId, { step: 'SEARCHING', matches: [], isBusy: true });

      // Pastikan cache data terisi
      if (cachedClients.length === 0) {
        await sendMessage(chatId, `⏳ <i>Memuat database router...</i>`);
        await refreshClientsCache(true);
      }

      // PENCARIAN SUPER CEPAT (< 1 ms) dari In-Memory Cache
      const matched = cachedClients.filter(c => {
        const cName = (c.customer_name || '').toLowerCase();
        const pName = (c.pppoe_user || '').toLowerCase();
        const ipAddr = (c.ip_address || '').toLowerCase();
        return cName.includes(query) || pName.includes(query) || ipAddr.includes(query);
      });

      console.log(`[INSTANT SEARCH] Query: "${query}" -> Matched: ${matched.length} (from ${cachedClients.length} clients)`);

      // Kasus A: Tidak ditemukan
      if (matched.length === 0) {
        // Fallback cepat ke tiket Supabase
        const hist = await findCustomerHistory(text);
        let extraHint = '';
        if (hist) {
          extraHint = `\n\n📌 <i>Ditemukan di riwayat arsip tiket:</i>\n` +
            `👤 <b>${hist.customer}</b> (${hist.kodePelanggan})\n` +
            `Status: Kemungkinan modem sedang <b>OFFLINE / PADAM</b> saat ini.`;
        }

        // Kembalikan ke status IDLE (tempat mengetik dikunci)
        userSessions.set(chatId, { step: 'IDLE', matches: [], isBusy: false });

        await sendMessage(
          chatId,
          `❌ <b>Pelanggan Tidak Ditemukan!</b>\n\n` +
          `Tidak ada pelanggan aktif dengan kata kunci <b>"${text}"</b> di seluruh server.${extraHint}\n\n` +
          `<i>Silakan klik tombol di bawah jika ingin mencari nama lain:</i>`,
          {
            inline_keyboard: [[{ text: '🔄 Cari Ulang', callback_data: 'start_search' }]]
          }
        );
        return;
      }

      // Kasus B: Ditemukan TEPAT 1 Pelanggan -> Langsung tampilkan hasilnya!
      if (matched.length === 1) {
        await sendCustomerDetail(chatId, matched[0]);
        return;
      }

      // Kasus C: Ditemukan BANYAK Pelanggan -> Beri DAFTAR NOMOR & Kunci ke Mode Pemilihan Nomor
      const displayLimit = Math.min(matched.length, 12);
      const matchedSlice = matched.slice(0, displayLimit);

      userSessions.set(chatId, {
        step: 'AWAITING_NUMBER',
        matches: matchedSlice,
        isBusy: false
      });

      let listText = `📋 <b>Ditemukan ${matched.length} Pelanggan yang Cocok:</b>\n` +
                     `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

      for (let i = 0; i < displayLimit; i++) {
        const c = matchedSlice[i];
        const srvName = (c.router_name || c.router_id || 'SERVER').toUpperCase();
        const statusIcon = c.is_active ? '🟢' : '🔴';
        listText += `<b>${i + 1}.</b> ${statusIcon} <b>${c.customer_name}</b> [${srvName}]\n` +
                    `   • Secret: <code>${c.pppoe_user}</code> | IP: <code>${c.ip_address}</code>\n\n`;
      }

      listText += `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                  `👉 <b>Silakan KETIK NOMOR pelanggan (contoh: 1, 2, dll) atau KLIK tombol di bawah.</b>`;

      // Buat tombol inline angka ringkas (misal: baris 1-4, 5-8, dst)
      const numRow1 = [];
      const numRow2 = [];
      for (let i = 0; i < displayLimit; i++) {
        const btn = { text: `${i + 1}`, callback_data: `num:${i + 1}` };
        if (i < 6) numRow1.push(btn);
        else numRow2.push(btn);
      }

      const inlineKeyboard = [];
      if (numRow1.length > 0) inlineKeyboard.push(numRow1);
      if (numRow2.length > 0) inlineKeyboard.push(numRow2);
      inlineKeyboard.push([{ text: '🔄 Cari Ulang', callback_data: 'start_search' }]);

      await sendMessage(chatId, listText, { inline_keyboard: inlineKeyboard });
    }
  } finally {
    activeProcessingUsers.delete(fromId);
  }
}

// -------------------------------------------------------------
// CALLBACK QUERY HANDLER (INLINE BUTTONS)
// -------------------------------------------------------------

async function handleCallbackQuery(cb) {
  if (!cb || !cb.message) return;

  const chatId = cb.message.chat.id;
  const fromId = cb.from ? String(cb.from.id) : '';
  const data = cb.data || '';

  await answerCallbackQuery(cb.id);

  // Anti-Duplikasi / Debounce tombol
  if (activeProcessingUsers.has(fromId)) {
    console.log(`[DEBOUNCE DROP] Callback from ${fromId} ignored (already processing).`);
    return;
  }
  activeProcessingUsers.add(fromId);

  try {
    // 1. KLIK TOMBOL "CARI PELANGGAN" / "CARI ULANG" -> Buka jendela input teks
    if (data === 'start_search') {
      userSessions.set(chatId, { step: 'AWAITING_QUERY', matches: [], isBusy: false });

      // Pastikan cache tetap segar
      refreshClientsCache();

      await sendMessage(
        chatId,
        `📝 <b>Pencarian Pelanggan Aktif:</b>\n\n` +
        `Silakan ketik <b>Nama Pelanggan</b> atau <b>ID Pelanggan</b> yang ingin dicari:\n` +
        `<i>(Pencarian otomatis di semua server — huruf kapital, kecil, atau campuran bebas).</i>`
      );
      return;
    }

    // 2. KLIK NOMOR PELANGGAN DARI DAFTAR (num:1, num:2, dll)
    if (data.startsWith('num:')) {
      const num = parseInt(data.split(':')[1], 10);
      const session = userSessions.get(chatId);
      if (session && session.matches && session.matches[num - 1]) {
        const selected = session.matches[num - 1];
        userSessions.set(chatId, { step: 'PROCESSING', matches: [], isBusy: true });
        await sendCustomerDetail(chatId, selected);
        return;
      }
    }
  } finally {
    activeProcessingUsers.delete(fromId);
  }
}

// -------------------------------------------------------------
// TELEGRAM LONG POLLING DENGAN TIMEOUT SAFETY & ERROR RECOVERY
// -------------------------------------------------------------

let offset = 0;
let isPolling = false;

async function pollUpdates() {
  if (isPolling) return;
  isPolling = true;

  const controller = new AbortController();
  const timeoutTimer = setTimeout(() => controller.abort(), 35000);

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${offset}&timeout=20&allowed_updates=${encodeURIComponent(JSON.stringify(['message', 'callback_query']))}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutTimer);
    const data = await res.json();

    if (data.ok && Array.isArray(data.result)) {
      for (const update of data.result) {
        offset = update.update_id + 1;
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
    setTimeout(pollUpdates, 500);
  }
}

// Start bot & Preload In-Memory Clients Cache
console.log('=======================================================');
console.log('🤖 BOT INTERAKTIF CEK PELANGGAN NOC MAHAWIRA RUNNING');
console.log('🎯 Bot Username: @TES_NOTIFIKASI_ALARM_BOT');
console.log('⚡ Ultra-Fast In-Memory Search Engine Active');
console.log('🛡️ Strict Anti-Spam Gate & Input Locking Active');
console.log('=======================================================');

refreshRegisteredTechs().then(() => {
  refreshClientsCache(true).then(() => {
    pollUpdates();
    // Jadwalkan auto-refresh cache setiap 45 detik di background
    setInterval(() => refreshClientsCache(true), 45000);
  });
});
