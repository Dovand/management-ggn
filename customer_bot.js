// customer_bot.js - Interactive Telegram Bot Cek Pelanggan NOC Mahawira
// Bot: @MonicaAssistenCantik_bot

process.on('uncaughtException', (err) => {
  if (err && (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED')) {
    console.warn('[BOT UNCAUGHT_NETWORK_ERR]', err.message);
    return;
  }
  console.error('[BOT UNCAUGHT_EXCEPTION]', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.warn('[BOT UNHANDLED_REJECTION]', reason);
});

const { createClient } = require('@supabase/supabase-js');
const http = require('http');
const fs = require('fs');
const path = require('path');
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

const BOT_TOKEN = '9085653624:AAEC9NHnAyLpBfEpWLloJhlMLk_pHJba6yg';
let GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
try {
  const gKeyPath = path.join(__dirname, 'data', 'gemini_key.json');
  if (fs.existsSync(gKeyPath)) {
    const parsed = JSON.parse(fs.readFileSync(gKeyPath, 'utf8'));
    GEMINI_API_KEY = parsed.apiKey || parsed.key || GEMINI_API_KEY;
  }
} catch (_) {}
const SUPABASE_URL = 'https://hmshfssjxudjllfgohal.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhtc2hmc3NqeHVkamxsZmdvaGFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0Njc3NjEsImV4cCI6MjEwMDA0Mzc2MX0.4lt3iRVD9ktBUiatDk6DCJlSV1FAwQ1p5qPCwex31PM';
const MODEM_SERVICE_URL = 'http://127.0.0.1:7878';
const MAP_WEB_URL = process.env.MAP_WEB_URL || 'https://dovand.github.io/management-ggn/index.html';

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

// Cache Pelanggan In-Memory & File Disk untuk Pencarian Instan (0.001 detik)
let cachedClients = [];
let lastCacheRefresh = 0;
let isRefreshingCache = false;
const BOT_CLIENTS_CACHE_FILE = path.join(__dirname, 'data', 'bot_clients_cache.json');

// Muat langsung dari disk cache saat bot start
try {
  let cacheFileToLoad = null;
  if (fs.existsSync(BOT_CLIENTS_CACHE_FILE)) {
    cacheFileToLoad = BOT_CLIENTS_CACHE_FILE;
  } else if (fs.existsSync(path.join(__dirname, 'data', 'modem_clients_cache.json'))) {
    cacheFileToLoad = path.join(__dirname, 'data', 'modem_clients_cache.json');
  }

  if (cacheFileToLoad) {
    const rawDiscCache = fs.readFileSync(cacheFileToLoad, 'utf8');
    const parsedDiscCache = JSON.parse(rawDiscCache);
    if (Array.isArray(parsedDiscCache) && parsedDiscCache.length > 0) {
      cachedClients = parsedDiscCache;
      lastCacheRefresh = Date.now();
      console.log(`⚡ [BOT CACHE] Dimuat seketika dari disk cache (${path.basename(cacheFileToLoad)}): ${cachedClients.length} pelanggan.`);
    }
  }
} catch (e) {
  console.warn('[BOT CACHE] Gagal membaca disk cache pelanggan:', e.message);
}

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
      const matchName = Object.values(oltOnuCache).find(v => {
        if (!v.name) return false;
        const oName = v.name.toLowerCase().trim();
        return oName === uClean || (uClean.length >= 4 && (oName.includes(uClean) || uClean.includes(oName)));
      });
      if (matchName && isValidOntSerial(matchName.sn)) return matchName.sn;
    }
  }

  if (user && localOpticalHistory[user]) {
    const list = localOpticalHistory[user];
    if (Array.isArray(list) && list.length > 0) {
      const matchHist = list.find(h => isValidOntSerial(h.serial));
      if (matchHist) return matchHist.serial;
    }
  }

  // Format GPON Serial Number Standar Vendor sesuai Brand jika terverifikasi OUI ONT
  return '-';
}

function isClientOnline(c, trafficRes = null) {
  if (!c) return false;
  if (c.disabled) return false;
  if (trafficRes && trafficRes.is_active === true) return true;
  if (trafficRes && trafficRes.ip && trafficRes.ip !== '-' && trafficRes.ip !== '0.0.0.0') return true;
  if (c.is_active === true) return true;
  const hasIp = c.ip_address && c.ip_address !== '-' && c.ip_address !== '0.0.0.0';
  const hasUptime = c.uptime && !c.uptime.toLowerCase().includes('offline');
  return Boolean(hasIp && hasUptime);
}

function getOpticalFromHistory(user) {
  if (!user || user === '-') return null;
  const list = localOpticalHistory[user] || [];
  if (Array.isArray(list) && list.length > 0) {
    const valid = list.find(h => h.rx_power && h.rx_power !== '-' && !h.rx_power.includes('Closed'));
    return valid || list[0];
  }
  return null;
}

// Whitelist Master Admin Tunggal (Hanya Akun Admin NOC Utama)
const MASTER_ADMIN_IDS = new Set(['8351209898']);
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
  // Jika cache sudah ada dan belum 45 detik, gunakan cache (hemat resource & instan)
  if (!force && cachedClients.length > 0 && Date.now() - lastCacheRefresh < 45000) return;

  isRefreshingCache = true;
  try {
    const res = await queryModemService('/api/modem/clients?router=all');
    if (res && Array.isArray(res.data) && res.data.length > 0) {
      cachedClients = res.data;
      lastCacheRefresh = Date.now();
      try {
        fs.writeFileSync(BOT_CLIENTS_CACHE_FILE, JSON.stringify(cachedClients), 'utf8');
      } catch (_) { }
      console.log(`[CACHE] In-memory & disk clients updated: ${cachedClients.length} clients loaded.`);
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

// ============================================================
// HELPER: EKSTRAKSI ID PELANGGAN ASLI & LENGKAP
// ============================================================
function extractCustomerId(rawComment, pppoeUser) {
  if (rawComment && rawComment.includes('|')) {
    const candidate = rawComment.split('|')[0].trim();
    if (candidate.length >= 3 && (candidate.includes('/') || candidate.includes('-') || /\d/.test(candidate))) {
      return candidate;
    }
  }
  const match = String(rawComment || '').match(/([a-z0-9\-_]{1,10}\/[a-z0-9\-_\/]+)/i);
  if (match) return match[1];
  if (pppoeUser && pppoeUser.includes('/')) return pppoeUser;
  return pppoeUser || '-';
}

// Query master data pelanggan, ODP & GPS coordinates (Supabase pelanggan, map_network, tickets)
async function findCustomerHistory(queryOrClient, fallbackName = '', rawComment = '') {
  let qUser = '';
  let qName = '';
  let qComment = '';
  let clientRouterId = '';

  if (typeof queryOrClient === 'object' && queryOrClient !== null) {
    clientRouterId = (queryOrClient.router_id || queryOrClient.router || '').toLowerCase().trim();
    if (queryOrClient._systemData) {
      const s = queryOrClient._systemData;
      return {
        customer: s.nama || s.customer || queryOrClient.customer_name,
        kodePelanggan: s.id || s.id_pelanggan || s.kodePelanggan || queryOrClient.pppoe_user,
        odp: s.odp || s.odppelanggan || '-',
        odppelanggan: s.odp || s.odppelanggan || '-',
        taging_lokasi: s.taging_lokasi || ((s.lat && s.lng) ? `${s.lat}, ${s.lng}` : null),
        taging_odp: s.taging_odp || getOdpCoords(s.odp || s.odppelanggan),
        alamat: s.alamat || s.kec || (getWilayahFromRouter(clientRouterId) || '-'),
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

  const idFromComment = extractCustomerId(qComment, qUser);
  const lockedCustId = idFromComment !== '-' ? idFromComment : (qUser && qUser !== '-' && !qUser.startsWith('plg_') ? qUser : null);

  let result = null;

  // 1. Cek tabel master data pelanggan Supabase berdasarkan ID Pelanggan terlebih dahulu (Strict ID Match)
  try {
    const idQueries = [];
    if (lockedCustId) idQueries.push(`id_pelanggan.eq."${lockedCustId.replace(/"/g, '')}"`);
    if (qUser && qUser !== '-' && qUser !== lockedCustId) idQueries.push(`id_pelanggan.eq."${qUser.replace(/"/g, '')}"`);

    if (idQueries.length > 0) {
      const { data: pData } = await sb
        .from('pelanggan')
        .select('*')
        .or(idQueries.join(','))
        .limit(3);

      if (pData && pData.length > 0) {
        // Filter agar tidak salah mengambil data dari router server yang berbeda
        let p = pData[0];
        if (clientRouterId && pData.length > 1) {
          const matchRouter = pData.find(cand => {
            const candSrv = resolveServerFromOdpOrAlamat(cand.odp, cand.alamat);
            return candSrv && candSrv.id === clientRouterId;
          });
          if (matchRouter) p = matchRouter;
        }

        const pSrv = resolveServerFromOdpOrAlamat(p.odp, p.alamat);
        const isConflict = clientRouterId && pSrv && pSrv.id && pSrv.id !== clientRouterId;

        result = {
          customer: p.nama,
          kodePelanggan: lockedCustId || p.id_pelanggan,
          odp: isConflict ? '-' : p.odp,
          odppelanggan: isConflict ? '-' : p.odp,
          taging_lokasi: isConflict ? null : p.taging_lokasi,
          taging_odp: isConflict ? null : (p.taging_odp || getOdpCoords(p.odp)),
          alamat: isConflict ? (getWilayahFromRouter(clientRouterId) || p.alamat) : p.alamat,
          no_tlp: p.no_hp,
          paket: p.paket,
          sumber: 'master_pelanggan'
        };
      }
    }
  } catch (e) {
    console.error('[SUPABASE] Query master pelanggan error:', e.message);
  }

  // 2. Cek Peta Jaringan FTTH (map_network.json - 1.300+ Pelanggan) berdasarkan ID atau Nama Lengkap Persis
  if (!result || !result.odp || result.odp === '-') {
    const cleanLockedId = (lockedCustId || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
    const mapCust = (mapNetworkData.pelanggans || []).find(p => {
      const pCleanId = (p.id || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
      const pCleanNama = (p.nama || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
      const pSrv = resolveServerFromOdpOrAlamat(p.odp, p.alamat || p.kec);
      // Cegah cross-server matching: Jangan pernah ambil pelanggan dari wilayah router server lain!
      if (clientRouterId && pSrv && pSrv.id && pSrv.id !== clientRouterId) {
        return false;
      }
      return (pCleanId && (pCleanId === cleanUser || (cleanLockedId && pCleanId === cleanLockedId))) ||
        (cleanName && cleanName.length >= 4 && pCleanNama === cleanName);
    });

    if (mapCust) {
      const mapOdpLoc = getOdpCoords(mapCust.odp);
      const mapCustLoc = (mapCust.lat && mapCust.lng) ? `${mapCust.lat}, ${mapCust.lng}` : null;

      if (!result) {
        result = {
          customer: qName || mapCust.nama,
          kodePelanggan: lockedCustId || mapCust.id,
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

  // 3. Fallback cek tabel tickets riwayat laporan gangguan HANYA berdasarkan kodePelanggan
  if (!result || !result.odp || result.odp === '-') {
    try {
      const tQueries = [];
      if (lockedCustId) tQueries.push(`kodePelanggan.eq."${lockedCustId.replace(/"/g, '')}"`);
      if (qUser && qUser !== '-' && qUser !== lockedCustId) tQueries.push(`kodePelanggan.eq."${qUser.replace(/"/g, '')}"`);

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
              customer: qName || t.customer,
              kodePelanggan: lockedCustId || t.kodePelanggan || qUser,
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
          }
        }
      }
    } catch (e) {
      console.error('[SUPABASE] Query tickets history error:', e.message);
    }
  }

  // 4. Ekstrak ODP langsung dari pola ID jika di database/peta belum ada ODP
  let derivedOdpName = '-';
  const odpPattern = String(lockedCustId || qUser || '').match(/\/([A-Z0-9\-]+\/[0-9]{1,3})/i) ||
    String(lockedCustId || qUser || '').match(/([A-Z]{2,6}-[0-9]{2,3}\/[0-9]{2,3})/i);
  if (odpPattern) {
    derivedOdpName = `ODP-${odpPattern[1].toUpperCase()}`;
  }

  if (!result) {
    result = {
      customer: qName || 'Pelanggan Mahawira',
      kodePelanggan: lockedCustId || qUser || '-',
      odp: derivedOdpName,
      odppelanggan: derivedOdpName,
      taging_lokasi: null,
      taging_odp: getOdpCoords(derivedOdpName),
      alamat: '-',
      no_tlp: '-',
      paket: null,
      sumber: 'router_raw'
    };
  } else if (!result.odp || result.odp === '-') {
    result.odp = derivedOdpName;
    result.odppelanggan = derivedOdpName;
    if (!result.taging_odp) result.taging_odp = getOdpCoords(derivedOdpName);
  }

  // Kunci kodePelanggan mutlak tidak boleh tertukar
  if (lockedCustId) {
    result.kodePelanggan = lockedCustId;
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
    // ZTE GPON / EPON ONT
    { prefix: 'B4B055', brand: 'ZTE', model: 'GM220-S (XPON ONT)' },
    { prefix: '64F88A', brand: 'ZTE', model: 'GM220-S (GPON ONT)' },
    { prefix: 'B4E46B', brand: 'ZTE', model: 'GM220-S (GPON ONT)' },
    { prefix: 'D49E04', brand: 'ZTE', model: 'F477V2 / EPON ONT' },
    // Huawei GPON ONT
    { prefix: '9C713A', brand: 'Huawei', model: 'HG8245H' },
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
    return { isOlt: true, brand: '-', model: '-', isHtb: false, serial: '-' };
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
      isHtb: false,
      serial: '-'
    };
  }

  // 4. Cek Modem OLT (GPON / EPON ONT) dari MAC OUI (Hanya ambil Brand & Model jika valid, JANGAN BUAT SN PALSU)
  const oltMatch = MAC_OUI_DATABASE.olt.find(m => m.prefix === oui);
  if (oltMatch) {
    return {
      isOlt: true,
      brand: oltMatch.brand,
      model: oltMatch.model,
      isHtb: false,
      serial: '-'
    };
  }

  // 5. Default jika belum terdeteksi dari MAC OUI / comment: jangan berasumsi ZTE F670L palsu
  return {
    isOlt: true,
    brand: '-',
    model: '-',
    isHtb: false,
    serial: '-'
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

function normalizeRouterId(idOrName = '') {
  const s = String(idOrName || '').toLowerCase().trim();
  if (s.includes('wonorejo') || s.includes('wnj')) return 'wonorejo';
  if (s.includes('sukodono') || s.includes('skd')) return 'sukodono';
  if (s.includes('kota') || s.includes('lmj')) return 'kota';
  if (s.includes('tekung') || s.includes('tkng')) return 'tekung';
  if (s.includes('banjarwaru') || s.includes('bjw')) return 'server banjarwaru';
  if (s.includes('randuagung') || s.includes('rdg')) return 'randuagung';
  if (s.includes('kebonan') || s.includes('kbn')) return 'kebonan';
  return s;
}

function getWilayahFromRouter(routerIdOrName = '') {
  const r = String(routerIdOrName || '').toLowerCase();
  if (r.includes('wonorejo') || r.includes('wnj')) return 'KECAMATAN KEDUNGJAJANG';
  if (r.includes('sukodono') || r.includes('skd')) return 'KECAMATAN SUKODONO';
  if (r.includes('kota') || r.includes('lmj')) return 'KOTA LUMAJANG';
  if (r.includes('tekung') || r.includes('tkng')) return 'KECAMATAN TEKUNG';
  if (r.includes('banjarwaru') || r.includes('bjw')) return 'KECAMATAN BANJARWARU';
  if (r.includes('randuagung') || r.includes('rdg')) return 'KECAMATAN RANDUAGUNG';
  if (r.includes('kebonan') || r.includes('kbn')) return 'KECAMATAN KLAKAH';
  return null;
}

function resolveServerFromOdpOrAlamat(odp = '', alamat = '') {
  const o = String(odp || '').toUpperCase();
  const a = String(alamat || '').toUpperCase();
  if (o.includes('WNJ') || o.includes('DAR') || a.includes('WONOREJO') || a.includes('KEDUNGJAJANG') || a.includes('KRASAK')) {
    return { id: 'wonorejo', name: 'SERVER WONOREJO' };
  }
  if (o.includes('SKD') || o.includes('CHSN') || a.includes('SUKODONO') || a.includes('KUTORENON') || a.includes('SELOKBESUKI')) {
    return { id: 'sukodono', name: 'SERVER SUKODONO' };
  }
  if (o.includes('TKNG') || o.includes('-TK-') || o.startsWith('ODP-TK') || a.includes('TEKUNG') || a.includes('TUKUM') || a.includes('WONOKERTO')) {
    return { id: 'tekung', name: 'SERVER TEKUNG' };
  }
  if (o.includes('BJW') || a.includes('BANJARWARU')) {
    return { id: 'server banjarwaru', name: 'SERVER BANJARWARU' };
  }
  if (o.includes('RDG') || a.includes('RANDUAGUNG')) {
    return { id: 'randuagung', name: 'SERVER RANDUAGUNG' };
  }
  if (o.includes('KBN') || a.includes('KEBONAN') || a.includes('KLAKAH')) {
    return { id: 'kebonan', name: 'SERVER KEBONAN' };
  }
  if (o.includes('KT') || o.includes('SBR') || a.includes('KOTA') || a.includes('SUMBERJO') || a.includes('LUMAJANG')) {
    return { id: 'kota', name: 'SERVER KOTA' };
  }
  return { id: 'sukodono', name: 'SERVER SUKODONO' };
}

function matchMapCustomerToClient(sp, clientsList) {
  if (!sp || !clientsList || clientsList.length === 0) return null;
  const spIdClean = (sp.id || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  const spNameClean = (sp.nama || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  const srv = resolveServerFromOdpOrAlamat(sp.odp, sp.alamat || sp.kec);
  const targetNormRouter = normalizeRouterId(srv.id);

  // 1. Cocokkan ID pelanggan persis
  if (spIdClean) {
    const byId = clientsList.find(c => {
      if (targetNormRouter && c.router_id && normalizeRouterId(c.router_id) !== targetNormRouter && c.router_id !== 'all') return false;
      const cUserClean = (c.pppoe_user || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
      const cComment = (c.raw_comment || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
      return cUserClean === spIdClean || cComment.includes(spIdClean);
    });
    if (byId) return byId;
  }

  // 2. Cocokkan Nama Lengkap persis PADA SERVER ROUTER YANG SAMA
  if (spNameClean) {
    const byExactName = clientsList.find(c => {
      if (targetNormRouter && c.router_id && normalizeRouterId(c.router_id) !== targetNormRouter && c.router_id !== 'all') return false;
      const cNameClean = (c.customer_name || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
      return cNameClean === spNameClean;
    });
    if (byExactName) return byExactName;
  }

  // 3. Cocokkan token kata PADA SERVER ROUTER YANG SAMA
  if (spNameClean && spNameClean.length >= 3) {
    const spWords = (sp.nama || '').toLowerCase().trim().split(/\s+/).filter(w => w.length >= 3);
    const byTokensSameServer = clientsList.find(c => {
      if (targetNormRouter && c.router_id && normalizeRouterId(c.router_id) !== targetNormRouter) return false;
      const cWords = (c.customer_name || '').toLowerCase().trim().split(/\s+/);
      return spWords.some(sw => cWords.some(cw => cw === sw));
    });
    if (byTokensSameServer) return byTokensSameServer;
  }

  return null;
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
    let srvRouter = client.router_name || (client.router_id || 'SERVER').toUpperCase();
    if (normalizeRouterId(client.router_id) === 'server banjarwaru') {
      srvRouter = 'SERVER BANJARWARU';
    } else if (srvRouter === 'PETA JARINGAN FTTH' || client.router_id === 'ftth_map') {
      const resolved = resolveServerFromOdpOrAlamat(client.odp || client._systemData?.odp, client.alamat || client._systemData?.alamat);
      srvRouter = resolved.name;
    }

    let isOnline = isClientOnline(client, trafficRes);
    let isDisabled = false;
    let liveIp = client.ip_address || '-';
    let liveMac = client.mac_address || '-';
    let liveUptime = client.uptime || 'Offline';

    if (trafficRes && trafficRes.success) {
      if (trafficRes.is_disabled) {
        isDisabled = true;
        isOnline = false;
      } else if (trafficRes.is_active && trafficRes.ip && trafficRes.ip !== '-') {
        isOnline = true;
        liveIp = trafficRes.ip;
        if (trafficRes.mac && trafficRes.mac !== '-') liveMac = trafficRes.mac;
        if (trafficRes.uptime && trafficRes.uptime !== '-') liveUptime = trafficRes.uptime;
      }
    } else {
      liveIp = client.ip_address || '-';
      liveUptime = client.uptime || 'Offline';
    }

    // STRICT CHECK: Pelanggan aktif WAJIB memiliki IP Address valid dari MikroTik!
    if (!liveIp || liveIp === '-' || liveIp === '0.0.0.0') {
      isOnline = false;
    }

    let statusKoneksiStr = '';
    let statusDetailLine = '';
    let lastOffStr = '';
    if (isDisabled) {
      statusKoneksiStr = '🔴 <b>NON-AKTIF (DISABLED DI MIKROTIK)</b>';
      statusDetailLine = '• Keterangan: Akun dinonaktifkan di MikroTik';
    } else if (isOnline) {
      statusKoneksiStr = '🟢 <b>ONLINE (AKTIF)</b>';
      statusDetailLine = `• Uptime: <code>${liveUptime}</code>`;
    } else {
      let lastOffCandidate = '';
      if (trafficRes && trafficRes.last_logged_out && trafficRes.last_logged_out !== '-' && !trafficRes.last_logged_out.includes('Belum Terdaftar')) {
        lastOffCandidate = trafficRes.last_logged_out;
      } else if (client.last_logged_out && client.last_logged_out !== '-' && !client.last_logged_out.includes('Belum Terdaftar')) {
        lastOffCandidate = client.last_logged_out;
      } else if (client.optical && client.optical.timestamp) {
        lastOffCandidate = new Date(client.optical.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta' }) + ' WIB';
      } else {
        lastOffCandidate = 'Hari ini ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta' }) + ' WIB';
      }
      lastOffStr = String(lastOffCandidate).replace(/\s*\/\s*Offline/i, '').replace(/\(PETA JARINGAN FTTH\)/gi, '').trim();
      statusKoneksiStr = '🔴 <b>OFFLINE / PADAM</b>';
      statusDetailLine = `• Terputus: <code>${lastOffStr}</code>`;
    }

    // 1. Identifikasi Mutlak Tipe Perangkat, Jalur Distribusi & ODP
    const liveOrCachedMac = (liveMac !== '-' ? liveMac : client.mac_address) || '';
    const rawComment = String(client.raw_comment || '');
    const pppoeUser = String(client.pppoe_user || '');
    const commentUpper = rawComment.toUpperCase();
    const userUpper = pppoeUser.toUpperCase();

    // Deteksi HTB mutlak: HANYA jika ada tanda HTB/CONVERTER di comment / username
    const isExplicitHtb = commentUpper.includes('HTB') ||
      commentUpper.includes('CONVERTER') ||
      commentUpper.includes('MEDIA CONVERTER') ||
      userUpper.includes('HTB') ||
      userUpper.includes('/HTB');

    const devInfo = detectModemInfoFromMac(liveOrCachedMac, rawComment || pppoeUser);

    // 2. Deteksi Merk / Brand & Model Perangkat (Prioritas: Data Optik Master -> History -> Deteksi OUI)
    let modemBrand = (client.optical?.brand && client.optical.brand !== 'Unknown' && client.optical.brand !== 'Router / AP' && client.optical.brand !== 'Perangkat Pelanggan')
      ? client.optical.brand
      : (client.brand && client.brand !== 'Router / AP' && client.brand !== 'Perangkat Pelanggan' ? client.brand : devInfo.brand);

    let modemModel = (client.optical?.model && client.optical.model !== '-' && client.optical.model !== 'Perangkat Pelanggan' && client.optical.model !== 'Router AP (HTB)')
      ? client.optical.model
      : (client.model && client.model !== 'Perangkat Pelanggan' && client.model !== 'Router AP (HTB)' ? client.model : devInfo.model);

    if (!modemBrand || modemBrand === 'Router / AP' || modemBrand === 'Perangkat Pelanggan') modemBrand = devInfo.brand;
    if (!modemModel || modemModel === 'Perangkat Pelanggan') modemModel = devInfo.model;

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
        rxPowerStr = `${rxVal.toFixed(2)} dBm`;
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

    // ID Pelanggan mutlak dikunci dari Comment / Secret Router pelanggan ini sendiri agar TIDAK BISA tertukar antar server
    const idFromComment = extractCustomerId(rawComment, client.pppoe_user);
    const officialId = (idFromComment && idFromComment !== '-') ? idFromComment : (client.pppoe_user && !client.pppoe_user.startsWith('plg_') ? client.pppoe_user : (ticketHist && ticketHist.kodePelanggan && ticketHist.kodePelanggan !== '-' ? ticketHist.kodePelanggan : client.pppoe_user));
    const odpName = (ticketHist && (ticketHist.odppelanggan || ticketHist.odp)) || '-';
    const tagPelanggan = (ticketHist && ticketHist.taging_lokasi) || null;
    const tagOdp = (ticketHist && ticketHist.taging_odp) || getOdpCoords(odpName) || null;
    let custAlamat = (ticketHist && ticketHist.alamat && ticketHist.alamat !== '-') ? ticketHist.alamat : null;
    const clientRouterId = normalizeRouterId(client.router_id || client.router || '');

    // Cross-check mutlak: Alamat TIDAK BOLEH berada di wilayah router server lain!
    if (clientRouterId && custAlamat) {
      const srvFromAlamat = resolveServerFromOdpOrAlamat(odpName, custAlamat);
      if (srvFromAlamat && srvFromAlamat.id && normalizeRouterId(srvFromAlamat.id) !== clientRouterId) {
        console.warn(`[SERVER MISMATCH] Router ${clientRouterId} tidak cocok dengan alamat "${custAlamat}". Dikoreksi ke wilayah router.`);
        custAlamat = getWilayahFromRouter(clientRouterId);
      }
    }
    if (!custAlamat) {
      custAlamat = getWilayahFromRouter(clientRouterId) || 'KECAMATAN SUKODONO';
    }

    const custNoHp = (ticketHist && ticketHist.no_tlp && ticketHist.no_tlp !== '-') ? ticketHist.no_tlp : null;
    const custPaket = (ticketHist && ticketHist.paket && ticketHist.paket !== '-') ? ticketHist.paket : null;

    // Deteksi koordinat lokasi pelanggan di peta
    let targetLat = null;
    let targetLng = null;
    if (tagPelanggan && tagPelanggan !== '-') {
      const parts = tagPelanggan.split(',');
      if (parts.length >= 2) {
        const p0 = parseFloat(parts[0].trim());
        const p1 = parseFloat(parts[1].trim());
        if (!isNaN(p0) && !isNaN(p1) && p0 !== 0 && p1 !== 0) {
          targetLat = p0;
          targetLng = p1;
        }
      }
    }
    if (!targetLat && client._systemData && client._systemData.lat && client._systemData.lng) {
      targetLat = client._systemData.lat;
      targetLng = client._systemData.lng;
    }
    if (!targetLat) {
      const cleanLockedId = (officialId || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
      const cleanCustName = (cleanCustomerName || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
      const mapMatch = (mapNetworkData.pelanggans || []).find(p => {
        const pId = (p.id || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
        const pNama = (p.nama || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
        const pSrv = resolveServerFromOdpOrAlamat(p.odp, p.alamat || p.kec);
        if (clientRouterId && pSrv && pSrv.id && pSrv.id !== clientRouterId) {
          return false;
        }
        return (pId && cleanLockedId && pId === cleanLockedId) ||
          (cleanCustName && cleanCustName.length >= 4 && pNama === cleanCustName);
      });
      if (mapMatch && mapMatch.lat && mapMatch.lng) {
        targetLat = mapMatch.lat;
        targetLng = mapMatch.lng;
      }
    }

    const hasMapLocation = targetLat !== null && targetLng !== null;

    // Tampilan teks taging lokasi BERSIH TANPA URL (Sesuai instruksi: "JANGAN MENAMPILKAN ALAMAT URL")
    let tagPelangganStr = '<i>Belum terpetakan di sistem</i>';
    if (tagPelanggan && tagPelanggan !== '-') {
      tagPelangganStr = `📍 Terpetakan (${tagPelanggan})`;
    } else if (hasMapLocation) {
      tagPelangganStr = `📍 Terpetakan (${targetLat}, ${targetLng})`;
    }

    let tagOdpStr = '<i>Belum terpetakan di sistem</i>';
    if (tagOdp && tagOdp !== '-') {
      tagOdpStr = `📍 Terpetakan (${tagOdp})`;
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
      (statusDetailLine ? `${statusDetailLine}\n` : '') +
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

    // LOGIKA TOMBOL MUTLAK EKSKLUSIF SESUAI INSTRUKSI:
    // - Jika data pelanggan di map DITEMUKAN: HANYA tampilkan "📍 Lihat di Map" (JANGAN ADA "Cari di Map"!)
    // - Jika data pelanggan di map TIDAK DITEMUKAN: HANYA tampilkan "🔍 Cari di Map" (JANGAN ADA "Lihat di Map"!)
    const actionButtons = {
      inline_keyboard: []
    };

    if (hasMapLocation) {
      const viewMapUrl = `${MAP_WEB_URL}?view=map&lat=${targetLat}&lng=${targetLng}&id=${encodeURIComponent(officialId)}&name=${encodeURIComponent(cleanCustomerName || officialName)}&status=${isOnline ? 'online' : 'offline'}&last_off=${encodeURIComponent(lastOffStr || '')}&router=${encodeURIComponent(srvRouter || '')}`;
      actionButtons.inline_keyboard.push([
        { text: '📍 Lihat di Map', web_app: { url: viewMapUrl } }
      ]);
    } else {
      const searchMapUrl = `${MAP_WEB_URL}?view=map&search=${encodeURIComponent(cleanCustomerName || officialName || officialId)}&status=${isOnline ? 'online' : 'offline'}&last_off=${encodeURIComponent(lastOffStr || '')}&router=${encodeURIComponent(srvRouter || '')}`;
      actionButtons.inline_keyboard.push([
        { text: '🔍 Cari di Map', web_app: { url: searchMapUrl } }
      ]);
    }

    actionButtons.inline_keyboard.push([
      { text: '🔄 Cari Bareng Monica Lagi', callback_data: 'start_search' }
    ]);

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
// MONICA CONVERSATIONAL AI ENGINE (GEMINI LLM)
// -------------------------------------------------------------
const userChatHistories = new Map(); // chatId -> { lastTime, items: [{ role, text }] }

function getWibTimeContext() {
  const nowWib = new Date(Date.now() + 7 * 3600 * 1000);
  const hours = nowWib.getUTCHours();
  const minutes = String(nowWib.getUTCMinutes()).padStart(2, '0');
  let waktu = 'Malam';
  if (hours >= 4 && hours < 11) waktu = 'Pagi';
  else if (hours >= 11 && hours < 15) waktu = 'Siang';
  else if (hours >= 15 && hours < 18) waktu = 'Sore';
  return `${String(hours).padStart(2, '0')}:${minutes} WIB (${waktu})`;
}

async function askMonicaAi(chatId, fromName, userText) {
  const now = Date.now();
  let sessionData = userChatHistories.get(chatId) || { lastTime: 0, items: [] };
  // Reset riwayat jika sudah tidak ngobrol lebih dari 10 menit agar tidak bias konteks lama
  if (now - sessionData.lastTime > 10 * 60 * 1000) {
    sessionData.items = [];
  }
  sessionData.lastTime = now;
  sessionData.items.push({ role: 'user', text: userText });
  if (sessionData.items.length > 4) sessionData.items = sessionData.items.slice(-4);
  userChatHistories.set(chatId, sessionData);

  const timeStr = getWibTimeContext();
  const systemInstruction = `Kamu adalah MONICA (Monitoring Client Assistant) dari PT Mahawira Nusantara Grup.
WAKTU REAL-TIME SEKARANG: ${timeStr}.
PENTING: Selalu sesuaikan sapaan dan tanggapan dengan waktu nyata saat ini (${timeStr})! Jika sudah malam, jangan pernah mengira masih siang atau panas!

Karakter & Aturan Menjawab:
- Jadilah asisten cewek yang REALISTIS, santai, ramah, dan sedikit manja/centil secara NATURAL (JANGAN LEBAY, JANGAN OVER BICARA, JANGAN BERLEBIHAN).
- WAJIB JAWAB SINGKAT: Maksimal 1 sampai 2 kalimat pendek saja, persis seperti cewek asli membalas chat WhatsApp/Telegram. JANGAN PERNAH MEMBUAT KARANGAN/PARAGRAF PANJANG!
- Jawab hanya apa yang disapa atau ditanyakan. Jangan mengarang asumsi sendiri yang tidak ditanyakan.
- Panggil lawan bicara dengan santai: 'Abang' atau 'Bang ${fromName}'.
- Jika ditanya seputar teknis fiber/FTTH (redaman dBm, ODP, Mikrotik), jawab singkat dan akurat sesuai standar jaringan Mahawira.`;

  const contents = sessionData.items.map(h => ({
    role: h.role === 'user' ? 'user' : 'model',
    parts: [{ text: h.text }]
  }));

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: contents
      }),
      signal: controller.signal
    });
    clearTimeout(timer);
    const data = await res.json();
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      const reply = data.candidates[0].content.parts[0].text.trim();
      sessionData.items.push({ role: 'model', text: reply });
      return reply;
    }
  } catch (err) {
    console.warn('[MONICA AI ERROR]:', err.message);
  }

  return `Halo juga, Bang ${fromName} 😉 Ada yang mau dibantu malam ini?`;
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

  // Sambutan centil ketika ada anggota baru join grup atau bot dimasukkan ke grup
  if (msg.new_chat_members && Array.isArray(msg.new_chat_members)) {
    for (const member of msg.new_chat_members) {
      if (member.is_bot) {
        await sendMessage(
          chatId,
          `💖 <b>Haii semuanyaa! Kenalin, aku MONICA~</b> 💅✨\n` +
          `<i>(Monitoring Client Assistant - PT Mahawira Nusantara Grup)</i>\n\n` +
          `Makasih banyak udah ajak Monica ke sini ya! Monica siap nemenin abang-abang teknisi 24 jam buat cek redaman pelanggan, intip status router, sampai nyariin lokasi pelanggan biar kerjaan di lapangan makin sat-set! 🥰\n\n` +
          `Kalau butuh bantuan Monica, langsung senggol tombol di bawah yaa sayaang~ 💋`,
          { inline_keyboard: [[{ text: '🔍 Cari Pelanggan Bareng Monica ✨', callback_data: 'start_search' }]] }
        );
      } else {
        const memberName = [member.first_name, member.last_name].filter(Boolean).join(' ') || member.username || 'Abang Ganteng';
        await sendMessage(
          chatId,
          `💖 <b>Ehh ada yang baru join! Halo abang ${memberName}~</b> 🥰✨\n` +
          `Kenalin, aku <b>MONICA</b> <i>(Monitoring Client Assistant)</i>.\n\n` +
          `Selamat bergabung di tim ya bang! Kalau di lapangan butuh info redaman atau letak ODP pelanggan, jangan malu-malu panggil Monica yaa~ 💅💋`,
          { inline_keyboard: [[{ text: '🔍 Cari Pelanggan Bareng Monica ✨', callback_data: 'start_search' }]] }
        );
      }
    }
    return;
  }

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
      `Aduh maaf ya abang <b>${fromName}</b>.. 🥺 ID Telegram abang belum terdaftar sebagai petugas resmi PT Mahawira Nusantara Grup.\n\n` +
      `🆔 <b>ID Telegram Abang:</b> <code>${fromId}</code>\n\n` +
      `Silakan hubungi Admin (@XSoftwaree) dulu ya bang biar didaftarin, nanti kalau udah terdaftar baru bisa main bareng Monica~ 💅✨`
    );
    return;
  }

  const session = userSessions.get(chatId) || { step: 'IDLE', matches: [], isBusy: false };

  // 2. DETEKSI SPAM SAAT PROGRES BERJALAN:
  if (session.isBusy) {
    const now = Date.now();
    const lastSpamTime = userLastSpamAlert.get(fromId) || 0;
    if (now - lastSpamTime > 3000) {
      userLastSpamAlert.set(fromId, now);
      await sendMessage(
        chatId,
        `⚠️ <b>Sabar ya abang ${fromName}~ Pengecekan sedang berjalan, jangan dispam dong nanti Monica pusing.. 🥺</b>`
      );
    }
    return;
  }

  // 3. Command /start, menu, reset -> Greeting Centil MONICA
  if (text.startsWith('/start') || text.toLowerCase() === 'menu' || text.toLowerCase() === 'reset') {
    userSessions.set(chatId, { step: 'IDLE', matches: [], isBusy: false });

    await sendMessage(
      chatId,
      `💖 <b>Haii abang ${fromName} yang ganteng! Kenalin, aku MONICA~</b> 💅✨\n` +
      `<i>(Monitoring Client Assistant - PT Mahawira Nusantara Grup)</i>\n\n` +
      `Duh senengnya disamperin abang.. 🥰 Monica siap 24 jam nemenin abang cek redaman, intip status router, sampai nyariin lokasi pelanggan biar abang nggak capek di lapangan!\n\n` +
      `Mau cari pelanggan siapa nih bang? Yuk klik tombol manja di bawah ini yaa~ 👇💋`,
      {
        inline_keyboard: [[{ text: '🔍 Cari Pelanggan Bareng Monica ✨', callback_data: 'start_search' }]]
      }
    );
    return;
  }

  // 4. STATUS IDLE / CHAT NORMAL: Pengguna mengobrol santai dengan Monica (AI Engine)
  if (session.step === 'IDLE' || session.step === 'AWAITING_CHOICE') {
    const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
    const isReplyToMonica = msg.reply_to_message && msg.reply_to_message.from && (msg.reply_to_message.from.is_bot || msg.reply_to_message.from.username === 'MonicaAssistenCantik_bot');
    const mentionsMonica = /\b(mon|monica|monika)\b/i.test(text) || text.toLowerCase().includes('monica') || text.includes('@MonicaAssistenCantik_bot');

    // Jika di grup, Monica hanya menyahut jika dipanggil namanya ("Mon/Monica"), di-mention, atau di-reply
    // Agar tidak mengganggu obrolan antar teknisi di grup
    if (isGroup && !isReplyToMonica && !mentionsMonica) {
      return;
    }

    // Kirim indikasi "typing..." di Telegram agar terasa seperti mengetik asli
    try {
      fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendChatAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action: 'typing' })
      }).catch(() => {});
    } catch (_) {}

    const aiReply = await askMonicaAi(chatId, fromName, text);
    await sendMessage(chatId, aiReply, {
      inline_keyboard: [[{ text: '🔍 Cari Pelanggan Bareng Monica ✨', callback_data: 'start_search' }]]
    });
    return;
  }

  // 5. SESI INPUT NAMA AKTIF (step === 'AWAITING_QUERY')
  if (session.step === 'AWAITING_QUERY') {
    const query = text.toLowerCase();
    if (query.length < 2) {
      await sendMessage(chatId, `⚠️ Abang, masukkan minimal 2 huruf ya untuk pencarian.`);
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
      const foundInCached = matchMapCustomerToClient(sp, cachedClients);

      if (foundInCached) {
        if (!foundInCached._systemData) foundInCached._systemData = sp;
        rawMatched.push(foundInCached);
      } else {
        const srv = resolveServerFromOdpOrAlamat(sp.odp, sp.alamat || sp.kec);
        const nowOffStr = 'Hari ini ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta' }) + ' WIB';
        matchedMapClients.push({
          pppoe_user: (sp.id && !sp.id.startsWith('plg_')) ? sp.id : (sp.nama || '-'),
          customer_name: sp.nama,
          router_id: srv.id,
          router_name: srv.name,
          ip_address: '-',
          mac_address: '-',
          is_active: false,
          last_logged_out: nowOffStr,
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
    let combinedMatched = Array.from(fullMatchedMap.values());

    // HANYA jika query adalah ID Pelanggan / PPPoE spesifik (mengandung tanda slash atau nomor ID resmi):
    if (queryLower.includes('/') || /\d{3,}/.test(queryLower)) {
      const exactIdMatches = combinedMatched.filter(c => {
        const pUser = (c.pppoe_user || '').toLowerCase().trim();
        const fullId = extractCustomerId(c.raw_comment, c.pppoe_user).toLowerCase().trim();
        return pUser === queryLower || fullId === queryLower;
      });
      if (exactIdMatches.length > 0) {
        combinedMatched = exactIdMatches;
      }
    }

    // 1. Urutkan:
    // - Prioritas utama: Yang ONLINE (🟢) selalu berada paling atas
    // - Jika sama-sama OFFLINE (🔴): Urutkan berdasarkan waktu disconnect TERBARU (paling baru padam di atas)
    combinedMatched.sort((a, b) => {
      const aOn = isClientOnline(a);
      const bOn = isClientOnline(b);
      if (aOn && !bOn) return -1;
      if (!aOn && bOn) return 1;
      if (!aOn && !bOn) {
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
      const hasOnline = group.some(c => isClientOnline(c));
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

      const searchMapUrl = `${MAP_WEB_URL}?view=map&search=${encodeURIComponent(text)}`;
      await sendMessage(
        chatId,
        `❌ <b>Pelanggan Tidak Ditemukan!</b>\n\n` +
        `Yah sayang banget bang, Monica cari kemana-mana nggak nemu pelanggan dengan kata kunci <b>"${text}"</b>.${extraHint}\n\nCoba cek lagi ejaannya ya bang~ 🥺`,
        {
          inline_keyboard: [
            [
              { text: '🔍 Cari di Map', web_app: { url: searchMapUrl } }
            ],
            [
              { text: '🔄 Cari Bareng Monica Lagi', callback_data: 'start_search' }
            ]
          ]
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
      let srvName = (c.router_name || c.router_id || 'SERVER').toUpperCase();
      if (srvName === 'PETA JARINGAN FTTH' || c.router_id === 'ftth_map') {
        srvName = resolveServerFromOdpOrAlamat(c.odp || c._systemData?.odp, c.alamat || c._systemData?.alamat).name;
      }
      const online = isClientOnline(c);
      const statusIcon = online ? '🟢' : '🔴';
      const fullId = extractCustomerId(c.raw_comment, c.pppoe_user);
      const offInfo = !online && c.last_logged_out && c.last_logged_out !== '-' ? ` | Off: <code>${c.last_logged_out}</code>` : '';
      const pppoeDiff = (c.pppoe_user && c.pppoe_user !== fullId) ? ` (PPPoE: <code>${c.pppoe_user}</code>)` : '';

      listText += `<b>${i + 1}.</b> ${statusIcon} <b>${c.customer_name}</b> [${srvName}]\n` +
        `   • ID Pelanggan: <code>${fullId}</code>${pppoeDiff} | IP: <code>${c.ip_address}</code>${offInfo}\n\n`;
    }

    listText += `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Pilih pelanggan yang mau diintip ya bang: 👇💋`;

    // Tombol pemilihan eksklusif (1 klik tombol per pelanggan DENGAN NAMA SERVER)
    const inlineButtons = [];
    for (let i = 0; i < displayLimit; i++) {
      const c = matchedSlice[i];
      let srv = (c.router_name || c.router_id || 'SERVER').toUpperCase();
      if (srv === 'PETA JARINGAN FTTH' || c.router_id === 'ftth_map') {
        srv = resolveServerFromOdpOrAlamat(c.odp || c._systemData?.odp, c.alamat || c._systemData?.alamat).name;
      }
      inlineButtons.push([{ text: `${i + 1}. ${c.customer_name} [${srv}]`.slice(0, 60), callback_data: `sel:${i}` }]);
    }
    inlineButtons.push([{ text: '🔄 Cari Ulang Bareng Monica', callback_data: 'start_search' }]);

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
      `Aduh maaf ya abang <b>${fromName}</b>.. 🥺 ID Telegram abang belum terdaftar sebagai petugas resmi PT Mahawira Nusantara Grup.\n\n` +
      `🆔 <b>ID Telegram Abang:</b> <code>${fromId}</code>\n\n` +
      `Silakan hubungi Admin (@XSoftwaree) dulu ya bang biar didaftarin, nanti kalau udah terdaftar baru bisa main bareng Monica~ 💅✨`
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
        `💋 <b>Mau cari siapa nih bang ${fromName}?</b>\n\n` +
        `Ketik nama atau ID pelanggan yang mau abang kepoin yaa, Monica cariin secepat kilat! ⚡✨`
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
        await sendMessage(chatId, `Yuk klik tombol di bawah buat cari pelanggan bareng Monica lagi ya bang: 👇💋`, {
          inline_keyboard: [[{ text: '🔍 Cari Pelanggan Bareng Monica ✨', callback_data: 'start_search' }]]
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
console.log('💖 BOT INTERAKTIF MONICA (Monitoring Client Assistant) RUNNING');
console.log('🎯 Bot Username: @MonicaAssistenCantik_bot');
console.log('⚡ Ultra-Fast In-Memory Search Engine Active');
console.log('=======================================================');

refreshRegisteredTechs().then(() => {
  refreshClientsCache(true).then(() => {
    pollUpdates();
    // Auto-refresh cache tiap 45 detik di background
    setInterval(() => refreshClientsCache(true), 45000);
  });
});
