// bot_service.js - Telegram Bot Service untuk NOC Mahawira
const { createClient } = require('@supabase/supabase-js');

const BOT_TOKEN = '9117120164:AAGfhWEG_W5QnwJxoLnnsg9NrY6axkHmK1I';
const SUPABASE_URL = 'https://hmshfssjxudjllfgohal.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhtc2hmc3NqeHVkamxsZmdvaGFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0Njc3NjEsImV4cCI6MjEwMDA0Mzc2MX0.4lt3iRVD9ktBUiatDk6DCJlSV1FAwQ1p5qPCwex31PM';
const WEB_BASE_URL = 'https://dovand.github.io/management-ggn/form-psb.html';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let offset = 0;
let isPolling = false;

async function sendTelegramMessage(chatId, text, replyMarkup = null, replyToMessageId = null) {
  try {
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    };
    if (replyMarkup) payload.reply_markup = replyMarkup;
    if (replyToMessageId) payload.reply_to_message_id = replyToMessageId;

    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (err) {
    console.error('sendTelegramMessage Error:', err.message);
  }
}

async function handleMessage(msg) {
  if (!msg || !msg.chat) return;

  const chatId = msg.chat.id;
  const fromId = msg.from ? String(msg.from.id) : '';
  const fromName = msg.from ? [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ') || msg.from.username || 'User' : 'User';
  const text = (msg.text || '').trim();

  console.log(`[MSG] From: ${fromName} (${fromId}) in Chat: ${chatId} -> "${text}"`);

  // 1. Respon pesan "tes", "test", "/ping", "ping"
  const cleanText = text.toLowerCase();
  if (cleanText === 'tes' || cleanText === 'test' || cleanText === '/ping' || cleanText === 'ping') {
    await sendTelegramMessage(
      chatId,
      `🤖 *Halo ${fromName}! Bot Work Order Aktif.*\n\nKoneksi sistem NOC Mahawira berfungsi dengan baik.\n\n_Waktu: ${new Date().toLocaleString('id-ID')}_`,
      null,
      msg.message_id
    );
    return;
  }

  // 2. Respon perintah /start atau tombol tiket
  if (cleanText.startsWith('/start')) {
    const parts = text.split(/\s+/);
    const param = parts[1] || '';

    if (!param) {
      await sendTelegramMessage(
        chatId,
        `🤖 *Selamat datang di Bot Work Order NOC Mahawira!*\n\nBot ini digunakan untuk penugasan tiket teknisi dan pengisian formulir PSB secara terverifikasi.`
      );
      return;
    }

    // Param format: PSB_2611_019 atau TCK_8198_20261119 atau ID tiket
    const ticketIdNorm = param.replace(/_/g, '-');
    const ticketIdSlash = param.replace(/_/g, '/');
    console.log(`User ${fromName} (${fromId}) requesting ticket: ${param}`);

    // Ambil data tiket dari Supabase
    let ticket = null;
    const isUUID = /^[0-9a-f]{8}[-_][0-9a-f]{4}[-_][0-9a-f]{4}[-_][0-9a-f]{4}[-_][0-9a-f]{12}$/i.test(param);
    let orFilter = `ticketid.eq.${param},ticketid.eq.${ticketIdNorm},ticketid.eq.${ticketIdSlash},ticketid.ilike.%${param}%,ticketid.ilike.%${ticketIdNorm}%,ticketid.ilike.%${ticketIdSlash}%`;
    if (isUUID) {
      orFilter += `,id.eq.${param.replace(/_/g, '-')}`;
    }

    const { data: ticketsData, error: tErr } = await sb
      .from('tickets')
      .select('*')
      .or(orFilter)
      .limit(1);

    if (ticketsData && ticketsData.length > 0) {
      ticket = ticketsData[0];
    }

    if (!ticket) {
      await sendTelegramMessage(
        chatId,
        `⚠️ *Tiket Tidak Ditemukan!*\n\nTiket dengan kode \`${ticketIdNorm}\` tidak ditemukan di sistem database.`
      );
      return;
    }

    // 🔥 ATURAN KETAT: SEMENTARA INI BOT HANYA MEMPROSES TIKET PSB
    const jenisTiket = (ticket.jenistiket || '').toUpperCase();
    if (jenisTiket !== 'PSB') {
      await sendTelegramMessage(
        chatId,
        `ℹ️ *Informasi Bot*\n\nSaat ini bot hanya memproses tiket *PSB*. Tiket *${ticket.ticketid}* (${jenisTiket}) tidak diproses di bot.`
      );
      return;
    }

    // Ambil daftar teknisi yang ditugaskan
    let assignedTechs = ticket.technicians || [];
    if (typeof assignedTechs === 'string') {
      try { assignedTechs = JSON.parse(assignedTechs); } catch (e) { assignedTechs = [assignedTechs]; }
    }
    if (!Array.isArray(assignedTechs)) assignedTechs = [];

    // JIKA TIDAK ADA TEKNISI YANG DIPILIH, JANGAN PROSES DI BOT
    if (assignedTechs.length === 0) {
      await sendTelegramMessage(
        chatId,
        `⚠️ *Tiket Belum Ditugaskan!*\n\nTiket *${ticket.ticketid}* belum memiliki teknisi yang dipilih di sistem.\nTiket ini tidak dapat diproses sampai admin menugaskan teknisi di dashboard.`
      );
      return;
    }

    // Ambil mapping chat ID teknisi
    let techChatMap = {};
    const { data: setRow } = await sb
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', 'tech_chat_ids')
      .maybeSingle();

    if (setRow && setRow.setting_value) {
      techChatMap = typeof setRow.setting_value === 'string' ? JSON.parse(setRow.setting_value) : setRow.setting_value;
    }

    // Verifikasi apakah fromId adalah salah satu teknisi tiket ini
    let matchedTech = null;
    for (const tName of assignedTechs) {
      const regId = String(techChatMap[tName] || techChatMap[tName.trim()] || '').trim();
      if (regId && regId === fromId) {
        matchedTech = tName;
        break;
      }
    }

    if (matchedTech) {
      // AKSES DITERIMA: Kirim tombol WebApp yang membuka form secara native di Telegram
      const formUrl = `${WEB_BASE_URL}?id=${encodeURIComponent(ticket.ticketid || ticket.id)}&tg_id=${fromId}&_v=${Date.now()}`;
      await sendTelegramMessage(
        chatId,
        `✅ *Akses Disetujui!*\n\nHalo *${matchedTech}*, Anda terverifikasi sebagai teknisi untuk tiket *${ticket.ticketid}* (${ticket.customer || 'Pelanggan'}).\n\nSilakan klik tombol di bawah untuk membuka dan mengisi formulir PSB:`,
        {
          inline_keyboard: [[{
            text: '📝 Buka Formulir PSB',
            web_app: { url: formUrl }
          }]]
        }
      );
    } else {
      // AKSES DITOLAK: User bukan teknisi yang ditugaskan (termasuk Admin atau anggota lain)
      const techNamesStr = assignedTechs.length > 0 ? assignedTechs.join(', ') : 'Belum ditentukan';
      await sendTelegramMessage(
        chatId,
        `⛔ *Akses Ditolak!*\n\nAkun Telegram Anda (\`${fromId}\` - *${fromName}*) bukan teknisi yang ditugaskan pada tiket *${ticket.ticketid}*.\n\nFormulir ini hanya dapat dibuka dan diisi oleh:\n👤 *${techNamesStr}*`
      );
    }
    return;
  }
}

async function pollUpdates() {
  if (isPolling) return;
  isPolling = true;

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${offset}&timeout=20`);
    const data = await res.json();

    if (data.ok && Array.isArray(data.result)) {
      for (const update of data.result) {
        offset = update.update_id + 1;
        if (update.message) {
          await handleMessage(update.message);
        }
      }
    }
  } catch (err) {
    console.error('Polling error:', err.message);
  } finally {
    isPolling = false;
    setTimeout(pollUpdates, 1000);
  }
}

console.log('🚀 Service Bot Telegram NOC Mahawira Berjalan...');
pollUpdates();
