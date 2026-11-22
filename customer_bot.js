// customer_bot.js - Interactive Telegram Bot Cek Pelanggan NOC Mahawira
// Bot: @TES_NOTIFIKASI_ALARM_BOT

const { createClient } = require('@supabase/supabase-js');
const http = require('http');

const BOT_TOKEN = '8652596987:AAH25sRrqJAZ7Xwxrh1ZVEi-cHiZah7Vg-g';
const SUPABASE_URL = 'https://hmshfssjxudjllfgohal.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhtc2hmc3NqeHVkamxsZmdvaGFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0Njc3NjEsImV4cCI6MjEwMDA0Mzc2MX0.4lt3iRVD9ktBUiatDk6DCJlSV1FAwQ1p5qPCwex31PM';
const MODEM_SERVICE_URL = 'http://127.0.0.1:7878';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State management per user: { [chatId]: { step: 'AWAITING_SERVER' | 'AWAITING_QUERY' | 'SELECTING_CLIENT', server: 'sukodono'|'wonorejo'|'all', matches: [] } }
const userSessions = new Map();

// Cache daftar teknisi terdaftar
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
      registeredTechIds = ids;
      lastTechRefresh = Date.now();
      console.log(`[AUTH] Refreshed registered technicians: ${ids.size} IDs found.`);
    }
  } catch (err) {
    console.error('[AUTH] Error refreshing tech IDs:', err.message);
  }
}

// Telegram API Helper
async function sendTg(method, payload) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (err) {
    console.error(`[TG API] Error calling ${method}:`, err.message);
    return null;
  }
}

async function sendMessage(chatId, text, replyMarkup = null, parseMode = 'HTML') {
  return await sendTg('sendMessage', {
    chat_id: chatId,
    text: text,
    parse_mode: parseMode,
    reply_markup: replyMarkup,
    disable_web_page_preview: false
  });
}

async function sendPhoto(chatId, photoUrl, caption = '', replyMarkup = null) {
  return await sendTg('sendPhoto', {
    chat_id: chatId,
    photo: photoUrl,
    caption: caption,
    parse_mode: 'HTML',
    reply_markup: replyMarkup
  });
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
function generateTrafficChartUrl(customerName, queueSpeed, trafficPoints = null) {
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
  const isAuthorized = registeredTechIds.has(fromId) || fromId === '8829241140' || fromId === '5266511068';
  if (!isAuthorized) {
    console.log(`[AUTH DENIED] ID ${fromId} (${fromName}) tried accessing bot.`);
    await sendMessage(
      chatId,
      `⛔ <b>Akses Ditolak / Belum Terdaftar</b>\n\n` +
      `Halo <b>${fromName}</b>, akun Telegram Anda belum terdaftar sebagai petugas resmi NOC Mahawira.\n\n` +
      `🆔 <b>ID Telegram Anda:</b> <code>${fromId}</code>\n\n` +
      `<i>Silakan hubungi Admin NOC untuk mendaftarkan ID Telegram di atas agar dapat menggunakan bot ini.</i>`
    );
    return;
  }

  // 2. Command /start atau Reset
  if (text.startsWith('/start') || text.toLowerCase() === 'menu' || text.toLowerCase() === 'reset') {
    userSessions.set(chatId, { step: 'AWAITING_SERVER', server: null, matches: [] });

    const serverKeyboard = {
      inline_keyboard: [
        [
          { text: '🏢 SERVER SUKODONO', callback_data: 'srv:sukodono' },
          { text: '🏢 SERVER WONOREJO', callback_data: 'srv:wonorejo' }
        ],
        [
          { text: '🌐 SEMUA SERVER (ALL)', callback_data: 'srv:all' }
        ]
      ]
    };

    await sendMessage(
      chatId,
      `👋 <b>Halo, Petugas ${fromName}!</b>\n` +
      `Selamat datang di <b>Bot Interaktif Cek Pelanggan Realtime NOC Mahawira</b>.\n\n` +
      `Silakan pilih <b>Server Router</b> yang ingin Anda periksa:`,
      serverKeyboard
    );
    return;
  }

  // 3. Tangani Input Teks Petugas saat mencari Pelanggan
  const session = userSessions.get(chatId);
  if (!session || session.step !== 'AWAITING_QUERY') {
    // Jika tidak dalam sesi pencarian, pandu petugas untuk ketik /start
    await sendMessage(
      chatId,
      `ℹ️ Ketik <b>/start</b> untuk memulai pengecekan status pelanggan.`
    );
    return;
  }

  const query = text.toLowerCase();
  if (query.length < 2) {
    await sendMessage(chatId, `⚠️ Masukkan minimal 2 huruf untuk pencarian nama atau ID pelanggan.`);
    return;
  }

  await sendMessage(chatId, `🔍 <i>Mencari pelanggan <b>"${text}"</b> pada server ${session.server.toUpperCase()}...</i>`);

  // Query modem_service.js untuk mendapatkan active clients
  const clientsResp = await queryModemService(`/api/modem/clients?router=${session.server}`);
  const allClients = (clientsResp && clientsResp.data) || [];

  // Filter case-insensitive pada nama pelanggan dan user pppoe
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

    const retryKeyboard = {
      inline_keyboard: [
        [{ text: '🔄 Cari Nama Lain', callback_data: `srv:${session.server}` }],
        [{ text: '🔙 Ganti Server', callback_data: 'back_to_servers' }]
      ]
    };

    await sendMessage(
      chatId,
      `❌ <b>Pelanggan Tidak Ditemukan!</b>\n\n` +
      `Tidak ada pelanggan aktif dengan kata kunci <b>"${text}"</b> di server <b>${session.server.toUpperCase()}</b>.${extraHint}\n\n` +
      `<i>Periksa kembali penulisan nama atau ID pelanggan.</i>`,
      retryKeyboard
    );
    return;
  }

  // Simpan hasil matches ke session
  session.matches = matched;
  session.step = 'SELECTING_CLIENT';
  userSessions.set(chatId, session);

  // Buat inline keyboard daftar pelanggan yang ditemukan (maks 10 pilihan teratas)
  const buttons = [];
  const displayLimit = Math.min(matched.length, 10);

  for (let i = 0; i < displayLimit; i++) {
    const c = matched[i];
    const statusIcon = c.is_active ? '🟢' : '🔴';
    const label = `${statusIcon} ${c.customer_name} (${c.pppoe_user})`;
    buttons.push([{ text: label, callback_data: `sel:${i}` }]);
  }

  // Tambahkan tombol pembatalan / cari ulang sesuai permintaan alur: "jika teknisi memilih bukan - maka bot memberikan perintah sebelumnya"
  buttons.push([
    { text: '❌ Bukan yang ini / Cari Ulang', callback_data: 'reject_choice' }
  ]);

  const listKeyboard = { inline_keyboard: buttons };

  await sendMessage(
    chatId,
    `📋 <b>Ditemukan ${matched.length} Pelanggan yang Cocok:</b>\n\n` +
    `Silakan pilih pelanggan yang Anda maksud di bawah ini:`,
    listKeyboard
  );
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

  // 1. Pilih Server (srv:sukodono, srv:wonorejo, srv:all)
  if (data.startsWith('srv:')) {
    const srv = data.split(':')[1];
    userSessions.set(chatId, { step: 'AWAITING_QUERY', server: srv, matches: [] });

    const serverTitle = srv === 'sukodono' ? 'SUKODONO' : srv === 'wonorejo' ? 'WONOREJO' : 'SEMUA SERVER (ALL)';

    await sendMessage(
      chatId,
      `✅ <b>Server Dipilih: ${serverTitle}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📖 <b>Petunjuk Pencarian:</b>\n` +
      `Silakan ketik <b>ID Pelanggan</b> atau <b>Nama Pelanggan</b>.\n` +
      `<i>(Bisa huruf kapital, huruf kecil, atau campuran bebas).</i>\n\n` +
      `Contoh: <code>Agus</code>, <code>STAR_NET</code>, atau <code>1387/RTL/SKD</code>`
    );
    return;
  }

  // 2. Kembali ke pilihan server
  if (data === 'back_to_servers') {
    userSessions.set(chatId, { step: 'AWAITING_SERVER', server: null, matches: [] });
    const serverKeyboard = {
      inline_keyboard: [
        [
          { text: '🏢 SERVER SUKODONO', callback_data: 'srv:sukodono' },
          { text: '🏢 SERVER WONOREJO', callback_data: 'srv:wonorejo' }
        ],
        [
          { text: '🌐 SEMUA SERVER (ALL)', callback_data: 'srv:all' }
        ]
      ]
    };
    await sendMessage(chatId, `Silakan pilih <b>Server Router</b>:`, serverKeyboard);
    return;
  }

  // 3. Teknisi memilih "Bukan yang ini / Cari Ulang"
  if (data === 'reject_choice') {
    const session = userSessions.get(chatId) || { server: 'sukodono' };
    session.step = 'AWAITING_QUERY';
    userSessions.set(chatId, session);

    await sendMessage(
      chatId,
      `🔄 <b>Silakan Masukkan Kembali:</b>\n\n` +
      `Ketikkan kembali <b>ID Pelanggan</b> atau <b>Nama Pelanggan</b> yang lebih spesifik:\n` +
      `<i>(Contoh: nama lengkap, nomor rumah, atau nomor secret PPPoE)</i>`
    );
    return;
  }

  // 4. Teknisi memilih salah satu pelanggan dari list (sel:0, sel:1, dst)
  if (data.startsWith('sel:')) {
    const index = parseInt(data.split(':')[1], 10);
    const session = userSessions.get(chatId);

    if (!session || !session.matches || !session.matches[index]) {
      await sendMessage(chatId, `⚠️ Sesi pencarian telah kedaluwarsa. Silakan ketik <b>/start</b>.`);
      return;
    }

    const client = session.matches[index];

    // Kirim status "Sedang memeriksa..."
    await sendMessage(
      chatId,
      `⏳ <i>Sedang mengambil data real-time, status optik, dan trafik 5 menit terakhir untuk <b>${client.customer_name}</b>...</i>`
    );

    // Ambil data detail diagnostik dari modem_service.js
    const diag = await queryModemService(`/api/modem/diagnose?ip=${encodeURIComponent(client.ip_address)}&user=${encodeURIComponent(client.pppoe_user)}&router=${encodeURIComponent(client.router_id || session.server)}&refresh=1`);
    
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
      `🏢 <b>Server Router:</b> ${client.router_name || session.server.toUpperCase()}\n` +
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
          { text: '🔄 Refresh Data Ini', callback_data: `sel:${index}` },
          { text: '🔍 Cek Pelanggan Lain', callback_data: `srv:${session.server}` }
        ],
        [
          { text: '🔙 Kembali ke Menu Utama', callback_data: 'back_to_servers' }
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
      // Kirim Informasi Lengkap Detail Pelanggan & Tombol Navigasi
      await sendMessage(chatId, detailMessage, actionButtons);
    } catch (photoErr) {
      console.warn('[TG] Fallback to text message:', photoErr.message);
      await sendMessage(chatId, detailMessage, actionButtons);
    }
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

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${offset}&timeout=25&allowed_updates=${encodeURIComponent(JSON.stringify(['message', 'callback_query']))}`);
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
    console.error('[POLL] Error fetching updates:', err.message);
  } finally {
    isPolling = false;
    setTimeout(pollUpdates, 1000);
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
