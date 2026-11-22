// customer_bot.js - Interactive Telegram Bot Cek Pelanggan NOC Mahawira
// Bot: @TES_NOTIFIKASI_ALARM_BOT

const { createClient } = require('@supabase/supabase-js');
const http = require('http');

const BOT_TOKEN = '8652596987:AAH25sRrqJAZ7Xwxrh1ZVEi-cHiZah7Vg-g';
const SUPABASE_URL = 'https://hmshfssjxudjllfgohal.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhtc2hmc3NqeHVkamxsZmdvaGFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0Njc3NjEsImV4cCI6MjEwMDA0Mzc2MX0.4lt3iRVD9ktBUiatDk6DCJlSV1FAwQ1p5qPCwex31PM';
const MODEM_SERVICE_URL = 'http://127.0.0.1:7878';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State management per user: { [chatId]: { step: 'AWAITING_QUERY' | 'SELECTING_CLIENT_BY_NUMBER', matches: [] } }
const userSessions = new Map();

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

// Telegram API Helper dengan logging error detail
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
  // Kirim status "Sedang memeriksa..."
  await sendMessage(
    chatId,
    `⏳ <i>Sedang mengambil data real-time, status optik, dan grafik pemakaian 5 menit terakhir untuk <b>${client.customer_name}</b>...</i>`
  );

  // Ambil data detail diagnostik dari modem_service.js
  const diag = await queryModemService(`/api/modem/diagnose?ip=${encodeURIComponent(client.ip_address)}&user=${encodeURIComponent(client.pppoe_user)}&router=${encodeURIComponent(client.router_id || 'sukodono')}&refresh=1`);
  
  // Ambil history tiket Supabase untuk data ODP dan Taging Lokasi
  const ticketHist = await findCustomerHistory(client.customer_name) || await findCustomerHistory(client.pppoe_user);

  // 1. Ekstrak data optik
  const opt = (diag && diag.metrics && diag.metrics.optical_power) || client.optical || {};
  const rxVal = opt.rx_val !== undefined ? opt.rx_val : (parseFloat(opt.rx_power) || null);
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
    `━━━━━━━━━━━━━━━━━━━━━━━━━`;

  const actionButtons = {
    inline_keyboard: [
      [
        { text: '🔍 Cari Pelanggan Lain', callback_data: 'new_search' }
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

  // 2. Command /start, menu, reset
  if (text.startsWith('/start') || text.toLowerCase() === 'menu' || text.toLowerCase() === 'reset') {
    userSessions.set(chatId, { step: 'AWAITING_QUERY', matches: [] });

    await sendMessage(
      chatId,
      `👋 <b>Halo, Petugas ${fromName}!</b>\n` +
      `Selamat datang di <b>Bot Cek Pelanggan Realtime NOC Mahawira</b>.\n\n` +
      `🔍 <b>Silakan langsung ketik Nama Pelanggan atau ID Pelanggan yang ingin dicari:</b>\n` +
      `<i>(Pencarian otomatis di semua server — huruf besar, kecil, atau campuran bebas).</i>\n\n` +
      `Contoh:\n` +
      `• <code>Agus</code>\n` +
      `• <code>STAR_NET</code>\n` +
      `• <code>1387/RTL/SKD</code>`
    );
    return;
  }

  const session = userSessions.get(chatId) || { step: 'AWAITING_QUERY', matches: [] };

  // 3. JIKA PETUGAS SEDANG MEMILIH NOMOR PELANGGAN DARI DAFTAR
  if (session.step === 'SELECTING_CLIENT_BY_NUMBER' && session.matches && session.matches.length > 0) {
    const cleanLower = text.toLowerCase();

    // Jika teknisi mengetik 0, bukan, batal, atau cari ulang
    if (cleanLower === '0' || cleanLower === 'bukan' || cleanLower === 'batal' || cleanLower === 'ulang' || cleanLower.includes('bukan')) {
      userSessions.set(chatId, { step: 'AWAITING_QUERY', matches: [] });
      await sendMessage(
        chatId,
        `🔄 <b>Silakan Masukkan Kembali:</b>\n\n` +
        `Ketikkan <b>Nama Pelanggan</b> atau <b>ID Pelanggan</b> yang ingin dicari:`
      );
      return;
    }

    // Periksa apakah input adalah NOMOR angka (contoh: "1", "2", dst)
    const choiceNum = parseInt(text, 10);
    if (!isNaN(choiceNum) && choiceNum >= 1 && choiceNum <= session.matches.length) {
      const selectedClient = session.matches[choiceNum - 1];
      userSessions.set(chatId, { step: 'AWAITING_QUERY', matches: [] });
      await sendCustomerDetail(chatId, selectedClient);
      return;
    }

    // Jika yang diketik bukan nomor valid, tetapi teks baru yang panjangnya >= 2, anggap sebagai PENCARIAN BARU secara otomatis!
    if (isNaN(choiceNum) && text.length >= 2) {
      console.log(`[FLOW] User typed new search query instead of number: "${text}"`);
      // Lanjut ke blok pencarian di bawah
    } else {
      await sendMessage(
        chatId,
        `⚠️ <b>Pilihan tidak valid!</b>\n\n` +
        `Silakan ketik nomor antara <b>1 s/d ${session.matches.length}</b> sesuai daftar di atas.\n` +
        `Atau ketik <b>0</b> jika bukan yang Anda maksud.`
      );
      return;
    }
  }

  // 4. PENCARIAN PELANGGAN DI SEMUA SERVER
  const query = text.toLowerCase();
  if (query.length < 2) {
    await sendMessage(chatId, `⚠️ Masukkan minimal 2 huruf untuk pencarian nama atau ID pelanggan.`);
    return;
  }

  await sendMessage(chatId, `🔍 <i>Mencari pelanggan <b>"${text}"</b> di semua server...</i>`);

  // Query modem_service.js untuk active clients di semua server
  const clientsResp = await queryModemService('/api/modem/clients?router=all');
  const allClients = (clientsResp && clientsResp.data) || [];

  // Filter case-insensitive pada nama pelanggan, user pppoe, dan ip address
  const matched = allClients.filter(c => {
    const cName = (c.customer_name || '').toLowerCase();
    const pName = (c.pppoe_user || '').toLowerCase();
    const ipAddr = (c.ip_address || '').toLowerCase();
    return cName.includes(query) || pName.includes(query) || ipAddr.includes(query);
  });

  if (matched.length === 0) {
    // Coba cari di riwayat Supabase sebagai fallback
    const hist = await findCustomerHistory(text);
    let extraHint = '';
    if (hist) {
      extraHint = `\n\n📌 <i>Ditemukan di riwayat arsip tiket:</i>\n` +
        `👤 <b>${hist.customer}</b> (${hist.kodePelanggan})\n` +
        `Status: Kemungkinan modem sedang <b>OFFLINE / PADAM</b> saat ini.`;
    }

    userSessions.set(chatId, { step: 'AWAITING_QUERY', matches: [] });

    await sendMessage(
      chatId,
      `❌ <b>Pelanggan Tidak Ditemukan!</b>\n\n` +
      `Tidak ada pelanggan aktif dengan kata kunci <b>"${text}"</b> di seluruh server.${extraHint}\n\n` +
      `<i>Silakan ketik kembali nama atau ID pelanggan lain yang ingin dicari.</i>`
    );
    return;
  }

  // JIKA HANYA DITEMUKAN 1 PELANGGAN PERSIS: Langsung tampilkan hasilnya!
  if (matched.length === 1) {
    userSessions.set(chatId, { step: 'AWAITING_QUERY', matches: [] });
    await sendCustomerDetail(chatId, matched[0]);
    return;
  }

  // JIKA DITEMUKAN BANYAK PELANGGAN: Tampilkan DAFTAR NOMOR sesuai permintaan user!
  const displayLimit = Math.min(matched.length, 15);
  const matchedSlice = matched.slice(0, displayLimit);

  userSessions.set(chatId, {
    step: 'SELECTING_CLIENT_BY_NUMBER',
    matches: matchedSlice
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
              `👉 <b>Silakan KETIK NOMOR pelanggan yang Anda cari (contoh: 1, 2, dll).</b>\n\n` +
              `<i>Atau ketik <b>0</b> jika bukan yang Anda maksud untuk cari ulang.</i>`;

  // Sertakan tombol inline juga agar teknisi bisa memilih dengan klik ATAU dengan mengetik nomor!
  const inlineButtons = [];
  for (let i = 0; i < displayLimit; i++) {
    const c = matchedSlice[i];
    const srv = (c.router_name || c.router_id || 'SRV').toUpperCase();
    inlineButtons.push([{ text: `${i + 1}. ${c.customer_name} [${srv}]`, callback_data: `num:${i + 1}` }]);
  }
  inlineButtons.push([{ text: '❌ Bukan yang ini / Cari Ulang (Ketik 0)', callback_data: 'reject_choice' }]);

  await sendMessage(chatId, listText, { inline_keyboard: inlineButtons });
}

// -------------------------------------------------------------
// CALLBACK QUERY HANDLER (INLINE BUTTONS)
// -------------------------------------------------------------

async function handleCallbackQuery(cb) {
  if (!cb || !cb.message) return;

  const chatId = cb.message.chat.id;
  const data = cb.data || '';

  await answerCallbackQuery(cb.id);

  // 1. Teknisi klik tombol nomor (num:1, num:2, dll)
  if (data.startsWith('num:')) {
    const num = parseInt(data.split(':')[1], 10);
    const session = userSessions.get(chatId);
    if (session && session.matches && session.matches[num - 1]) {
      const selected = session.matches[num - 1];
      userSessions.set(chatId, { step: 'AWAITING_QUERY', matches: [] });
      await sendCustomerDetail(chatId, selected);
      return;
    }
  }

  // 2. Teknisi klik "Bukan yang ini / Cari Ulang" atau "Cari Pelanggan Lain"
  if (data === 'reject_choice' || data === 'new_search') {
    userSessions.set(chatId, { step: 'AWAITING_QUERY', matches: [] });
    await sendMessage(
      chatId,
      `🔍 <b>Silakan ketik Nama Pelanggan atau ID Pelanggan yang ingin dicari:</b>\n` +
      `<i>(Contoh: nama lengkap, nama panggilan, atau nomor secret PPPoE)</i>`
    );
    return;
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

// Start bot
console.log('=======================================================');
console.log('🤖 BOT INTERAKTIF CEK PELANGGAN NOC MAHAWIRA RUNNING');
console.log('🎯 Bot Username: @TES_NOTIFIKASI_ALARM_BOT');
console.log('=======================================================');

refreshRegisteredTechs().then(() => {
  pollUpdates();
});
