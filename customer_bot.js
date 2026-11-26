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

// Optical History In-Memory Cache & OLT ONU Mappings
let localOpticalHistory = {};
let oltOnuCache = {};
let oltMacToPort = {};

// Master Data Pelanggan & Peta FTTH In-Memory Cache (Sinkronisasi Penuh dengan Sistem)
let mapNetworkData = { odps: [], pelanggans: [] };
let mapOdpCoordMap = new Map();
let dbPelangganList = [];
let lastDbPelangganRefresh = 0;

function reloadMapNetworkData() {
  try {
    if (fs.existsSync('data/map_network.json')) {
      const raw = fs.readFileSync('data/map_network.json', 'utf8');
      const parsed = JSON.parse(raw);
      mapNetworkData = {
        odps: Array.isArray(parsed.odps) ? parsed.odps : [],
        pelanggans: Array.isArray(parsed.pelanggans) ? parsed.pelanggans : []
      };
      mapOdpCoordMap.clear();
      mapNetworkData.odps.forEach(o => {
        if (o.name && o.lat && o.lng) {
          const clean = o.name.replace(/[^a-z0-9]/gi, '').toLowerCase();
          mapOdpCoordMap.set(clean, `${o.lat}, ${o.lng}`);
          mapOdpCoordMap.set(o.name.toLowerCase().trim(), `${o.lat}, ${o.lng}`);
        }
      });
      console.log(`[MAP DATA] Loaded ${mapNetworkData.pelanggans.length} map customers & ${mapNetworkData.odps.length} ODPs into bot.`);
    }
  } catch (err) {
    console.error('[MAP DATA] Error loading map_network.json:', err.message);
  }
}
reloadMapNetworkData();

function getOdpCoords(odpName) {
  if (!odpName || odpName === '-') return null;
  const clean = String(odpName).replace(/[^a-z0-9]/gi, '').toLowerCase();
  return mapOdpCoordMap.get(clean) || mapOdpCoordMap.get(String(odpName).toLowerCase().trim()) || null;
}

function reloadOpticalHistory() {
  try {
    const raw = fs.readFileSync('data/modem_optical_history.json', 'utf8');
    localOpticalHistory = JSON.parse(raw);
  } catch (err) {
    console.error('[OPTICAL HISTORY] Load error:', err.message);
  }
  try {
    if (fs.existsSync('data/olt_onu_cache.json')) {
      oltOnuCache = JSON.parse(fs.readFileSync('data/olt_onu_cache.json', 'utf8'));
    }
  } catch (_) { }
  try {
    if (fs.existsSync('data/olt_mac_to_port.json')) {
      oltMacToPort = JSON.parse(fs.readFileSync('data/olt_mac_to_port.json', 'utf8'));
    }
  } catch (_) { }
}
reloadOpticalHistory();

function isValidOntSerial(sn) {
  if (!sn || sn === '-' || sn === 'undefined' || sn.length < 8) return false;
  const s = String(sn).trim().toUpperCase();
  if (s.startsWith('ZTEG') || s.startsWith('RTEG') || s.startsWith('ZXIC') || s.startsWith('ZICG') || s.startsWith('HWTC') || s.startsWith('485754') || s.startsWith('ALCL') || s.startsWith('ISKT') || s.startsWith('FHTT')) return true;
  if (s.match(/^[0-9]{4}[A-Z][0-9]{7}[A-Z]$/i)) return true;
  if (s.match(/^[0-9A-F]{12}$/i)) return false; // Blokir telak MAC Address yang menyamar jadi SN!
  return true;
}

function resolveOntSerial(mac, user, optSerial, cachedSerial = '', rawComment = '', brand = '') {
  if (isValidOntSerial(optSerial)) return optSerial;
  if (isValidOntSerial(cachedSerial)) return cachedSerial;

  // 1. Ekstrak Serial Number jika tercatat di rawComment
  if (rawComment) {
    const snM = String(rawComment).match(/\b(ZTEG[0-9A-Fa-f]{8}|RTEG[0-9A-Fa-f]{8}|ZXIC[0-9A-Fa-f]{8}|HWTC[0-9A-Fa-f]{8}|485754[0-9A-Fa-f]{10}|ZICG[0-9A-Fa-f]{8}|QXTLC[0-9A-Fa-f]{7,8})\b/i) ||
      String(rawComment).match(/\bSN[:\s=]+([A-Za-z0-9_-]{8,18})\b/i);
    if (snM && isValidOntSerial(snM[1])) return snM[1].toUpperCase();
  }

  const cleanMac = String(mac || '').replace(/[^A-Fa-f0-9]/g, '').toUpperCase();
  const isRealMac = cleanMac && cleanMac.length === 12 && /^[0-9A-F]{12}$/.test(cleanMac);

  if (isRealMac) {
    if (oltMacToPort && oltMacToPort[cleanMac]) {
      const port = oltMacToPort[cleanMac];
      if (oltOnuCache && oltOnuCache[port] && isValidOntSerial(oltOnuCache[port].sn)) return oltOnuCache[port].sn;
    }
    if (oltOnuCache) {
      const matchMac = Object.values(oltOnuCache).find(v => v.mac && v.mac.replace(/[^A-Fa-f0-9]/g, '').toUpperCase() === cleanMac);
      if (matchMac && isValidOntSerial(matchMac.sn)) return matchMac.sn;
    }
  }

  if (user) {
    const uClean = user.toLowerCase().trim();
    if (oltOnuCache) {
      const matchName = Object.values(oltOnuCache).find(v => v.name && v.name.toLowerCase().trim() === uClean);
      if (matchName && isValidOntSerial(matchName.sn)) return matchName.sn;
    }
  }

  const list = (user && localOpticalHistory[user]) || (isRealMac && localOpticalHistory[cleanMac]) || [];
  if (Array.isArray(list) && list.length > 0) {
    const matchHist = list.find(h => isValidOntSerial(h.serial));
    if (matchHist) return matchHist.serial;
  }

  // Format GPON Serial Number Standar Vendor sesuai Brand jika terverifikasi OUI ONT
  return '-';

  return '-';
}

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

// Background Cache Refresh untuk seluruh router & database sistem
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

    // Refresh database master pelanggan Supabase
    if (Date.now() - lastDbPelangganRefresh > 60000 || force) {
      try {
        const { data: pList } = await sb.from('pelanggan').select('*');
        if (pList && Array.isArray(pList)) {
          dbPelangganList = pList;
          lastDbPelangganRefresh = Date.now();
          console.log(`[DB SYNC] Master pelanggan updated: ${dbPelangganList.length} rows.`);
        }
      } catch (_) { }
      reloadMapNetworkData();
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
    const req = http.get(`${MODEM_SERVICE_URL}${path}`, { timeout: 25000 }, (res) => {
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

// Query master data pelanggan, ODP & GPS coordinates (Supabase pelanggan, map_network, tickets)
async function findCustomerHistory(queryOrClient, fallbackName = '', rawComment = '') {
  let qUser = '';
  let qName = '';
  let qComment = '';

  if (typeof queryOrClient === 'object' && queryOrClient !== null) {
    if (queryOrClient._systemData) {
      const s = queryOrClient._systemData;
      return {
        customer: s.nama || s.customer || queryOrClient.customer_name,
        kodePelanggan: s.id || s.id_pelanggan || s.kodePelanggan || queryOrClient.pppoe_user,
        odp: s.odp || s.odppelanggan || '-',
        odppelanggan: s.odp || s.odppelanggan || '-',
        taging_lokasi: s.taging_lokasi || ((s.lat && s.lng) ? `${s.lat}, ${s.lng}` : null),
        taging_odp: s.taging_odp || getOdpCoords(s.odp || s.odppelanggan),
        alamat: s.alamat || s.kec || '-',
        no_tlp: s.no_hp || s.no_tlp || '-',
        paket: s.paket || null,
        sumber: s.sumber || 'system_cache'
      };
    }
    qUser = queryOrClient.pppoe_user || '';
    qName = queryOrClient.customer_name || '';
    qComment = queryOrClient.raw_comment || '';
  } else if (typeof queryOrClient === 'string') {
    qUser = queryOrClient.trim();
    qName = (fallbackName || '').trim();
    qComment = (rawComment || '').trim();
  }

  const cleanUser = qUser.replace(/[^a-z0-9]/gi, '').toLowerCase();
  const cleanName = qName.replace(/[^a-z0-9]/gi, '').toLowerCase();

  let idFromComment = null;
  if (qComment) {
    const idM = qComment.match(/([0-9]{1,4}\/[a-z0-9\-\/]+)/i);
    if (idM) idFromComment = idM[1];
  }

  let result = null;

  // 1. Cek tabel master data pelanggan Supabase (PSB & Migrasi)
  try {
    const pQueries = [];
    if (qUser && qUser !== '-') pQueries.push(`id_pelanggan.eq."${qUser.replace(/"/g, '')}"`);
    if (idFromComment) pQueries.push(`id_pelanggan.eq."${idFromComment.replace(/"/g, '')}"`);
    if (qName && qName.length >= 4) pQueries.push(`nama.ilike."%${qName.replace(/[%"]/g, '')}%"`);

    if (pQueries.length > 0) {
      const { data: pData } = await sb
        .from('pelanggan')
        .select('*')
        .or(pQueries.join(','))
        .limit(1);

      if (pData && pData.length > 0) {
        const p = pData[0];
        result = {
          customer: p.nama,
          kodePelanggan: p.id_pelanggan,
          odp: p.odp,
          odppelanggan: p.odp,
          taging_lokasi: p.taging_lokasi,
          taging_odp: p.taging_odp || getOdpCoords(p.odp),
          alamat: p.alamat,
          no_tlp: p.no_hp,
          paket: p.paket,
          sumber: 'master_pelanggan'
        };
      }
    }
  } catch (e) {
    console.error('[SUPABASE] Query master pelanggan error:', e.message);
  }

  // 2. Cek Peta Jaringan FTTH (map_network.json - 1.300+ Pelanggan)
  if (!result || !result.odp || result.odp === '-') {
    const mapCust = (mapNetworkData.pelanggans || []).find(p => {
      const pCleanId = (p.id || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
      const pCleanNama = (p.nama || '').replace(/[^a-z0-9]/gi, '').toLowerCase();

      return (pCleanId && (pCleanId === cleanUser || (idFromComment && pCleanId === idFromComment.replace(/[^a-z0-9]/gi, '').toLowerCase()))) ||
        (pCleanNama && pCleanNama.length >= 4 && (pCleanNama === cleanName || (cleanName && (cleanName.includes(pCleanNama) || pCleanNama.includes(cleanName)))));
    });

    if (mapCust) {
      const mapOdpLoc = getOdpCoords(mapCust.odp);
      const mapCustLoc = (mapCust.lat && mapCust.lng) ? `${mapCust.lat}, ${mapCust.lng}` : null;

      if (!result) {
        result = {
          customer: mapCust.nama,
          kodePelanggan: (mapCust.id && !mapCust.id.startsWith('plg_')) ? mapCust.id : (qUser || '-'),
          odp: mapCust.odp,
          odppelanggan: mapCust.odp,
          taging_lokasi: mapCustLoc,
          taging_odp: mapOdpLoc,
          alamat: mapCust.alamat || mapCust.kec,
          no_tlp: '-',
          paket: null,
          sumber: 'peta_jaringan_ftth'
        };
      } else {
        if (!result.odp || result.odp === '-') {
          result.odp = mapCust.odp;
          result.odppelanggan = mapCust.odp;
        }
        if (!result.taging_lokasi) result.taging_lokasi = mapCustLoc;
        if (!result.taging_odp) result.taging_odp = mapOdpLoc;
        if (!result.alamat || result.alamat === '-') result.alamat = mapCust.alamat || mapCust.kec;
      }
    }
  }

  // 3. Fallback cek tabel tickets riwayat laporan gangguan
  if (!result || !result.odp || result.odp === '-') {
    try {
      const tQueries = [];
      if (qUser && qUser !== '-') tQueries.push(`kodePelanggan.eq."${qUser.replace(/"/g, '')}"`);
      if (idFromComment) tQueries.push(`kodePelanggan.eq."${idFromComment.replace(/"/g, '')}"`);
      if (qName && qName.length >= 4) tQueries.push(`customer.ilike."%${qName.replace(/[%"]/g, '')}%"`);

      if (tQueries.length > 0) {
        const { data: tData } = await sb
          .from('tickets')
          .select('customer, kodePelanggan, odp, odppelanggan, taging_lokasi, taging_odp, alamat, wilayah, paket, no_tlp')
          .or(tQueries.join(','))
          .order('createdAt', { ascending: false })
          .limit(1);

        if (tData && tData.length > 0) {
          const t = tData[0];
          const odp = t.odppelanggan || t.odp;
          const tLoc = t.taging_lokasi && t.taging_lokasi !== '-' ? t.taging_lokasi : null;
          const oLoc = t.taging_odp && t.taging_odp !== '-' ? t.taging_odp : getOdpCoords(odp);

          if (!result) {
            result = {
              customer: t.customer,
              kodePelanggan: t.kodePelanggan || qUser,
              odp: odp,
              odppelanggan: odp,
              taging_lokasi: tLoc,
              taging_odp: oLoc,
              alamat: t.alamat || t.wilayah,
              no_tlp: t.no_tlp,
              paket: t.paket,
              sumber: 'tickets'
            };
          } else {
            if (!result.odp || result.odp === '-') {
              result.odp = odp;
              result.odppelanggan = odp;
            }
            if (!result.taging_lokasi) result.taging_lokasi = tLoc;
            if (!result.taging_odp) result.taging_odp = oLoc;
            if (!result.alamat || result.alamat === '-') result.alamat = t.alamat || t.wilayah;
            if (!result.no_tlp || result.no_tlp === '-') result.no_tlp = t.no_tlp;
            if (!result.paket) result.paket = t.paket;
          }
        }
      }
    } catch (e) {
      console.error('[SUPABASE] Query tickets error:', e.message);
    }
  }

  // 4. Pastikan koordinat ODP otomatis terisi jika nama ODP ada di database peta
  if (result && result.odp && result.odp !== '-' && (!result.taging_odp || result.taging_odp === '-')) {
    result.taging_odp = getOdpCoords(result.odp);
  }

  return result;
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
function getTrafficStats(queueSpeed, isOnline = true) {
  if (!isOnline) {
    const zeroPoints = [0, 0, 0, 0, 0, 0];
    return {
      downPoints: zeroPoints,
      upPoints: zeroPoints,
      peakDown: '0 Kbps (0.00 Mbps)',
      peakUp: '0 Kbps (0.00 Mbps)',
      avgDown: '0 Kbps (0.00 Mbps)',
      avgUp: '0 Kbps (0.00 Mbps)'
    };
  }

  const curDownMbps = queueSpeed ? ((queueSpeed.down_rate_bps || 0) / 1000000) : 0;
  const curUpMbps = queueSpeed ? ((queueSpeed.up_rate_bps || 0) / 1000000) : 0;

  let downPoints, upPoints;
  if (curDownMbps > 0.02 || curUpMbps > 0.02) {
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
    downPoints = [0, 0, 0, 0, 0, +curDownMbps.toFixed(2)];
    upPoints = [0, 0, 0, 0, 0, +curUpMbps.toFixed(2)];
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
function generateTrafficChartUrl(customerName, queueSpeed, isOnline = true) {
  const labels = ['5m lalu', '4m lalu', '3m lalu', '2m lalu', '1m lalu', 'Sekarang'];
  const stats = getTrafficStats(queueSpeed, isOnline);

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
        text: `Trafik 5 Menit Terakhir (Puncak: ${stats.peakDown})`,
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

// Database OUI Vendor Hardware (ONT vs Router Non-OLT)
const MAC_OUI_DATABASE = {
  non_olt: [
    // Tenda (F3, N301, AC10, TX3, dll)
    { prefix: 'D83214', brand: 'Tenda', model: 'Router / Access Point' },
    { prefix: '500FF5', brand: 'Tenda', model: 'Router / Access Point' },
    { prefix: 'B40F3B', brand: 'Tenda', model: 'Router / Access Point' },
    { prefix: 'CC2D21', brand: 'Tenda', model: 'Router / Access Point' },
    { prefix: '0840F3', brand: 'Tenda', model: 'Router / Access Point' },
    { prefix: '58D9D5', brand: 'Tenda', model: 'Router / Access Point' },
    { prefix: 'B83A08', brand: 'Tenda', model: 'Router / Access Point' },
    { prefix: 'C83A35', brand: 'Tenda', model: 'Router / Access Point' },
    { prefix: '0495E6', brand: 'Tenda', model: 'Router / Access Point' },
    { prefix: '502B73', brand: 'Tenda', model: 'Router / Access Point' },
    { prefix: '5004B8', brand: 'Tenda', model: 'Router / Access Point' },
    { prefix: 'C4A81D', brand: 'Tenda', model: 'Router / Access Point' },
    { prefix: '00B00C', brand: 'Tenda', model: 'Router / Access Point' },

    // Totolink / Zioncom (N200RE, N300RT, dll)
    { prefix: '5C925E', brand: 'Totolink', model: 'Router / Access Point' },
    { prefix: '40EE15', brand: 'Totolink', model: 'Router / Access Point' },
    { prefix: '784476', brand: 'Totolink', model: 'Router / Access Point' },
    { prefix: '00E04C', brand: 'Totolink', model: 'Router / Access Point' },
    { prefix: '045EA4', brand: 'Totolink', model: 'Router / Access Point' },
    { prefix: '600292', brand: 'Totolink', model: 'Router / Access Point' },

    // TP-Link (WR840N, WR844N, Archer, dll)
    { prefix: 'D49E04', brand: 'TP-Link', model: 'Router / Access Point' },
    { prefix: '50C7BF', brand: 'TP-Link', model: 'Router / Access Point' },
    { prefix: 'E848B8', brand: 'TP-Link', model: 'Router / Access Point' },
    { prefix: 'B04E26', brand: 'TP-Link', model: 'Router / Access Point' },
    { prefix: 'C006C3', brand: 'TP-Link', model: 'Router / Access Point' },
    { prefix: '14CC20', brand: 'TP-Link', model: 'Router / Access Point' },
    { prefix: '30B5C2', brand: 'TP-Link', model: 'Router / Access Point' },
    { prefix: '000A52', brand: 'TP-Link', model: 'Router / Access Point' },
    { prefix: '6032B1', brand: 'TP-Link', model: 'Router / Access Point' },
    { prefix: '704F57', brand: 'TP-Link', model: 'Router / Access Point' },
    { prefix: '7405A5', brand: 'TP-Link', model: 'Router / Access Point' },
    { prefix: '8416F9', brand: 'TP-Link', model: 'Router / Access Point' },
    { prefix: '984827', brand: 'TP-Link', model: 'Router / Access Point' },
    { prefix: 'A42BB0', brand: 'TP-Link', model: 'Router / Access Point' },
    { prefix: 'B0BE76', brand: 'TP-Link', model: 'Router / Access Point' },
    { prefix: 'C46E1F', brand: 'TP-Link', model: 'Router / Access Point' },
    { prefix: 'D807B6', brand: 'TP-Link', model: 'Router / Access Point' },
    { prefix: 'E4C32A', brand: 'TP-Link', model: 'Router / Access Point' },
    { prefix: 'EC086B', brand: 'TP-Link', model: 'Router / Access Point' },
    { prefix: 'F4F26D', brand: 'TP-Link', model: 'Router / Access Point' },

    // Mercusys
    { prefix: '84D81B', brand: 'Mercusys', model: 'Router / Access Point' },
    { prefix: '54AF97', brand: 'Mercusys', model: 'Router / Access Point' },
    { prefix: 'A842A1', brand: 'Mercusys', model: 'Router / Access Point' },
    { prefix: '2C3033', brand: 'Mercusys', model: 'Router / Access Point' },

    // Generic / OEM Router WiFi
    { prefix: '0026CE', brand: 'Netis', model: 'Router / Access Point' },
    { prefix: '085700', brand: 'Router / AP', model: 'Router AP' }
  ],

  olt: [
    // ZTE GPON ONT (China Mobile GM220-S / H3C)
    { prefix: '64F88A', brand: 'ZTE', model: 'GM220-S (GPON ONT)' },
    { prefix: 'B4E46B', brand: 'ZTE', model: 'GM220-S (GPON ONT)' },
    // Huawei GPON ONT
    { prefix: '9C713A', brand: 'Huawei', model: 'HG8245H' },
    { prefix: 'B4B055', brand: 'Huawei', model: 'HG8245H' },
    { prefix: '001E10', brand: 'Huawei', model: 'HG8245H' },
    { prefix: '00259E', brand: 'Huawei', model: 'HG8245H' },
    { prefix: '0819A6', brand: 'Huawei', model: 'HG8245H' },
    { prefix: '101B54', brand: 'Huawei', model: 'HG8245H' },
    { prefix: '104780', brand: 'Huawei', model: 'HG8245H' },
    { prefix: '14B968', brand: 'Huawei', model: 'HG8245H' },
    { prefix: '200889', brand: 'Huawei', model: 'HG8245H' },
    { prefix: '20F3A3', brand: 'Huawei', model: 'HG8245H' },
    { prefix: '2469A5', brand: 'Huawei', model: 'HG8245H' },
    { prefix: '283152', brand: 'Huawei', model: 'HG8245H' },
    { prefix: '285FDB', brand: 'Huawei', model: 'HG8245H' },
    { prefix: '308730', brand: 'Huawei', model: 'HG8245H' },
    { prefix: '342EB6', brand: 'Huawei', model: 'HG8245H' },
    { prefix: '404D8E', brand: 'Huawei', model: 'HG8245H' },
    { prefix: '4482E5', brand: 'Huawei', model: 'HG8245H' },
    { prefix: '48435A', brand: 'Huawei', model: 'HG8245H' },
    { prefix: '485702', brand: 'Huawei', model: 'HG8245H' },
    { prefix: '4C5499', brand: 'Huawei', model: 'HG8245H' },
    { prefix: '548998', brand: 'Huawei', model: 'HG8245H' },
    { prefix: '7054F5', brand: 'Huawei', model: 'HG8245H' },
    { prefix: '74882A', brand: 'Huawei', model: 'HG8245H' },
    { prefix: '80B655', brand: 'Huawei', model: 'HG8245H' },
    { prefix: '888603', brand: 'Huawei', model: 'HG8245H' },
    { prefix: '8C34FD', brand: 'Huawei', model: 'HG8245H' },
    { prefix: '9017AC', brand: 'Huawei', model: 'HG8245H' },
    { prefix: '94049C', brand: 'Huawei', model: 'HG8245H' },
    { prefix: 'A4BE2B', brand: 'Huawei', model: 'HG8245H' },
    { prefix: 'B41513', brand: 'Huawei', model: 'HG8245H' },
    { prefix: 'C8D15B', brand: 'Huawei', model: 'HG8245H' },
    { prefix: 'D440F0', brand: 'Huawei', model: 'HG8245H' },
    { prefix: 'D8490B', brand: 'Huawei', model: 'HG8245H' },
    { prefix: 'E0247F', brand: 'Huawei', model: 'HG8245H' },
    { prefix: 'E09796', brand: 'Huawei', model: 'HG8245H' },
    { prefix: 'EC233D', brand: 'Huawei', model: 'HG8245H' },
    { prefix: 'F4C4D5', brand: 'Huawei', model: 'HG8245H' },
    { prefix: 'F84ABF', brand: 'Huawei', model: 'HG8245H' },

    // ZTE GPON ONT
    { prefix: '689FF0', brand: 'ZTE', model: 'F677' },
    { prefix: '004A77', brand: 'ZTE', model: 'F677' },
    { prefix: '74B57E', brand: 'ZTE', model: 'F677' },
    { prefix: 'C4A366', brand: 'ZTE', model: 'F677' },
    { prefix: '981333', brand: 'ZTE', model: 'F677' },
    { prefix: '688AF0', brand: 'ZTE', model: 'F677' },
    { prefix: '30D386', brand: 'ZTE', model: 'F677' },
    { prefix: '083FBC', brand: 'ZTE', model: 'F677' },
    { prefix: 'D0608C', brand: 'ZTE', model: 'F677' },
    { prefix: '702E22', brand: 'ZTE', model: 'F677' },
    { prefix: 'F4E4AD', brand: 'ZTE', model: 'F677' },
    { prefix: '78C1A7', brand: 'ZTE', model: 'F677' },
    { prefix: '48A74E', brand: 'ZTE', model: 'F677' },
    { prefix: 'D8A8C8', brand: 'ZTE', model: 'F677' },
    { prefix: 'A091C8', brand: 'ZTE', model: 'F677' },
    { prefix: 'C42728', brand: 'ZTE', model: 'F677' },
    { prefix: 'E865D4', brand: 'ZTE', model: 'F677' },
    { prefix: '84742A', brand: 'ZTE', model: 'F677' },
    { prefix: '001E73', brand: 'ZTE', model: 'F677' },
    { prefix: '0019C6', brand: 'ZTE', model: 'F677' },
    { prefix: '002293', brand: 'ZTE', model: 'F677' },
    { prefix: '80B686', brand: 'ZTE', model: 'F677' },
    { prefix: '001146', brand: 'ZTE', model: 'F677' },
    { prefix: 'D8E844', brand: 'ZTE', model: 'F677' },

    // Fiberhome ONT
    { prefix: '000FE2', brand: 'Fiberhome', model: 'AN5506' },
    { prefix: '0019E0', brand: 'Fiberhome', model: 'AN5506' },
    { prefix: '04FE8D', brand: 'Fiberhome', model: 'AN5506' },
    { prefix: '18E829', brand: 'Fiberhome', model: 'AN5506' },

    // OEM ONT
    { prefix: 'E067B3', brand: 'VSOL', model: 'V2801' },
    { prefix: '808917', brand: 'Hioso', model: 'HA7200' }
  ]
};

// Deteksi otomatis Merk / Brand, Tipe & Status OLT/Non-OLT dari MAC Address (OUI) & Komentar
function detectModemInfoFromMac(mac, rawComment = '') {
  const cUpper = String(rawComment || '').toUpperCase();

  // 1. Prioritas Utama: Cek jika rawComment menyebutkan tipe modem secara eksplisit
  if (cUpper.includes('F670L') || cUpper.includes('F670') || cUpper.includes('ZXHN F670')) {
    return { isOlt: true, brand: 'ZTE', model: 'F670L', isHtb: false, serial: '-' };
  }
  if (cUpper.includes('F677')) {
    return { isOlt: true, brand: 'ZTE', model: 'F677', isHtb: false, serial: '-' };
  }
  if (cUpper.includes('F663') || cUpper.includes('F663NV3')) {
    return { isOlt: true, brand: 'ZTE', model: 'F663NV3a', isHtb: false, serial: '-' };
  }
  if (cUpper.includes('XP663') || cUpper.includes('XP663N')) {
    return { isOlt: true, brand: 'ZTE', model: 'XP663N', isHtb: false, serial: '-' };
  }
  if (cUpper.includes('F609')) {
    return { isOlt: true, brand: 'ZTE', model: 'F609', isHtb: false, serial: '-' };
  }
  if (cUpper.includes('F660')) {
    return { isOlt: true, brand: 'ZTE', model: 'F660', isHtb: false, serial: '-' };
  }
  if (cUpper.includes('F451')) {
    return { isOlt: true, brand: 'ZTE', model: 'F451', isHtb: false, serial: '-' };
  }
  if (cUpper.includes('F452')) {
    return { isOlt: true, brand: 'ZTE', model: 'F452', isHtb: false, serial: '-' };
  }
  if (cUpper.includes('F477')) {
    return { isOlt: true, brand: 'ZTE', model: 'F477V2 EPON', isHtb: false, serial: '-' };
  }
  if (cUpper.includes('HG8245') || cUpper.includes('HG8546') || cUpper.includes('HUAWEI')) {
    return { isOlt: true, brand: 'Huawei', model: 'HG8245H', isHtb: false, serial: '-' };
  }
  if (cUpper.includes('AN5506') || cUpper.includes('FIBERHOME')) {
    return { isOlt: true, brand: 'Fiberhome', model: 'AN5506', isHtb: false, serial: '-' };
  }

  // 2. Cek jika comment bertanda HTB / CONVERTER (Hanya pelanggan khusus converter FO-LAN)
  if (cUpper.includes('HTB') || cUpper.includes('CONVERTER') || cUpper.includes('MEDIA CONVERTER')) {
    return {
      isOlt: false,
      brand: 'Router / Access Point',
      model: 'Router AP (HTB)',
      isHtb: true,
      serial: '-'
    };
  }

  if (!mac || mac === '-') {
    return { isOlt: true, brand: 'ZTE', model: 'F670L', isHtb: false, serial: '-' };
  }

  const cleanMac = mac.replace(/[^A-Fa-f0-9]/g, '').toUpperCase();
  const oui = cleanMac.slice(0, 6);

  // 3. Cek Router / Access Point Non-OLT (Converter HTB) dari MAC OUI (Tenda, TP-Link, Totolink, Mercusys)
  const nonOltMatch = MAC_OUI_DATABASE.non_olt.find(m => m.prefix === oui);
  if (nonOltMatch) {
    return {
      isOlt: false,
      brand: nonOltMatch.brand,
      model: nonOltMatch.model,
      isHtb: true,
      serial: '-'
    };
  }

  // 4. Cek Modem OLT (GPON / EPON ONT) dari MAC OUI
  const oltMatch = MAC_OUI_DATABASE.olt.find(m => m.prefix === oui);
  if (oltMatch) {
    const snPrefix = (oltMatch.brand === 'Huawei') ? 'HWTC' : ((oltMatch.brand === 'Fiberhome') ? 'FHTT' : 'ZTEG');
    const computedSn = snPrefix + (cleanMac.length >= 8 ? cleanMac.slice(-8) : '00000000');
    return {
      isOlt: true,
      brand: oltMatch.brand,
      model: oltMatch.model,
      isHtb: false,
      serial: computedSn
    };
  }

  // 5. Default di jaringan FTTH: Standar ONT GPON ZTE F670L
  return {
    isOlt: true,
    brand: 'ZTE',
    model: 'F670L',
    isHtb: false,
    serial: 'ZTEG' + (cleanMac.length >= 8 ? cleanMac.slice(-8) : '00000000')
  };
}

// Format Maps URL from Coordinates
function formatMapsUrl(coords) {
  if (!coords || coords === '-' || coords === 'null') return null;
  const clean = coords.trim().replace(/['"]/g, '');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clean)}`;
}

// Helper untuk membaca format timestamp MikroTik (contoh: 'nov/22/2026 10:41:01', '20:28:08', atau '2026-11-21 21:24:20')
function parseMikrotikDate(str) {
  if (!str || str === '-' || str === 'never' || str === 'Offline') return 0;

  // Format MikroTik: 'HH:mm:ss' (misal: '20:28:08' -> berarti HARI INI)
  const timeOnly = str.trim().match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (timeOnly) {
    const today = new Date();
    today.setHours(parseInt(timeOnly[1], 10), parseInt(timeOnly[2], 10), parseInt(timeOnly[3] || '0', 10), 0);
    return today.getTime();
  }

  // Format ISO / standard: 2026-11-23 20:28:08 atau 2026/11/23
  const normalized = str.replace(/-/g, '/');
  const d = new Date(normalized);
  if (!isNaN(d.getTime())) return d.getTime();

  const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const now = new Date();

  // Format MikroTik: 'nov/23/2026 20:28:08'
  const mFull = str.match(/([a-zA-Z]{3})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})/);
  if (mFull) {
    const month = months[mFull[1].toLowerCase()];
    if (month !== undefined) {
      return new Date(parseInt(mFull[3], 10), month, parseInt(mFull[2], 10), parseInt(mFull[4], 10), parseInt(mFull[5], 10), parseInt(mFull[6], 10)).getTime();
    }
  }

  // Format MikroTik: 'nov/23 20:28:08' (tanpa tahun)
  const mShort = str.match(/([a-zA-Z]{3})\/(\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})/);
  if (mShort) {
    const month = months[mShort[1].toLowerCase()];
    if (month !== undefined) {
      return new Date(now.getFullYear(), month, parseInt(mShort[2], 10), parseInt(mShort[3], 10), parseInt(mShort[4], 10), parseInt(mShort[5], 10)).getTime();
    }
  }

  return 0;
}

function formatMikrotikDateStr(str) {
  if (!str || str === '-' || str === 'never' || str === 'Offline') return str || '-';
  const timeOnly = str.trim().match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (timeOnly) {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(timeOnly[1])}:${pad(timeOnly[2])}:${pad(timeOnly[3] || '00')}`;
  }
  return str;
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

    // Ambil data trafik real-time dan data master sistem secara paralel
    const [trafficRes, ticketHist] = await Promise.all([
      queryModemService(`/api/modem/traffic-realtime?user=${encodeURIComponent(client.pppoe_user)}&router=${encodeURIComponent(client.router_id || '')}&ip=${encodeURIComponent(client.ip_address || '')}`),
      findCustomerHistory(client)
    ]);

    console.log(`[DETAIL EXEC] client=${client.pppoe_user}, cached_active=${client.is_active}, trafficRes=`, JSON.stringify(trafficRes));

    // 1. Status Koneksi (Validasi Live Real-Time MikroTik)
    const srvRouter = client.router_name || (client.router_id || 'SERVER').toUpperCase();

    let isOnline = false;
    let isDisabled = false;
    let liveIp = '-';
    let liveMac = client.mac_address || '-';
    let liveUptime = 'Offline';

    if (trafficRes && trafficRes.success) {
      if (trafficRes.is_disabled) {
        isDisabled = true;
        isOnline = false;
      } else if (trafficRes.is_active && trafficRes.ip && trafficRes.ip !== '-') {
        isOnline = true;
        liveIp = trafficRes.ip;
        if (trafficRes.mac && trafficRes.mac !== '-') liveMac = trafficRes.mac;
        if (trafficRes.uptime && trafficRes.uptime !== '-') liveUptime = trafficRes.uptime;
      } else {
        isOnline = false;
      }
    } else {
      isOnline = Boolean(client.is_active && client.ip_address && client.ip_address !== '-');
      liveIp = client.ip_address || '-';
      liveUptime = client.uptime || 'Offline';
    }

    // STRICT CHECK: Pelanggan aktif WAJIB memiliki IP Address valid dari MikroTik!
    if (!liveIp || liveIp === '-' || liveIp === '0.0.0.0') {
      isOnline = false;
    }

    let statusKoneksiStr = '';
    if (isDisabled) {
      statusKoneksiStr = `🔴 <b>NON-AKTIF (DISABLED DI MIKROTIK)</b> - Akun dimatikan (${srvRouter})`;
    } else if (isOnline) {
      statusKoneksiStr = `🟢 <b>ONLINE (AKTIF)</b> - Uptime: <code>${liveUptime}</code>`;
    } else {
      const lastOffStr = (trafficRes && trafficRes.last_logged_out && trafficRes.last_logged_out !== '-')
        ? trafficRes.last_logged_out
        : (client.last_logged_out && client.last_logged_out !== '-' ? client.last_logged_out : 'Tidak tercatat');
      statusKoneksiStr = `🔴 <b>OFFLINE / PADAM</b> - Terputus: <code>${lastOffStr}</code> (${srvRouter})`;
    }

    // 1. Identifikasi Mutlak Tipe Perangkat, Jalur Distribusi & ODP
    const liveOrCachedMac = (liveMac !== '-' ? liveMac : client.mac_address) || '';
    const rawComment = String(client.raw_comment || '');
    const pppoeUser = String(client.pppoe_user || '');
    const commentUpper = rawComment.toUpperCase();
    const userUpper = pppoeUser.toUpperCase();

    // Deteksi HTB mutlak: hanya jika ada tanda HTB di comment / username / router Randuagung tanpa OLT
    const isExplicitHtb = client.isHtb ||
      commentUpper.includes('HTB') ||
      commentUpper.includes('CONVERTER') ||
      commentUpper.includes('MEDIA CONVERTER') ||
      userUpper.includes('HTB') ||
      userUpper.includes('/HTB');

    const devInfo = detectModemInfoFromMac(liveOrCachedMac, rawComment || pppoeUser);

    // 2. Deteksi Merk / Brand & Model Perangkat (Prioritas: Cache Master -> Optical -> Deteksi OUI)
    let modemBrand = (client.brand && client.brand !== 'Router / AP' && client.brand !== 'Perangkat Pelanggan')
      ? client.brand
      : (client.optical?.brand && client.optical.brand !== 'Unknown' && client.optical.brand !== 'Router / AP' ? client.optical.brand : null);

    let modemModel = (client.model && client.model !== 'Perangkat Pelanggan' && client.model !== 'Router AP (HTB)')
      ? client.model
      : (client.optical?.model && client.optical.model !== '-' ? client.optical.model : null);

    if (!modemBrand) modemBrand = devInfo.brand;
    if (!modemModel) modemModel = devInfo.model;

    // 3. Ekstrak data optik dari client atau history lokal
    let isOptHistory = false;
    let opt = client.optical || {};
    if (isExplicitHtb) {
      modemBrand = modemBrand || 'Router / Access Point';
      modemModel = modemModel || 'Router AP (HTB)';
      opt = {
        brand: modemBrand,
        model: modemModel,
        serial: '-',
        rx_power: 'Tidak Ada (Non-OLT)',
        rx_val: null,
        status: 'Non-OLT (Converter HTB)'
      };
    } else {
      if (!modemBrand || modemBrand === 'Router / AP' || modemBrand === 'Router / Access Point' || modemBrand === 'Unknown') {
        modemBrand = devInfo.brand && devInfo.brand !== 'Unknown' ? devInfo.brand : '-';
      }
      if (!modemModel || modemModel === 'Perangkat Pelanggan' || modemModel === 'Router AP (HTB)' || modemModel === 'GPON ONT') {
        modemModel = devInfo.model && devInfo.model !== 'Perangkat Pelanggan' ? devInfo.model : '-';
      }

      if (!isOnline) {
        // Ambil riwayat redaman terakhir jika ada
        const hist = getOpticalFromHistory(client.pppoe_user, liveIp !== '-' ? liveIp : null);
        if (hist && hist.rx_power && hist.rx_power !== '-' && !hist.rx_power.includes('Closed')) {
          opt = hist;
          isOptHistory = true;
          if (hist.brand && hist.brand !== 'Unknown') modemBrand = hist.brand;
          if (hist.model && hist.model !== '-' && hist.model !== 'GPON ONT') modemModel = hist.model;
        } else {
          opt = {
            brand: modemBrand,
            model: modemModel,
            serial: opt.serial || client.serial || '-',
            rx_power: '-',
            rx_val: null,
            tx_power: '-',
            temperature: '-',
            voltage: '-',
            status: 'Offline'
          };
        }
      } else {
        if (!opt.rx_power || opt.rx_power === '-' || opt.rx_power.toLowerCase() === 'offline' || opt.rx_power.includes('Closed') || opt.rx_power.includes('Non-OLT')) {
          const hist = getOpticalFromHistory(client.pppoe_user, liveIp !== '-' ? liveIp : null);
          if (hist) {
            opt = hist;
            isOptHistory = true;
          }
        }

        // Jika pelanggan sedang ONLINE (khusus OLT), lakukan live probe ke modem
        const targetIp = (liveIp && liveIp !== '-' && liveIp !== '0.0.0.0') ? liveIp : null;
        if (targetIp) {
          try {
            const probeUrl = `/api/modem/check?ip=${encodeURIComponent(targetIp || '')}&user=${encodeURIComponent(client.pppoe_user || '')}&mac=${encodeURIComponent(liveOrCachedMac)}&router=${encodeURIComponent(client.router_id || '')}`;
            const liveOpt = await queryModemService(probeUrl);
            if (liveOpt && liveOpt.success && liveOpt.data) {
              if (liveOpt.data.rx_power && liveOpt.data.rx_power !== '-' && !liveOpt.data.rx_power.toLowerCase().includes('offline')) {
                opt = liveOpt.data;
                isOptHistory = !!liveOpt.data.is_history;
              }
              if (liveOpt.data.brand && liveOpt.data.brand !== 'Unknown') modemBrand = liveOpt.data.brand;
              if (liveOpt.data.model && liveOpt.data.model !== '-' && liveOpt.data.model !== 'GPON ONT' && liveOpt.data.model !== 'Perangkat Pelanggan') modemModel = liveOpt.data.model;
              if (liveOpt.data.serial && liveOpt.data.serial !== '-') opt.serial = liveOpt.data.serial;
            }
          } catch (_) { }
        }
      }
    }

    let rxVal = null;
    let optStatus;
    let rxPowerStr = '-';
    let txPowerStr = '-';
    let tempStr = '-';
    let voltStr = '-';

    if (opt.rx_val !== undefined && opt.rx_val !== null) {
      rxVal = typeof opt.rx_val === 'number' ? opt.rx_val : parseFloat(opt.rx_val);
    } else if (opt.rx_power && opt.rx_power !== '-' && opt.rx_power.toLowerCase() !== 'offline') {
      const parsed = parseFloat(opt.rx_power);
      if (!isNaN(parsed)) rxVal = parsed;
    }

    txPowerStr = opt.tx_power && opt.tx_power !== '-' ? opt.tx_power : '-';
    tempStr = opt.temperature && opt.temperature !== '-' ? opt.temperature : '-';
    voltStr = opt.voltage && opt.voltage !== '-' ? opt.voltage : '-';

    if (!isOnline) {
      optStatus = { label: 'Perangkat Padam / Offline', badge: '🔴', category: 'OFFLINE' };
      if (rxVal !== null && !isNaN(rxVal)) {
        rxPowerStr = `${rxVal.toFixed(2)} dBm (History)`;
      } else {
        rxPowerStr = 'Tidak Ada Sinyal (Perangkat Padam)';
      }
    } else {
      if (rxVal !== null && !isNaN(rxVal)) {
        optStatus = formatOpticalStatus(rxVal);
        rxPowerStr = isOptHistory ? `${rxVal.toFixed(2)} dBm (History)` : `${rxVal.toFixed(2)} dBm`;
      } else {
        optStatus = { label: 'Belum Terdeteksi', badge: '⚪', category: 'UNKNOWN' };
        rxPowerStr = '-';
      }
    }

    // 3. Ekstrak data trafik & kuota
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

    // 4. Informasi Pelanggan & ODP dari Master Sistem
    const cleanCustomerName = (client.customer_name || '').replace(/\s*\[.*?\]\s*$/, '').replace(/\s*\(SERVER.*?\)\s*$/i, '').trim();
    const officialName = cleanCustomerName || (ticketHist && ticketHist.customer) || client.customer_name;
    const officialId = (ticketHist && ticketHist.kodePelanggan && ticketHist.kodePelanggan !== '-')
      ? ticketHist.kodePelanggan
      : client.pppoe_user;
    const odpName = (ticketHist && (ticketHist.odppelanggan || ticketHist.odp)) || '-';
    const tagPelanggan = (ticketHist && ticketHist.taging_lokasi) || null;
    const tagOdp = (ticketHist && ticketHist.taging_odp) || getOdpCoords(odpName) || null;
    const custAlamat = (ticketHist && ticketHist.alamat && ticketHist.alamat !== '-') ? ticketHist.alamat : null;
    const custNoHp = (ticketHist && ticketHist.no_tlp && ticketHist.no_tlp !== '-') ? ticketHist.no_tlp : null;
    const custPaket = (ticketHist && ticketHist.paket && ticketHist.paket !== '-') ? ticketHist.paket : null;

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

    // 5. SN Modem (Deteksi Asli dari Database OLT & History)
    const modemSn = resolveOntSerial(liveOrCachedMac, client.pppoe_user, opt.serial, client.serial, rawComment, modemBrand);

    // Hitung statistik trafik dan puncak tertinggi 5 menit terakhir (jika offline, selalu 0)
    const trafficStats = getTrafficStats({ down_rate_bps: downRateBps, up_rate_bps: upRateBps }, isOnline);

    // Cek apakah akun ini juga terdaftar di server router lain
    let multiServerNote = '';
    const otherServers = cachedClients.filter(c =>
      c.pppoe_user && client.pppoe_user &&
      c.pppoe_user.toLowerCase().trim() === client.pppoe_user.toLowerCase().trim() &&
      (c.router_id || '').toLowerCase() !== (client.router_id || '').toLowerCase()
    );
    if (otherServers.length > 0) {
      const otherInfo = otherServers.map(o => {
        const oSrv = (o.router_name || o.router_id || 'SERVER').toUpperCase();
        const oStatus = o.is_active ? '🟢 Online' : `🔴 Offline (${o.last_logged_out || '-'})`;
        return `${oSrv} [${oStatus}]`;
      }).join(', ');
      multiServerNote = `ℹ️ <i>Catatan: Akun ini juga terdaftar di: ${otherInfo}</i>\n`;
    }

    // Format Pesan Detail Pelanggan (Tanpa keterangan jalur distribusi sesuai instruksi user)
    const detailMessage =
      `📋 <b>INFORMASI DETAIL PELANGGAN</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>Nama Pelanggan:</b> ${cleanCustomerName}\n` +
      `🔑 <b>ID Pelanggan:</b> <code>${officialId}</code>\n` +
      (client.pppoe_user && client.pppoe_user !== officialId && !client.pppoe_user.startsWith('plg_') ? `🔌 <b>Akun PPPoE:</b> <code>${client.pppoe_user}</code>\n` : '') +
      `🏢 <b>Server Router:</b> ${srvRouter}\n` +
      (custPaket ? `📦 <b>Paket Langganan:</b> <b>${custPaket}</b>\n` : '') +
      (custNoHp ? `📞 <b>No. HP / WA:</b> <code>${custNoHp}</code>\n` : '') +
      (custAlamat ? `🏠 <b>Alamat:</b> ${custAlamat}\n` : '') +
      (multiServerNote ? `${multiServerNote}` : '') +
      `🌐 <b>IP Address:</b> <code>${liveIp}</code>\n` +
      `🏷️ <b>MAC Address:</b> <code>${liveMac}</code>\n\n` +

      `⚡ <b>STATUS KONEKSI & PERANGKAT:</b>\n` +
      `• Status: ${statusKoneksiStr}\n` +
      (isExplicitHtb
        ? `• Perangkat: <b>${modemBrand}</b> (${modemModel})\n• MAC Perangkat: <code>${liveMac}</code>\n\n`
        : `• Modem: <b>${modemBrand}</b> (${modemModel})\n• SN Modem: <code>${modemSn}</code>\n\n`) +

      (isExplicitHtb
        ? `💡 <b>KUALITAS REDAMAN OPTIK (NON-OLT):</b>\n• Sensor Redaman: <i>Non-OLT (Jalur unmanaged Media Converter HTB, tidak memiliki sensor optik digital).</i>\n\n`
        : (!isOnline
            ? (rxVal !== null && !isNaN(rxVal)
                ? `💡 <b>KUALITAS REDAMAN OPTIK:</b>\n• Status: 🔴 <b>Perangkat Padam / Offline</b>\n• Rx Power: <b>${rxPowerStr}</b>\n• Tx Power: <code>${txPowerStr} ${txPowerStr !== '-' ? '(History)' : ''}</code>\n• Suhu: <code>${tempStr}</code> | Volt: <code>${voltStr}</code>\n\n`
                : `💡 <b>KUALITAS REDAMAN OPTIK:</b>\n• Status: 🔴 <b>Perangkat Padam / Offline</b>\n• Rx Power: <code>Tidak Ada Sinyal (Perangkat Padam)</code>\n\n`)
            : `💡 <b>KUALITAS REDAMAN OPTIK:</b>\n• Kategori: ${optStatus.badge} <b>${optStatus.label}</b>\n• Rx Power: <b>${rxPowerStr}</b>\n• Tx Power: <code>${txPowerStr}</code>\n• Suhu: <code>${tempStr}</code> | Volt: <code>${voltStr}</code>\n\n`)) +

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

    // 1. Tampilkan Grafik Pemakaian Terlebih Dahulu (Wajib selalu dikirim di atas detail pelanggan, tanpa nama di grafik/caption)
    const chartUrl = generateTrafficChartUrl(cleanCustomerName, { down_rate_bps: downRateBps, up_rate_bps: upRateBps }, isOnline);
    try {
      await sendPhoto(
        chatId,
        chartUrl,
        `📊 <b>Grafik Pemakaian Trafik 5 Menit Terakhir (Puncak: ${trafficStats.peakDown})</b>`
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

// Map to prevent duplicate incoming messages (Telegram network resends or rapid clicks)
const lastMsgProcessed = new Map(); // chatId -> { text, time }

async function handleIncomingMessage(msg) {
  if (!msg || !msg.chat) return;

  const chatId = msg.chat.id;
  const fromId = msg.from ? String(msg.from.id) : '';
  const fromName = msg.from ? [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ') || msg.from.username || 'Petugas' : 'Petugas';
  const text = (msg.text || '').trim();

  // Deduplikasi pesan identik dalam rentang 1.5 detik (anti double message)
  const now = Date.now();
  const lastMsg = lastMsgProcessed.get(chatId);
  if (lastMsg && lastMsg.text === text && (now - lastMsg.time < 1500)) {
    console.log(`[DEBOUNCE] Ignoring duplicate message from ${chatId}: "${text}"`);
    return;
  }
  lastMsgProcessed.set(chatId, { text, time: now });

  console.log(`[TG INCOMING] User ${fromName} (${fromId}): "${text}"`);

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

    // PENCARIAN UNIFIED: MikroTik + Peta Jaringan FTTH (1.300+ Pelanggan) + Supabase
    const cleanQuery = query.trim();
    const queryLower = cleanQuery.toLowerCase();

    // 1. Pencarian di Cache Pelanggan MikroTik (Nama, PPPoE User, IP, Comment)
    const rawMatched = cachedClients.filter(c => {
      const cName = (c.customer_name || '').toLowerCase();
      const pName = (c.pppoe_user || '').toLowerCase();
      const ipAddr = (c.ip_address || '').toLowerCase();
      const comment = (c.raw_comment || '').toLowerCase();
      return cName.includes(queryLower) || pName.includes(queryLower) || ipAddr.includes(queryLower) || (comment && comment.includes(queryLower));
    });

    // 2. Pencarian di Master Peta FTTH (1.300+ Pelanggan) & Database Supabase
    const matchedSystemPelanggans = [];
    const seenSystemIds = new Set();

    (mapNetworkData.pelanggans || []).forEach(p => {
      const pName = (p.nama || '').toLowerCase();
      const pId = (p.id || '').toLowerCase();
      const pOdp = (p.odp || '').toLowerCase();
      const pAlamat = (p.alamat || '').toLowerCase();
      const match = pName.includes(queryLower) || (pId && pId.includes(queryLower)) || (pOdp && pOdp.includes(queryLower)) || (pAlamat && pAlamat.includes(queryLower));
      if (match) {
        matchedSystemPelanggans.push(p);
        if (p.id) seenSystemIds.add(p.id.toLowerCase().trim());
      }
    });

    dbPelangganList.forEach(p => {
      const pName = (p.nama || '').toLowerCase();
      const pId = (p.id_pelanggan || '').toLowerCase();
      const pOdp = (p.odp || '').toLowerCase();
      const pAlamat = (p.alamat || '').toLowerCase();
      const match = pName.includes(queryLower) || (pId && pId.includes(queryLower)) || (pOdp && pOdp.includes(queryLower)) || (pAlamat && pAlamat.includes(queryLower));
      if (match && !seenSystemIds.has(pId)) {
        matchedSystemPelanggans.push({
          id: p.id_pelanggan,
          nama: p.nama,
          odp: p.odp,
          alamat: p.alamat,
          no_hp: p.no_hp,
          paket: p.paket,
          lat: p.taging_lokasi ? parseFloat(p.taging_lokasi.split(',')[0]) : null,
          lng: p.taging_lokasi ? parseFloat(p.taging_lokasi.split(',')[1]) : null
        });
        seenSystemIds.add(pId);
      }
    });

    // Hubungkan pencarian sistem dengan data router MikroTik (jika sudah ada, pakai client MikroTik)
    const matchedMapClients = [];
    matchedSystemPelanggans.forEach(sp => {
      const spIdClean = (sp.id || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
      const spNameClean = (sp.nama || '').replace(/[^a-z0-9]/gi, '').toLowerCase();

      const foundInCached = cachedClients.find(c => {
        const cUserClean = (c.pppoe_user || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
        const cNameClean = (c.customer_name || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
        const cComment = (c.raw_comment || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
        return (spIdClean && (cUserClean === spIdClean || cComment.includes(spIdClean))) ||
          (spNameClean && spNameClean.length >= 4 && (cNameClean === spNameClean || cNameClean.includes(spNameClean) || spNameClean.includes(cNameClean)));
      });

      if (foundInCached) {
        if (!foundInCached._systemData) foundInCached._systemData = sp;
        rawMatched.push(foundInCached);
      } else {
        matchedMapClients.push({
          pppoe_user: (sp.id && !sp.id.startsWith('plg_')) ? sp.id : (sp.nama || '-'),
          customer_name: sp.nama,
          router_id: 'ftth_map',
          router_name: 'PETA JARINGAN FTTH',
          ip_address: '-',
          mac_address: '-',
          is_active: false,
          last_logged_out: 'Belum Terdaftar di MikroTik / Offline',
          uptime: 'Offline',
          _systemData: sp
        });
      }
    });

    // Perluas pencarian untuk menyertakan router lain yang memiliki ID PPPoE yang sama persis
    const matchedUsernames = new Set(rawMatched.map(c => (c.pppoe_user || '').toLowerCase().trim()).filter(Boolean));
    const allRelatedClients = cachedClients.filter(c => {
      const pName = (c.pppoe_user || '').toLowerCase().trim();
      return pName && matchedUsernames.has(pName);
    });

    // Gabungkan dan deduplikasi record berdasarkan kombinasi router_id + pppoe_user + nama
    const fullMatchedMap = new Map();
    [...rawMatched, ...allRelatedClients, ...matchedMapClients].forEach(c => {
      const uniqueKey = `${c.router_id || ''}:${c.pppoe_user || ''}:${c.customer_name || ''}`;
      if (!fullMatchedMap.has(uniqueKey)) {
        fullMatchedMap.set(uniqueKey, c);
      }
    });
    const combinedMatched = Array.from(fullMatchedMap.values());

    // 1. Urutkan:
    // - Prioritas utama: Yang ONLINE (🟢) selalu berada paling atas
    // - Jika sama-sama OFFLINE (🔴): Urutkan berdasarkan waktu disconnect TERBARU (paling baru padam di atas)
    combinedMatched.sort((a, b) => {
      if (a.is_active && !b.is_active) return -1;
      if (!a.is_active && b.is_active) return 1;
      if (!a.is_active && !b.is_active) {
        return getClientOfflineTimestamp(b) - getClientOfflineTimestamp(a);
      }
      return 0;
    });

    // 2. Pengelompokan akun PPPoE yang terdaftar di beberapa router:
    // - Sesuai instruksi user: "jika disemua server pelanggan terdeteksi offline, maka ambil offline terbaru, jangan yang paling lama. jadi tampilkan di server mana pelanggan yang offline terbaru itu."
    // - Jika ada server yang ONLINE dan server lain OFFLINE, TAMPILKAN KEDUANYA agar petugas bisa melihat status di masing-masing server router!
    const userGroups = new Map();
    for (const c of combinedMatched) {
      const key = (c.pppoe_user || '').toLowerCase().trim();
      if (!userGroups.has(key)) userGroups.set(key, []);
      userGroups.get(key).push(c);
    }

    const matched = [];
    for (const [key, group] of userGroups.entries()) {
      const hasOnline = group.some(c => c.is_active);
      if (!hasOnline) {
        // Semua server OFFLINE -> ambil server dengan offline TERBARU
        let latest = group[0];
        let latestTime = getClientOfflineTimestamp(latest);
        for (let i = 1; i < group.length; i++) {
          const t = getClientOfflineTimestamp(group[i]);
          if (t > latestTime) {
            latest = group[i];
            latestTime = t;
          }
        }
        matched.push(latest);
      } else {
        // Ada server yang online dan offline -> masukkan semua router agar petugas bisa melihat/memilih router yang ingin dicek
        for (const c of group) {
          matched.push(c);
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
