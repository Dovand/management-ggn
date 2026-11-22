// modem_service.js - Service Backend Cek Modem & Mikrotik PPPoE untuk Dashboard NOC Mahawira
// Dilengkapi: Multi-Kredensial Superadmin, Riwayat Redaman, Status LOS/DyingGasp, & Histori Modem Mati

const http = require('http');
const net = require('net');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const url = require('url');
const querystring = require('querystring');

const PORT = 7878;
const DATA_DIR = path.resolve(__dirname, 'data');
const OPTICAL_HISTORY_FILE = path.join(DATA_DIR, 'modem_optical_history.json');
const DISCONNECT_HISTORY_FILE = path.join(DATA_DIR, 'modem_disconnect_history.json');
const TRAFFIC_HISTORY_FILE = path.join(DATA_DIR, 'modem_traffic_history.json');

// Pastikan direktori data ada
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Global Exception Handler agar service daemon tidak pernah crash oleh socket timeout / network hiccup
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err && err.message ? err.message : err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason && reason.message ? reason.message : reason);
});

// Router Configurations & Persistent Storage
const ROUTERS_FILE = path.join(DATA_DIR, 'routers.json');

function loadRouters() {
  try {
    if (fs.existsSync(ROUTERS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(ROUTERS_FILE, 'utf8'));
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) { }
  return [
    {
      id: 'wonorejo',
      name: 'SERVER WONOREJO',
      host: '103.76.108.2',
      port: 1122,
      user: 'mhw_.01',
      pass: process.env.ROUTER_WONOREJO_PASS || '',
      vpn_name: 'SERVER WONOREJO',
      vpn_user: 'PC ADMIN',
      enabled: true
    },
    {
      id: 'sukodono',
      name: 'SERVER SUKODONO',
      host: '103.76.108.11',
      port: 1111,
      user: 'mahawira',
      pass: process.env.ROUTER_SUKODONO_PASS || '',
      vpn_name: 'SERVER SUKODONO',
      vpn_user: 'PC ADMIN',
      enabled: true
    }
  ];
}

let ROUTERS = loadRouters();

function saveRouters() {
  try {
    fs.writeFileSync(ROUTERS_FILE, JSON.stringify(ROUTERS, null, 2), 'utf8');
  } catch (err) {
    console.error('Gagal menyimpan routers.json:', err.message);
  }
}

function getActiveRouters() {
  return ROUTERS.filter(r => r.enabled !== false);
}

// In-memory cache status kesehatan server router
const routerHealthCache = new Map(); // routerId -> { online, cpu_load, free_memory, uptime, active_pppoe, latency, timestamp }

// In-memory cache for optical check results
const opticalCache = new Map(); // ip -> { data, timestamp }

// OLT C300 Configurations & ONU Cache
const OLT_CACHE_FILE = path.join(DATA_DIR, 'olt_onu_cache.json');
const OLT_CONFIG = {
  host: process.env.OLT_HOST || '103.76.108.11',
  port: parseInt(process.env.OLT_PORT || '4444', 10),
  user: process.env.OLT_USER || 'zte',
  pass: process.env.OLT_PASS || 'zte'
};

function normName(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Load persistent history
function loadHistory(file) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8')) || {};
    }
  } catch (_) { }
  return {};
}

let oltOnuCache = loadHistory(OLT_CACHE_FILE);
const oltMacCache = new Map();

// Inisialisasi awal tabel MAC OLT penting
oltMacCache.set('D8E84474CA40', 'gpon-onu_1/13/1:10'); // STAR_NET
oltMacCache.set('001146EB8BC5', 'gpon-onu_1/13/1:9');  // STARNET

function findOltOnu(userName, ip, mac) {
  if (!oltOnuCache || typeof oltOnuCache !== 'object') return null;
  const values = Object.values(oltOnuCache);

  // 1. Cek MAC Address di tabel MAC OLT atau olt_mac_to_port.json
  const cleanMac = String(mac || '').replace(/[^A-Fa-f0-9]/g, '').toUpperCase();
  if (cleanMac && cleanMac.length >= 10) {
    try {
      const macMapPath = path.resolve(__dirname, 'data/olt_mac_to_port.json');
      if (fs.existsSync(macMapPath)) {
        const macMap = JSON.parse(fs.readFileSync(macMapPath, 'utf8'));
        const mappedPort = macMap[cleanMac];
        if (mappedPort) {
          return oltOnuCache[mappedPort] || {
            onu: mappedPort,
            type: mappedPort.startsWith('epon') ? 'epon' : 'gpon',
            sn: cleanMac,
            brand: 'ZTE',
            model: 'ONT F677'
          };
        }
      }
    } catch (_) {}
    const onuKey = oltMacCache.get(cleanMac);
    if (onuKey && oltOnuCache[onuKey]) {
      return oltOnuCache[onuKey];
    }
  }

  // 2. Pemetaan spesifik untuk akun ATMINAH / 387
  const uNorm = normName(userName);
  if (userName === '387/RTL/WNJ-003/012' || (uNorm && uNorm.includes('387')) || ip === '192.168.120.132') {
    return oltOnuCache['epon-onu_1/4/8:10'] || {
      onu: 'epon-onu_1/4/8:10',
      type: 'epon',
      sn: '001146678D5D',
      mac: '00:11:46:67:8D:5D',
      name: '387/RTL/WNJ-003/012 // ATMINAH',
      state: 'ready',
      brand: 'ZTE',
      model: 'F677'
    };
  }

  // 3. Pemetaan spesifik untuk akun STAR_NET vs STARNET (dua ONT berbeda di Mitra Sukodono)
  if (userName === 'STAR_NET' || ip === '192.168.121.182') {
    return oltOnuCache['gpon-onu_1/13/1:10'] || {
      onu: 'gpon-onu_1/13/1:10',
      sn: 'ZTEGD33102BB',
      name: 'STAR_NET',
      state: 'ready',
      brand: 'ZTE',
      model: 'F677'
    };
  }

  if (userName === 'STARNET' || ip === '192.168.121.183') {
    return oltOnuCache['gpon-onu_1/13/1:9'] || {
      onu: 'gpon-onu_1/13/1:9',
      sn: 'ZTEGCF978012',
      name: 'STARNET',
      state: 'ready',
      brand: 'ZTE',
      model: 'F677'
    };
  }

  if (uNorm) {
    const directMatch = values.find(v => normName(v.name) === uNorm);
    if (directMatch) return directMatch;
  }

  return null;
}

// OLT ACCESS COMPLETELY DISABLED - HANYA MONITORING DAN CEK DARI PERANGKAT MODEM & MIKROTIK
function execOlt(commands) {
  return Promise.resolve('');
}

async function queryOltOptical(onuInterface) {
  return null;
}

async function rebootOnuOlt(onuInterface) {
  return { success: false, message: 'Akses OLT dinonaktifkan (perintah reboot langsung ke modem)' };
}

let opticalSaveTimer = null;
function scheduleSaveOpticalHistory() {
  if (opticalSaveTimer) return;
  opticalSaveTimer = setTimeout(() => {
    opticalSaveTimer = null;
    fs.promises.writeFile(OPTICAL_HISTORY_FILE, JSON.stringify(opticalHistory, null, 2), 'utf8')
      .catch(err => console.error('Gagal simpan optical history:', err.message));
  }, 1000);
}

let disconnectSaveTimer = null;
function scheduleSaveDisconnectHistory() {
  if (disconnectSaveTimer) return;
  disconnectSaveTimer = setTimeout(() => {
    disconnectSaveTimer = null;
    fs.promises.writeFile(DISCONNECT_HISTORY_FILE, JSON.stringify(disconnectHistory, null, 2), 'utf8')
      .catch(err => console.error('Gagal simpan disconnect history:', err.message));
  }, 1000);
}

let opticalHistory = loadHistory(OPTICAL_HISTORY_FILE);
let disconnectHistory = loadHistory(DISCONNECT_HISTORY_FILE);
let trafficHistory = loadHistory(TRAFFIC_HISTORY_FILE);

let trafficSaveTimer = null;
function scheduleSaveTrafficHistory() {
  if (trafficSaveTimer) return;
  trafficSaveTimer = setTimeout(() => {
    trafficSaveTimer = null;
    fs.promises.writeFile(TRAFFIC_HISTORY_FILE, JSON.stringify(trafficHistory, null, 2), 'utf8')
      .catch(err => console.error('Gagal simpan traffic history:', err.message));
  }, 3000);
}

// Cache in-memory untuk klien aktif dan pelacak status online/offline
const clientsMemoryCache = new Map();
const activeClientTracker = new Map(); // username -> { isActive, ip, mac, lastSeen, lastOff }

// Record optical reading to history
function recordOpticalHistory(key, record) {
  if (!key) return;
  if (!opticalHistory[key]) {
    opticalHistory[key] = [];
  }
  const historyList = opticalHistory[key];
  historyList.unshift(record);
  if (historyList.length > 50) {
    historyList.length = 50; // simpan maks 50 entri per pelanggan
  }
  scheduleSaveOpticalHistory();
}

// Record disconnect / ON-OFF events to persistent history
function recordDisconnectHistory(key, record) {
  if (!key) return;
  if (!disconnectHistory[key]) {
    disconnectHistory[key] = [];
  }
  const historyList = disconnectHistory[key];

  // Cegah duplikat entri jika waktu logged_out sama persis atau sangat berdekatan
  const recTime = record.logged_out || record.timestamp;
  const isDuplicate = historyList.some(h => {
    const hTime = h.logged_out || h.timestamp;
    return hTime === recTime || (h.reason === record.reason && Math.abs(new Date(hTime || 0) - new Date(recTime || 0)) < 60000);
  });

  if (!isDuplicate) {
    historyList.unshift(record);
    if (historyList.length > 50) {
      historyList.length = 50;
    }
    scheduleSaveDisconnectHistory();
  }
}

// ==========================================
// MIKROTIK PROTOCOL IMPLEMENTATION
// ==========================================
function encodeLength(len) {
  if (len < 0x80) return Buffer.from([len]);
  if (len < 0x4000) return Buffer.from([(len >> 8) | 0x80, len & 0xff]);
  if (len < 0x200000) return Buffer.from([(len >> 16) | 0xc0, (len >> 8) & 0xff, len & 0xff]);
  if (len < 0x10000000) return Buffer.from([(len >> 24) | 0xe0, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff]);
  throw new Error(`Word length too large: ${len}`);
}

function encodeWord(word) {
  const buf = Buffer.from(word, 'utf8');
  return Buffer.concat([encodeLength(buf.length), buf]);
}

function encodeSentence(words) {
  const parts = words.map(w => encodeWord(w));
  parts.push(Buffer.from([0x00]));
  return Buffer.concat(parts);
}

class MikroTikClient {
  constructor(host, port, timeout = 7000) {
    this.host = host;
    this.port = parseInt(port, 10);
    this.timeout = timeout;
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.connected = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();
      this.socket.setTimeout(this.timeout);

      this.socket.on('connect', () => {
        this.connected = true;
        this.socket.setTimeout(0);
        resolve();
      });
      this.socket.on('timeout', () => {
        this.connected = false;
        this.socket.destroy();
        reject(new Error(`Timeout connecting to ${this.host}:${this.port}`));
      });
      this.socket.on('error', (err) => {
        this.connected = false;
        reject(err);
      });
      this.socket.connect(this.port, this.host);
    });
  }

  _readLength() {
    if (this.buffer.length === 0) return null;
    const b1 = this.buffer[0];
    if ((b1 & 0x80) === 0) {
      return { length: b1, bytesConsumed: 1 };
    } else if ((b1 & 0xc0) === 0x80) {
      if (this.buffer.length < 2) return null;
      return { length: ((b1 & 0x3f) << 8) | this.buffer[1], bytesConsumed: 2 };
    } else if ((b1 & 0xe0) === 0xc0) {
      if (this.buffer.length < 3) return null;
      return { length: ((b1 & 0x1f) << 16) | (this.buffer[1] << 8) | this.buffer[2], bytesConsumed: 3 };
    } else if ((b1 & 0xf0) === 0xe0) {
      if (this.buffer.length < 4) return null;
      return { length: ((b1 & 0x0f) << 24) | (this.buffer[1] << 16) | (this.buffer[2] << 8) | this.buffer[3], bytesConsumed: 4 };
    }
    return null;
  }

  _readWord() {
    const lenInfo = this._readLength();
    if (!lenInfo) return null;
    const totalNeeded = lenInfo.bytesConsumed + lenInfo.length;
    if (this.buffer.length < totalNeeded) return null;
    const wordBuf = this.buffer.slice(lenInfo.bytesConsumed, totalNeeded);
    this.buffer = this.buffer.slice(totalNeeded);
    return wordBuf.toString('utf8');
  }

  _readSentence() {
    const words = [];
    while (true) {
      if (this.buffer.length === 0) return null;
      if (this.buffer[0] === 0x00) {
        this.buffer = this.buffer.slice(1);
        return words;
      }
      const word = this._readWord();
      if (word === null) return null;
      words.push(word);
    }
  }

  write(words) {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.socket) return reject(new Error('Socket not connected'));
      const results = [];
      let doneAttributes = null;

      const onData = (chunk) => {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        while (true) {
          const sentence = this._readSentence();
          if (!sentence) break;
          const type = sentence[0];
          if (type === '!re') {
            const item = {};
            for (let i = 1; i < sentence.length; i++) {
              const word = sentence[i];
              if (word.startsWith('=')) {
                const eqIdx = word.indexOf('=', 1);
                if (eqIdx !== -1) {
                  item[word.substring(1, eqIdx)] = word.substring(eqIdx + 1);
                }
              }
            }
            results.push(item);
          } else if (type === '!done') {
            doneAttributes = {};
            for (let i = 1; i < sentence.length; i++) {
              const word = sentence[i];
              if (word.startsWith('=')) {
                const eqIdx = word.indexOf('=', 1);
                if (eqIdx !== -1) {
                  doneAttributes[word.substring(1, eqIdx)] = word.substring(eqIdx + 1);
                }
              }
            }
            cleanup();
            return resolve({ done: true, doneAttributes, results });
          } else if (type === '!trap') {
            cleanup();
            return reject(new Error('MikroTik trap error'));
          }
        }
      };

      const onError = (err) => { cleanup(); reject(err); };
      const cleanup = () => {
        if (this.socket) {
          this.socket.removeListener('data', onData);
          this.socket.removeListener('error', onError);
        }
      };

      this.socket.on('data', onData);
      this.socket.on('error', onError);
      this.socket.write(encodeSentence(words));
    });
  }

  async login(user, password) {
    const res1 = await this.write(['/login', `=name=${user}`, `=password=${password}`]);
    if (res1.done) {
      if (!res1.doneAttributes || !res1.doneAttributes.ret) return true;
      const challenge = res1.doneAttributes.ret;
      const chalBuf = Buffer.from(challenge, 'hex');
      const passBuf = Buffer.from(password, 'utf8');
      const md5 = crypto.createHash('md5');
      md5.update(Buffer.from([0x00]));
      md5.update(passBuf);
      md5.update(chalBuf);
      const digest = '00' + md5.digest('hex');
      const res2 = await this.write(['/login', `=name=${user}`, `=response=${digest}`]);
      if (res2.done) return true;
    }
    throw new Error('Login failed');
  }

  close() {
    if (this.socket) {
      try { this.socket.destroy(); } catch (_) { }
    }
    this.connected = false;
  }
}

// ==========================================
// MODEM SUPERADMIN & INSPECTOR
// ==========================================
function decodeHtmlEntities(str) {
  if (!str) return '';
  return str.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

// Deteksi otomatis Merk / Brand & Serial Number dari MAC Address (OUI)
function detectModemInfoFromMac(mac) {
  if (!mac || mac === '-') return { brand: 'ZTE', serial: '-' };
  const cleanMac = mac.replace(/[^A-Fa-f0-9]/g, '').toUpperCase();
  const oui = cleanMac.slice(0, 6);

  const huaweiOuis = [
    '001E10', '00259E', '0819A6', '101B54', '104780', '14B968', '200889', '20F3A3',
    '2469A5', '283152', '285FDB', '308730', '342EB6', '404D8E', '4482E5', '48435A',
    '485702', '4C5499', '548998', '7054F5', '74882A', '80B655', '888603', '8C34FD',
    '9017AC', '94049C', 'A4BE2B', 'B41513', 'C8D15B', 'D440F0', 'D8490B', 'E0247F',
    'E09796', 'EC233D', 'F4C4D5', 'F84ABF'
  ];
  const fiberhomeOuis = [
    '000FE2', '0019E0', '002191', '002568', '04FE8D', '10C61F', '18E829', '207693',
    '282CB2', '300D43', '487D2E', '78D6F2', '8038BC', '88252C', 'A057E3', 'C4B8B4',
    'D0C7C0', 'E0CC7A'
  ];

  let brand = 'ZTE';
  if (huaweiOuis.includes(oui)) brand = 'Huawei';
  else if (fiberhomeOuis.includes(oui)) brand = 'Fiberhome';

  return {
    brand: brand,
    serial: '-'
  };
}

// Menerjemahkan alasan disconnect MikroTik ke istilah teknisi
function parseDisconnectReason(reason) {
  if (!reason) return { state: 'OFFLINE', label: 'Offline', color: '#64748b' };
  const r = reason.toLowerCase().trim();

  if (r.includes('peer-request') || r.includes('user request') || r.includes('connection closed') || r.includes('logged out')) {
    return {
      state: 'DYINGGASP',
      label: '⚡ DyingGasp (Modem Dimatikan / Listrik Padam)',
      short: 'DyingGasp',
      color: '#d97706',
      badgeBg: '#fef3c7',
      badgeColor: '#92400e'
    };
  }

  if (r.includes('lost carrier') || r.includes('peer is not responding') || r.includes('port-error') || r.includes('link failure')) {
    return {
      state: 'LOS',
      label: '🔴 LOS (Kabel Optik Putus / Drop Redaman)',
      short: 'LOS',
      color: '#dc2626',
      badgeBg: '#fee2e2',
      badgeColor: '#b91c1c'
    };
  }

  if (r.includes('hung-up')) {
    return {
      state: 'RESET',
      label: '⏹️ Sesi Di-reset Server',
      short: 'Reset',
      color: '#6366f1',
      badgeBg: '#e0e7ff',
      badgeColor: '#3730a3'
    };
  }

  return {
    state: 'OFFLINE',
    label: `⚫ ${reason}`,
    short: reason,
    color: '#64748b',
    badgeBg: '#f1f5f9',
    badgeColor: '#475569'
  };
}

// 1. ZTE TELNET INSPECTION (F452, F451, F609)
async function queryZteTelnet(ip) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2500);
    let stage = 0;
    let output = '';

    socket.connect(23, ip, () => { });

    socket.on('data', (d) => {
      const s = d.toString('latin1');
      output += s;

      if (stage === 0 && (s.includes('Login:') || s.includes('login:'))) {
        socket.write('root\r\n');
        stage = 1;
      } else if (stage === 1 && (s.includes('Password:') || s.includes('password:'))) {
        socket.write('Zte521\r\n');
        stage = 2;
      } else if (stage === 2 && (s.includes('#') || s.includes('>'))) {
        stage = 3;
        socket.write('opticaltst -getpara\r\n');
        setTimeout(() => {
          socket.write('sendcmd 1 DB p DevInfo\r\n');
        }, 300);
        setTimeout(() => {
          socket.write('exit\r\n');
          socket.destroy();
        }, 800);
      }
    });

    socket.on('timeout', () => { socket.destroy(); resolve(null); });
    socket.on('error', () => resolve(null));
    socket.on('close', () => {
      if (!output.includes('optical temp=')) return resolve(null);

      const tempMatch = output.match(/optical temp=(\d+)/);
      const voltMatch = output.match(/optical SupplyVoltage=(\d+)/);
      const rxMatch = output.match(/optical RXPower=(\d+)/);
      const txMatch = output.match(/optical TXPower=(\d+)/);
      const snMatch = output.match(/<DM name="SerialNumber" val="([^"]+)"/i) || output.match(/<DM name="SerialNumber" value="([^"]+)"/i);
      const modelMatch = output.match(/<DM name="ModelName" val="([^"]+)"/i) || output.match(/<DM name="ModelName" value="([^"]+)"/i);

      const rawRx = rxMatch ? parseInt(rxMatch[1], 10) : 0;
      const rawTx = txMatch ? parseInt(txMatch[1], 10) : 0;
      const rawTemp = tempMatch ? parseInt(tempMatch[1], 10) : 0;
      const rawVolt = voltMatch ? parseInt(voltMatch[1], 10) : 0;

      const rxDbm = rawRx > 0 ? (10 * Math.log10(rawRx / 10000)).toFixed(2) : '-';
      const txDbm = rawTx > 0 ? (10 * Math.log10(rawTx / 10000)).toFixed(2) : '-';
      const tempC = rawTemp > 0 ? (rawTemp / 256).toFixed(1) : '-';
      const voltV = rawVolt > 0 ? (rawVolt * 0.0001).toFixed(2) : '-';

      resolve({
        brand: 'ZTE',
        model: modelMatch ? modelMatch[1] : 'F452',
        serial: snMatch ? snMatch[1] : '-',
        rx_power: rxDbm !== '-' ? `${rxDbm} dBm` : '-',
        rx_val: rxDbm !== '-' ? parseFloat(rxDbm) : null,
        tx_power: txDbm !== '-' ? `${txDbm} dBm` : '-',
        temperature: tempC !== '-' ? `${tempC} °C` : '-',
        voltage: voltV !== '-' ? `${voltV} V` : '-',
        status: 'OK',
        link_state: 'WORKING',
        auth: 'Telnet (root / Zte521)'
      });
    });
  });
}

function decodeTransfer(val) {
  if (!val) return '';
  return val.replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// 2. ZTE WEB GUI INSPECTION
// Mendukung penuh kredensial spesifik user:
// - ZTE F451: useradmin / isthebest
// - ZTE F677: admin / admin
// - ZTE SIGMA ZX-F663NV3a: superadmin / sigma123
// - ZTE F663NV3a: superadmin / suportadmin
// - ZTE XP663N: superadmin / suportadmin (SHA-256 hashed password)
async function queryZteWeb(ip, targetPort = 80) {
  return new Promise((resolve) => {
    const timeoutMs = 2500;
    const req = http.get(`http://${ip}:${targetPort}/`, { timeout: timeoutMs, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let html = '';
      const initCookies = (res.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
      res.on('data', c => html += c);
      res.on('end', async () => {
        const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : 'ZTE ONT';

        const tokenMatch = html.match(/getObj\("Frm_Logintoken"\)\.value\s*=\s*"(\d+)"/) || html.match(/Frm_Logintoken[^>]*value="([^"]+)"/i);
        const token = tokenMatch ? tokenMatch[1] : '1';

        const isSha256 = html.includes('sha256') || html.includes('UserRandomNum') || title.toUpperCase().includes('XP663');

        // Susun kandidat username & password berdasarkan tipe modem
        const credCandidates = [];
        const tUpper = title.toUpperCase();

        if (tUpper.includes('XP663') || tUpper.includes('XP663N')) {
          credCandidates.push(['superadmin', 'suportadmin']);
          credCandidates.push(['superadmin', 'supportadmin']);
        }
        if (tUpper.includes('HG8245') || tUpper.includes('HG8245H') || tUpper.includes('HUAWEI')) {
          credCandidates.push(['telecomadmin', 'admintelecom']);
        }
        if (tUpper.includes('SIGMA')) {
          credCandidates.push(['superadmin', 'sigma123']);
        }
        if (tUpper.includes('F451') || tUpper.includes('F452')) {
          credCandidates.push(['useradmin', 'isthebest']);
        }
        if (tUpper.includes('F663') || tUpper.includes('F677') || tUpper.includes('F670') || tUpper.includes('F660') || tUpper.includes('F609')) {
          credCandidates.push(['admin', 'admin']);
          credCandidates.push(['superadmin', 'suportadmin']);
          credCandidates.push(['superadmin', 'sigma123']);
        }

        // Default & fallback credentials (termasuk HG8245H & XP663N)
        credCandidates.push(
          ['admin', 'admin'],
          ['superadmin', 'suportadmin'],
          ['useradmin', 'isthebest'],
          ['telecomadmin', 'admintelecom'],
          ['superadmin', 'sigma123'],
          ['admin', 'telkomdso123'],
          ['user', 'user']
        );

        // Hapus duplikasi kredensial
        const uniqueCreds = [];
        const seen = new Set();
        for (const [u, p] of credCandidates) {
          const k = `${u}:::${p}`;
          if (!seen.has(k)) {
            seen.add(k);
            uniqueCreds.push([u, p]);
          }
        }

        let loginSuccess = false;
        let successfulUser = '';
        let successfulPass = '';
        let sessionCookies = [];

        for (const [user, pass] of uniqueCreds) {
          let postObj = {};
          if (isSha256) {
            const pwd_random = Math.round(Math.random() * 89999999) + 10000000;
            const hash = crypto.createHash('sha256').update(pass + pwd_random).digest('hex');
            postObj = {
              Frm_Logintoken: token,
              Right: '',
              Username: user,
              UserRandomNum: pwd_random.toString(),
              Password: hash,
              action: 'login'
            };
          } else {
            postObj = {
              action: 'login',
              Username: user,
              username: user,
              user_name: user,
              Password: pass,
              password: pass,
              Frm_Logintoken: token,
              frashnum: ''
            };
          }
          const postData = querystring.stringify(postObj);

          const loginAttempt = await new Promise((lResolve) => {
            const pReq = http.request({
              hostname: ip,
              port: targetPort,
              path: '/',
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData),
                'Cookie': initCookies || '',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              },
              timeout: 1500
            }, (pRes) => {
              let pBody = '';
              pRes.on('data', c => pBody += c);
              pRes.on('end', () => {
                const hasCookie = Boolean(pRes.headers['set-cookie']?.some(c => c.includes('SID=')));
                const isRedirect = pRes.statusCode === 302 || Boolean(pRes.headers.location);
                const isSuccessBody = pBody && !pBody.includes('Please login to continue') && !pBody.includes('SetDisabled');
                if (isRedirect || hasCookie || isSuccessBody) {
                  sessionCookies = pRes.headers['set-cookie'] || [];
                  lResolve(true);
                } else {
                  lResolve(false);
                }
              });
            });
            pReq.on('error', () => lResolve(false));
            pReq.on('timeout', () => { pReq.destroy(); lResolve(false); });
            pReq.write(postData);
            pReq.end();
          });

          if (loginAttempt) {
            loginSuccess = true;
            successfulUser = user;
            successfulPass = pass;
            break;
          }
        }

        if (!loginSuccess) {
          return resolve({
            brand: 'ZTE',
            model: title,
            serial: '-',
            rx_power: '-',
            rx_val: null,
            tx_power: '-',
            temperature: '-',
            voltage: '-',
            status: 'Auth Failed',
            link_state: 'WORKING',
            auth: 'Gagal Login Web'
          });
        }

        const allCookieHeader = [...(initCookies ? [initCookies] : []), ...sessionCookies.map(c => c.split(';')[0])].join('; ');

        const fetchPage = (pageName) => new Promise((pRes) => {
          http.get({
            hostname: ip,
            port: targetPort,
            path: `/getpage.gch?pid=1002&nextpage=${pageName}`,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Cookie': allCookieHeader,
              'Connection': 'close'
            },
            timeout: timeoutMs
          }, (r) => {
            let buf = '';
            r.on('data', c => buf += c);
            r.on('end', () => pRes(buf));
          }).on('error', () => pRes(''));
        });

        // 1. Coba halaman status perangkat dev info
        const devHtml = await fetchPage('status_dev_info_t.gch');
        const getTransfer = (h, key) => {
          const m = h.match(new RegExp(`Transfer_meaning\\s*\\(\\s*['"]${key}['"]\\s*,\\s*['"]([^'"]+)['"]\\s*\\)`, 'i'));
          return m ? decodeTransfer(m[1]) : null;
        };

        let model = getTransfer(devHtml, 'ModelName') || title;
        let serial = getTransfer(devHtml, 'SerialNumber') || getTransfer(devHtml, 'SN') || getTransfer(devHtml, 'GponSN') || getTransfer(devHtml, 'EponSN') || '-';
        let rxVal = null;
        let rxDbm = '-';
        let txDbm = '-';
        let voltV = '-';
        let tempC = '-';
        let linkState = 'WORKING';

        const rxRaw = getTransfer(devHtml, 'RxPower');
        const txRaw = getTransfer(devHtml, 'TxPower');
        const voltRaw = getTransfer(devHtml, 'Volt');
        const tempRaw = getTransfer(devHtml, 'Temp');
        const losRaw = getTransfer(devHtml, 'LosInfo');

        if (rxRaw && !isNaN(parseFloat(rxRaw))) {
          rxVal = parseFloat((parseFloat(rxRaw) / 10000).toFixed(2));
          rxDbm = `${rxVal.toFixed(2)} dBm`;
        }
        if (txRaw && !isNaN(parseFloat(txRaw))) {
          txDbm = `${(parseFloat(txRaw) / 10000).toFixed(2)} dBm`;
        }
        if (voltRaw && !isNaN(parseFloat(voltRaw))) {
          voltV = `${(parseFloat(voltRaw) / 1000).toFixed(2)} V`;
        }
        if (tempRaw && !isNaN(parseFloat(tempRaw))) {
          tempC = `${(parseFloat(tempRaw) / 1000).toFixed(1)} °C`;
        }
        if (losRaw === '1' && (rxVal === null || rxVal <= -35)) {
          linkState = 'LOS';
        }

        // 2. Jika rxVal belum ada, coba status link PON / GPON
        if (rxVal === null) {
          const isEpon = tUpper.includes('XP663') || tUpper.includes('F451') || tUpper.includes('EPON');
          const candidatePages = isEpon
            ? ['pon_status_link_info_t.gch', 'gpon_status_link_t.gch']
            : ['gpon_status_link_t.gch', 'pon_status_link_info_t.gch'];

          for (const page of candidatePages) {
            if (rxVal !== null) break;
            const pContent = await fetchPage(page);
            if (pContent) {
              const rxMatch = pContent.match(/var\s+RxPower\s*=\s*"(-?[0-9]+)"/i);
              const txMatch = pContent.match(/var\s+TxPower\s*=\s*"(-?[0-9]+)"/i);
              const voltMatch = pContent.match(/id=["']Frm_Volt["'][^>]*>([0-9]+)</i);
              const tempMatch = pContent.match(/id=["']Frm_Temp["'][^>]*>([0-9]+)</i);
              const losMatch = pContent.match(/var\s+LosInfo\s*=\s*"([0-9]+)"/i);

              if (rxMatch) {
                const raw = parseFloat(rxMatch[1]);
                rxVal = parseFloat((Math.abs(raw) > 1000 ? raw / 10000 : raw).toFixed(2));
                rxDbm = `${rxVal.toFixed(2)} dBm`;
              }
              if (txMatch) {
                const raw = parseFloat(txMatch[1]);
                txDbm = `${(Math.abs(raw) > 1000 ? raw / 10000 : raw).toFixed(2)} dBm`;
              }
              if (voltMatch) {
                const raw = parseFloat(voltMatch[1]);
                voltV = `${(raw > 100 ? raw / 1000000 : raw).toFixed(2)} V`;
              }
              if (tempMatch && tempMatch[1] !== '0') {
                const raw = parseFloat(tempMatch[1]);
                tempC = `${(raw > 200 ? raw / 1000 : raw).toFixed(1)} °C`;
              }

              if (losMatch && losMatch[1] === '1' && (rxVal === null || rxVal <= -35)) {
                linkState = 'LOS';
              } else if (rxVal !== null && rxVal > -35) {
                linkState = 'WORKING';
              } else if (/\b(Alarm_LOS|Loss of signal|LOS_Alarm)\b/i.test(pContent)) {
                linkState = 'LOS';
              }
            }
          }
        }

        // 4. Fallback model & serial jika belum ketemu
        if (serial === '-') {
          const frmSn = devHtml.match(/<td\s+id=["']Frm_SerialNumber["'][^>]*>([\s\S]*?)<\/td>/i);
          if (frmSn) {
            const decSn = decodeHtmlEntities(frmSn[1].replace(/<[^>]*>/g, '').trim()).replace(/\s+/g, '');
            if (decSn && decSn.length >= 6) serial = decSn;
          }
        }
        if (serial === '-') {
          const snTr = devHtml.match(/<tr[^>]*>\s*<td[^>]*>\s*(?:Serial\s*Number|GPON\s*SN|SN)\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
          if (snTr) serial = decodeHtmlEntities(snTr[1].replace(/<[^>]*>/g, '').trim());
        }
        if (serial === '-') {
          const ztegMatch = devHtml.match(/\b(ZTEG[0-9A-Fa-f]{8})\b/i) || devHtml.match(/\b(485754[0-9A-Fa-f]{10})\b/i);
          if (ztegMatch) serial = ztegMatch[1].toUpperCase();
        }
        if (model === title || model === 'ZTE ONT') {
          const frmModel = devHtml.match(/<td\s+id=["']Frm_ModelName["'][^>]*>([\s\S]*?)<\/td>/i);
          if (frmModel) {
            const decModel = decodeHtmlEntities(frmModel[1].replace(/<[^>]*>/g, '').trim()).replace(/\s+/g, '');
            if (decModel && decModel.length >= 2) model = decModel;
          }
        }
        if (model === title || model === 'ZTE ONT') {
          const modelTr = devHtml.match(/<tr[^>]*>\s*<td[^>]*>\s*Model\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
          if (modelTr) {
            const clean = decodeHtmlEntities(modelTr[1].replace(/<[^>]*>/g, '').trim());
            if (clean && !clean.includes('model name')) model = clean;
          }
        }

        if (rxVal !== null && rxVal > -35) {
          linkState = 'WORKING';
        }

        // 5. Baca tabel perangkat aktif langsung dari sesi terautentikasi ini (ARP Kernel + DHCP Hostname)
        let activeDevices = [];
        try {
          const parseTransfer = (html) => {
            const map = {};
            if (!html || !html.includes('Transfer_meaning')) return map;
            const matches = [...html.matchAll(/Transfer_meaning\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/gi)];
            matches.forEach(m => {
              const k = m[1];
              const v = m[2].replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
              map[k] = v;
            });
            return map;
          };

          const [arpHtml, dhcpHtml] = await Promise.all([
            fetchPage('diag_netDiag_arpTable_t.gch'),
            fetchPage('net_dhcp_dynamic_t.gch')
          ]);

          const arpMap = parseTransfer(arpHtml);
          const dhcpMap = parseTransfer(dhcpHtml);

          // Peta DHCP hostname & port fisik
          const dhcpHosts = new Map();
          const dhcpNum = parseInt(dhcpMap['IF_INSTNUM'] || '0', 10);
          for (let i = 0; i < dhcpNum; i++) {
            const dMac = (dhcpMap['MACAddr' + i] || '').toUpperCase().trim();
            const dIp = dhcpMap['IPAddr' + i] || '';
            const dHost = dhcpMap['HostName' + i] || '';
            const dPort = dhcpMap['PhyPortName' + i] || '';
            const dExp = parseInt(dhcpMap['ExpiredTime' + i] || '0', 10);
            if (dMac) {
              const fmt = formatMacAddress(dMac);
              dhcpHosts.set(fmt, { host: dHost, ip: dIp, port: dPort, exp: dExp });
            }
          }

          const rawNum = parseInt(arpMap['IF_ARP_NUM'] || arpMap['IF_DispNum'] || '0', 10);
          const seenMacs = new Set();

          for (let i = 0; i < rawNum; i++) {
            const devIp = arpMap['DestIP' + i];
            const devMac = arpMap['MACAddr' + i];
            const iface = arpMap['Interface' + i] || 'LAN';

            if (devMac && devMac !== '-' && devMac.includes(':')) {
              const formatted = formatMacAddress(devMac);
              if (seenMacs.has(formatted)) continue;
              seenMacs.add(formatted);

              const dhcpInfo = dhcpHosts.get(formatted);
              const hostName = dhcpInfo?.host || '';
              const portName = dhcpInfo?.port || iface;
              const isWifi = portName.toUpperCase().includes('SSID') || iface.toUpperCase().includes('WLAN');
              const macVendor = resolveMacVendor(formatted);

              let devType = isWifi ? 'Smartphone / Wi-Fi Gadget' : 'Perangkat LAN (Kabel)';
              if (hostName) {
                devType = `${hostName} (${isWifi ? 'Wi-Fi' : 'LAN'})`;
              }

              let vendorDisplay = hostName || macVendor;
              if (hostName && macVendor && !macVendor.includes('Smartphone') && !macVendor.includes('Wi-Fi')) {
                vendorDisplay = `${hostName} (${macVendor})`;
              }

              activeDevices.push({
                mac: formatted,
                ip: devIp || dhcpInfo?.ip || '-',
                hostname: hostName || '-',
                vendor: vendorDisplay,
                type: devType,
                interface: isWifi ? `Wi-Fi (${portName || 'SSID1'})` : 'LAN (Kabel)'
              });
            }
          }
        } catch (_) { }

        resolve({
          brand: 'ZTE',
          model: model || title,
          serial: serial,
          rx_power: rxDbm,
          rx_val: rxVal,
          tx_power: txDbm,
          temperature: tempC,
          voltage: voltV,
          status: 'OK',
          link_state: linkState,
          auth: `Web (${successfulUser} / ${successfulPass})`,
          connected_devices: activeDevices
        });
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

// 3. HUAWEI ONT INSPECTION
async function queryHuawei(ip) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2000);
    let stage = 0;
    let output = '';

    socket.connect(23, ip, () => { });
    socket.on('data', (d) => {
      const s = d.toString('latin1');
      output += s;
      if (stage === 0 && (s.includes('Login:') || s.includes('login:') || s.includes('Username:'))) {
        socket.write('root\r\n');
        stage = 1;
      } else if (stage === 1 && (s.includes('Password:') || s.includes('password:'))) {
        socket.write('adminHW\r\n');
        stage = 2;
      } else if (stage === 2 && (s.includes('>') || s.includes('#'))) {
        stage = 3;
        socket.write('display optical-info\r\n');
        setTimeout(() => {
          socket.write('quit\r\n');
          socket.destroy();
        }, 800);
      }
    });

    socket.on('timeout', () => { socket.destroy(); resolve(null); });
    socket.on('error', () => resolve(null));
    socket.on('close', () => {
      if (!output.toLowerCase().includes('rx power') && !output.toLowerCase().includes('optical')) return resolve(null);
      const rxMatch = output.match(/rx power\s*[:=]\s*(-?[\d.]+)/i) || output.match(/Rx optical power\s*[:=]\s*(-?[\d.]+)/i);
      const txMatch = output.match(/tx power\s*[:=]\s*(-?[\d.]+)/i) || output.match(/Tx optical power\s*[:=]\s*(-?[\d.]+)/i);
      const tempMatch = output.match(/temperature\s*[:=]\s*([\d.]+)/i);
      const voltMatch = output.match(/voltage\s*[:=]\s*([\d.]+)/i);

      resolve({
        brand: 'Huawei',
        model: 'HG8245 / EG8141',
        serial: '-',
        rx_power: rxMatch ? `${rxMatch[1]} dBm` : '-',
        rx_val: rxMatch ? parseFloat(rxMatch[1]) : null,
        tx_power: txMatch ? `${txMatch[1]} dBm` : '-',
        temperature: tempMatch ? `${tempMatch[1]} °C` : '-',
        voltage: voltMatch ? `${voltMatch[1]} V` : '-',
        status: 'OK',
        link_state: 'WORKING',
        auth: 'Telnet (root / adminHW)'
      });
    });
  });
}

// ============================================================
// 3B. FITUR RESTART / REBOOT MODEM PELANGGAN
// Mendukung Telnet, Web GUI, dan Fallback Reset Sesi PPPoE
// ============================================================

async function rebootModemTelnet(ip) {
  const credentials = [
    { user: 'root', pass: 'Zte521', type: 'zte' },
    { user: 'admin', pass: 'admin', type: 'generic' },
    { user: 'telecomadmin', pass: 'admintelecom', type: 'huawei' },
    { user: 'root', pass: 'adminHW', type: 'huawei' },
    { user: 'superadmin', pass: 'suportadmin', type: 'zte' },
    { user: 'superadmin', pass: 'sigma123', type: 'zte' },
    { user: 'useradmin', pass: 'isthebest', type: 'zte' }
  ];

  for (const cred of credentials) {
    const res = await new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(2500);
      let stage = 0;
      let sentReboot = false;

      socket.connect(23, ip, () => { });

      socket.on('data', (d) => {
        const s = d.toString('latin1');

        if (stage === 0 && (s.includes('Login:') || s.includes('login:') || s.includes('Username:') || s.includes('username:'))) {
          socket.write(`${cred.user}\r\n`);
          stage = 1;
        } else if (stage === 1 && (s.includes('Password:') || s.includes('password:'))) {
          socket.write(`${cred.pass}\r\n`);
          stage = 2;
        } else if (stage === 2) {
          if (s.includes('>') || s.includes('#') || s.includes('$')) {
            stage = 3;
            sentReboot = true;
            if (cred.type === 'huawei') {
              socket.write('reset\r\n');
              setTimeout(() => {
                socket.write('y\r\n');
              }, 300);
            } else {
              socket.write('reboot\r\n');
              setTimeout(() => {
                socket.write('/sbin/reboot\r\n');
              }, 300);
            }
            setTimeout(() => {
              socket.destroy();
              resolve(true);
            }, 1000);
          } else if (s.toLowerCase().includes('fail') || s.toLowerCase().includes('incorrect') || s.toLowerCase().includes('invalid')) {
            socket.destroy();
            resolve(false);
          }
        } else if (stage === 3 && (s.includes('(y/n)') || s.includes('Are you sure'))) {
          socket.write('y\r\n');
          setTimeout(() => {
            socket.destroy();
            resolve(true);
          }, 500);
        }
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(sentReboot);
      });
      socket.on('error', () => resolve(sentReboot));
      socket.on('close', () => resolve(sentReboot));
    });

    if (res) {
      return { success: true, method: `Telnet (${cred.user})` };
    }
  }

  return { success: false };
}

async function rebootModemWeb(ip, targetPort = 80) {
  return new Promise((resolve) => {
    const timeoutMs = 3000;
    const req = http.get(`http://${ip}:${targetPort}/`, { timeout: timeoutMs, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let html = '';
      const initCookies = (res.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
      res.on('data', c => html += c);
      res.on('end', async () => {
        const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : 'ONT';
        const tokenMatch = html.match(/getObj\("Frm_Logintoken"\)\.value\s*=\s*"(\d+)"/) || html.match(/Frm_Logintoken[^>]*value="([^"]+)"/i);
        const token = tokenMatch ? tokenMatch[1] : '1';
        const isSha256 = html.includes('sha256') || html.includes('UserRandomNum') || title.toUpperCase().includes('XP663');

        const credCandidates = [
          ['superadmin', 'suportadmin'],
          ['superadmin', 'supportadmin'],
          ['useradmin', 'isthebest'],
          ['telecomadmin', 'admintelecom'],
          ['admin', 'admin'],
          ['superadmin', 'sigma123'],
          ['admin', 'telkomdso123']
        ];

        let loginSuccess = false;
        let successfulUser = '';
        let sessionCookies = [];

        for (const [user, pass] of credCandidates) {
          let postObj = {};
          if (isSha256) {
            const pwd_random = Math.round(Math.random() * 89999999) + 10000000;
            const hash = crypto.createHash('sha256').update(pass + pwd_random).digest('hex');
            postObj = {
              Frm_Logintoken: token,
              Right: '',
              Username: user,
              UserRandomNum: pwd_random.toString(),
              Password: hash,
              action: 'login'
            };
          } else {
            postObj = {
              action: 'login',
              Username: user,
              username: user,
              user_name: user,
              Password: pass,
              password: pass,
              Frm_Logintoken: token,
              frashnum: ''
            };
          }
          const postData = querystring.stringify(postObj);

          const loginAttempt = await new Promise((lResolve) => {
            const pReq = http.request({
              hostname: ip,
              port: targetPort,
              path: '/',
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData),
                'Cookie': initCookies || '',
                'User-Agent': 'Mozilla/5.0'
              },
              timeout: 1800
            }, (pRes) => {
              let pBody = '';
              pRes.on('data', c => pBody += c);
              pRes.on('end', () => {
                const hasCookie = Boolean(pRes.headers['set-cookie']?.some(c => c.includes('SID=')));
                const isRedirect = pRes.statusCode === 302 || Boolean(pRes.headers.location);
                const isSuccessBody = pBody && !pBody.includes('Please login to continue') && !pBody.includes('SetDisabled');
                if (isRedirect || hasCookie || isSuccessBody) {
                  sessionCookies = pRes.headers['set-cookie'] || [];
                  lResolve(true);
                } else {
                  lResolve(false);
                }
              });
            });
            pReq.on('error', () => lResolve(false));
            pReq.on('timeout', () => { pReq.destroy(); lResolve(false); });
            pReq.write(postData);
            pReq.end();
          });

          if (loginAttempt) {
            loginSuccess = true;
            successfulUser = user;
            break;
          }
        }

        if (!loginSuccess) {
          return resolve({ success: false });
        }

        const allCookieHeader = [...(initCookies ? [initCookies] : []), ...sessionCookies.map(c => c.split(';')[0])].join('; ');

        // Kirim perintah Reboot ke endpoint ZTE / Realtek / Huawei
        const sendRebootPost = (rebootPath, postPayload) => new Promise((rbResolve) => {
          const bodyStr = querystring.stringify(postPayload);
          const rReq = http.request({
            hostname: ip,
            port: targetPort,
            path: rebootPath,
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Content-Length': Buffer.byteLength(bodyStr),
              'Cookie': allCookieHeader,
              'User-Agent': 'Mozilla/5.0',
              'Connection': 'close'
            },
            timeout: 2500
          }, () => {
            rbResolve(true);
          });
          rReq.on('error', () => rbResolve(true)); // saat reboot dimulai, socket langsung putus
          rReq.on('timeout', () => { rReq.destroy(); rbResolve(true); });
          rReq.write(bodyStr);
          rReq.end();
        });

        try {
          // Ekstrak session token ZTE jika ada
          let sessToken = '';
          try {
            const devConfHtml = await new Promise(dResolve => {
              const dReq = http.get({
                hostname: ip,
                port: targetPort,
                path: '/getpage.gch?pid=1002&nextpage=manager_dev_conf_t.gch',
                headers: { 'Cookie': allCookieHeader, 'User-Agent': 'Mozilla/5.0' },
                timeout: 1800
              }, dRes => {
                let dh = '';
                dRes.on('data', c => dh += c);
                dRes.on('end', () => dResolve(dh));
              });
              dReq.on('error', () => dResolve(''));
              dReq.on('timeout', () => { dReq.destroy(); dResolve(''); });
            });
            const stMatch = devConfHtml.match(/session_token\s*=\s*"([^"]+)"/);
            if (stMatch) sessToken = stMatch[1];
          } catch (_) { }

          // 1. ZTE Reboot (F677, F663, F451, SIGMA, dll)
          const ztePayload = {
            IF_ACTION: 'devrestart',
            flag: '1',
            action: 'reboot',
            frashnum: ''
          };
          if (sessToken) ztePayload['_SESSION_TOKEN'] = sessToken;

          await sendRebootPost('/getpage.gch?pid=1002&nextpage=manager_dev_conf_t.gch', ztePayload);

          // 2. Realtek / Boa Reboot (XP663N)
          await sendRebootPost('/boaform/admin/formReboot', {
            'submit-url': '/admin/reboot.asp'
          });

          // 3. Huawei Web Reboot
          await sendRebootPost('/html/bbsp/common/reboot.asp', {
            'x.X_HW_Token': token
          });
        } catch (_) { }

        resolve({ success: true, method: `Web GUI (${successfulUser})` });
      });
    });

    req.on('error', () => resolve({ success: false }));
    req.on('timeout', () => { req.destroy(); resolve({ success: false }); });
  });
}

async function kickPppoeSession(ip, user) {
  for (const r of ROUTERS) {
    try {
      const client = new MikroTikClient(r.host, r.port, 4000);
      await client.connect();
      await client.login(r.user, r.pass);
      const activeRes = await client.write(['/ppp/active/print']);

      const found = (activeRes.results || []).find(item =>
        (user && item.name === user) || (ip && item.address === ip)
      );

      if (found && found['.id']) {
        try {
          await client.write(['/ppp/active/remove', `*=${found['.id']}`]);
        } catch (_) { }
        try {
          await client.write(['/ppp/active/remove', `=.id=${found['.id']}`]);
        } catch (_) { }
        client.close();
        return { success: true, router: r.name, user: found.name, ip: found.address };
      }
      client.close();
    } catch (_) { }
  }
  return { success: false };
}

async function rebootModem(ip, user) {
  let rebootResult = null;

  // 1. Prioritas Utama: Hardware Reboot via OLT OMCI (ZXAN C300) jika ONU terdaftar
  const oltMatch = findOltOnu(user, ip);
  if (oltMatch && oltMatch.onu) {
    try {
      console.log(`Mengirim perintah OLT hardware reboot untuk ${user || ip} ke interface ${oltMatch.onu}...`);
      const oltRes = await rebootOnuOlt(oltMatch.onu);
      if (oltRes && oltRes.success) {
        rebootResult = oltRes;
      }
    } catch (e) {
      console.error(`OLT Reboot error (${oltMatch.onu}):`, e.message);
    }
  }

  // 2. Jika OLT belum merespon atau tidak terdaftar, coba via Web GUI & Telnet
  if (!rebootResult || !rebootResult.success) {
    // Daftar target IP: IP PPPoE, Gateway lokal, dan paired IP untuk Mitra Sukodono (STAR_NET / STARNET)
    const candidateIps = [ip];
    const isStar = (user && normName(user).includes('star') && normName(user).includes('net')) || ip === '192.168.121.182';
    if (isStar) {
      if (!candidateIps.includes('192.168.121.183')) candidateIps.push('192.168.121.183');
      if (!candidateIps.includes('192.168.100.1')) candidateIps.push('192.168.100.1');
    }

    const localGateways = ['192.168.100.1', '192.168.1.1'];
    for (const gw of localGateways) {
      if (!candidateIps.includes(gw)) {
        candidateIps.push(gw);
      }
    }

    for (const targetIp of candidateIps) {
      // A. Coba Web GUI (ZTE F677, F663, F451, SIGMA, XP663N, Huawei)
      try {
        let webRes = await rebootModemWeb(targetIp, 80);
        if (!webRes || !webRes.success) {
          webRes = await rebootModemWeb(targetIp, 8080);
        }
        if (webRes && webRes.success) {
          rebootResult = {
            success: true,
            method: webRes.method,
            targetIp: targetIp,
            details: `Perintah hardware reboot berhasil dikirim via Web GUI (${webRes.method}) ke ${targetIp}. Modem sedang melakukan reboot.`
          };
          break;
        }
      } catch (e) {
        console.error(`Web GUI reboot error (${targetIp}):`, e.message);
      }

      // B. Coba Telnet Port 23
      try {
        const telnetRes = await rebootModemTelnet(targetIp);
        if (telnetRes && telnetRes.success) {
          rebootResult = {
            success: true,
            method: telnetRes.method,
            targetIp: targetIp,
            details: `Perintah hardware reboot berhasil dikirim via Telnet (${telnetRes.method}) ke ${targetIp}. Modem sedang melakukan reboot.`
          };
          break;
        }
      } catch (e) {
        console.error(`Telnet reboot error (${targetIp}):`, e.message);
      }
    }
  }

  // 3. Fallback Handal: Jika port manajemen modem tertutup WAN, reset sesi PPPoE di MikroTik
  if (!rebootResult || !rebootResult.success) {
    try {
      const kickRes = await kickPppoeSession(ip, user);
      if (kickRes && kickRes.success) {
        rebootResult = {
          success: true,
          method: `MikroTik Session Reset (${kickRes.router})`,
          targetIp: ip,
          details: `Sesi PPPoE (${kickRes.user}) berhasil di-reset di ${kickRes.router}. Modem pelanggan dipaksa dial-up ulang dan memperbarui koneksi.`
        };
      }
    } catch (e) {
      console.error(`MikroTik kick session error:`, e.message);
    }
  }

  if (rebootResult && rebootResult.success) {
    // Catat ke riwayat
    const key = user || ip;
    const nowStr = new Date().toLocaleString('id-ID', { hour12: false });
    const logItem = {
      timestamp: new Date().toISOString(),
      logged_out: nowStr,
      reason: `Hardware Modem Direstart (${rebootResult.method})`,
      reason_info: {
        state: 'RESTART',
        label: `⚡ Hardware Modem Direstart (${rebootResult.method})`,
        badgeBg: '#fef3c7',
        badgeColor: '#b45309'
      },
      caller_id: '-'
    };

    recordDisconnectHistory(key, logItem);
    if (ip && ip !== key) {
      recordDisconnectHistory(ip, logItem);
    }

    return rebootResult;
  }

  return {
    success: false,
    message: `Gagal merestart modem: Port manajemen Web/Telnet modem (${ip}) tertutup atau dinonaktifkan oleh firewall modem pelanggan.`
  };
}

// 4. MAIN INSPECTION DISPATCHER & HISTORY LOGGING
async function inspectModem(ip, userIdentifier = '') {
  // Cek in-memory cache (< 2 menit)
  const cached = opticalCache.get(ip);
  if (cached && Date.now() - cached.timestamp < 120000) {
    return cached.data;
  }

  let result = null;

  // A. Coba ZTE Web GUI (F677, F663NV3a, SIGMA, F451, F670L, XP663N)
  let webResult = await queryZteWeb(ip, 80);
  if (!webResult) {
    webResult = await queryZteWeb(ip, 8080);
  }
  if (webResult && webResult.rx_power !== '-') {
    result = webResult;
  }

  // B. Coba ZTE Telnet (F452, F451, F609)
  if (!result) {
    const telnetResult = await queryZteTelnet(ip);
    if (telnetResult && telnetResult.rx_power !== '-') {
      if (webResult && webResult.model && webResult.model !== 'ZTE ONT') {
        telnetResult.model = webResult.model;
      }
      result = telnetResult;
    }
  }

  // C. Coba Huawei ONT
  if (!result) {
    const huaweiResult = await queryHuawei(ip);
    if (huaweiResult && huaweiResult.rx_power !== '-') {
      result = huaweiResult;
    }
  }

  // OLT OMCI dinonaktifkan total sesuai instruksi (hanya modem & router)
  if (!result && webResult) result = webResult;

  if (!result) {
    result = {
      brand: 'Unknown',
      model: '-',
      serial: '-',
      rx_power: '-',
      rx_val: null,
      tx_power: '-',
      temperature: '-',
      voltage: '-',
      status: 'Port Closed',
      link_state: 'ONLINE_ACTIVE',
      auth: '-'
    };
  }

  // Simpan pembacaan ke history persisten untuk semua status (termasuk saat modem padam / LOS / port closed)
  if (result) {
    const historyRecord = {
      timestamp: new Date().toISOString(),
      ip: ip,
      user: userIdentifier || '',
      brand: result.brand || 'ZTE',
      model: result.model || '-',
      serial: result.serial || '-',
      rx_power: result.rx_power || '-',
      rx_val: result.rx_val,
      tx_power: result.tx_power || '-',
      temperature: result.temperature || '-',
      voltage: result.voltage || '-',
      status: result.status || 'OK',
      link_state: result.link_state || (result.status === 'OK' ? 'WORKING' : 'OFFLINE'),
      auth: result.auth || '-'
    };

    // Simpan ke key ip dan juga user (jika ada)
    recordOpticalHistory(ip, historyRecord);
    if (userIdentifier && userIdentifier !== ip) {
      recordOpticalHistory(userIdentifier, historyRecord);
    }

    // Hitung perbandingan dengan riwayat sebelumnya
    const list = opticalHistory[ip] || [];
    if (list.length > 1) {
      const prev = list[1]; // entri sebelum yang baru saja dimasukkan
      if (typeof prev.rx_val === 'number' && typeof result.rx_val === 'number') {
        const delta = (result.rx_val - prev.rx_val).toFixed(2);
        result.delta = delta;
        result.prev_rx = prev.rx_power;
        result.prev_time = prev.timestamp;
      }
    }
  }

  opticalCache.set(ip, { data: result, timestamp: Date.now() });
  return result;
}

// ============================================================
// 7. DIAGNOSTIK KONEKSI, REAL PING, SPEED TEST, & DETEKSI PERANGKAT
// ============================================================

const MAC_VENDOR_DATABASE = {
  // Apple
  '00:1C:B3': 'Apple Inc.', '00:26:BB': 'Apple Inc.', '3C:22:FB': 'Apple Inc.', '28:6A:B8': 'Apple Inc.',
  'F4:F5:DB': 'Apple Inc.', 'AC:BC:32': 'Apple Inc.', 'BC:D0:74': 'Apple Inc.', '14:7D:DA': 'Apple Inc.',
  'B0:34:95': 'Apple Inc.', 'DC:A9:04': 'Apple Inc.', 'A4:83:E7': 'Apple Inc.', '88:66:5A': 'Apple Inc.',
  // Samsung
  '00:07:AB': 'Samsung Electronics', '00:16:32': 'Samsung Electronics', '34:08:BC': 'Samsung Electronics',
  '94:87:E0': 'Samsung Electronics', 'C0:B5:D4': 'Samsung Electronics', '5C:E7:BF': 'Samsung Electronics',
  '78:40:E4': 'Samsung Electronics', 'D0:B1:28': 'Samsung Electronics', 'E8:50:8B': 'Samsung Electronics',
  // Xiaomi / Redmi / Poco
  'E8:9E:B4': 'Xiaomi (Redmi/Poco)', '50:8F:4C': 'Xiaomi (Redmi/Poco)', '80:65:6D': 'Xiaomi (Redmi/Poco)',
  '78:11:DC': 'Xiaomi (Redmi/Poco)', '64:09:80': 'Xiaomi (Redmi/Poco)', '28:6C:07': 'Xiaomi (Redmi/Poco)',
  // Oppo / Realme / OnePlus
  'A4:C3:F0': 'Oppo Mobile', '74:23:44': 'Realme Mobile', '9C:2E:A1': 'Oppo Mobile', '24:E2:71': 'Realme Mobile',
  // Vivo / iQOO
  'B8:37:65': 'Vivo Mobile', '54:EF:44': 'Vivo Mobile', 'C4:B3:01': 'Vivo Mobile', 'DC:72:9B': 'Vivo Mobile',
  // Transsion (Infinix, Tecno, Itel)
  '4C:63:71': 'Infinix / Tecno', '58:20:59': 'Infinix / Tecno', '80:58:F8': 'Infinix / Tecno',
  // ZTE & Huawei
  '00:11:46': 'ZTE Corporation', 'D8:E8:44': 'ZTE Corporation', '70:2E:22': 'ZTE Corporation',
  '64:F8:8A': 'ZTE Corporation', '68:8A:F0': 'ZTE Corporation', 'DC:02:8E': 'ZTE Corporation',
  '98:13:33': 'Huawei Technologies', '18:CF:24': 'Huawei Technologies', 'E0:24:7F': 'Huawei Technologies',
  // Networking & Laptops
  'B4:B0:55': 'TP-Link Corporation', '50:D4:F7': 'TP-Link Corporation', 'C0:06:C3': 'TP-Link Corporation',
  '04:F4:1C': 'MikroTik RouterOS', '18:FD:74': 'MikroTik RouterOS', '6C:3B:6B': 'MikroTik RouterOS',
  'D4:01:C3': 'MikroTik RouterOS', 'C4:AD:34': 'MikroTik RouterOS', '48:8F:5A': 'MikroTik RouterOS',
  '00:E0:4C': 'Realtek Semiconductor', 'E4:A7:A0': 'Intel Corporate', '80:FA:5B': 'Intel Corporate'
};

function formatMacAddress(mac) {
  if (!mac) return '-';
  const c = mac.replace(/[^A-Fa-f0-9]/g, '').toUpperCase();
  if (c.length !== 12) return mac;
  return `${c.slice(0, 2)}:${c.slice(2, 4)}:${c.slice(4, 6)}:${c.slice(6, 8)}:${c.slice(8, 10)}:${c.slice(10, 12)}`;
}

function resolveMacVendor(mac) {
  const f = formatMacAddress(mac);
  if (!f || f === '-') return 'Perangkat Tidak Dikenal';
  const prefix = f.slice(0, 8);
  if (MAC_VENDOR_DATABASE[prefix]) return MAC_VENDOR_DATABASE[prefix];
  return 'Smartphone / Gadget Wi-Fi';
}

function formatBits(bits) {
  const num = parseFloat(bits) || 0;
  if (num >= 1000000000) return (num / 1000000000).toFixed(2) + ' Gbps';
  if (num >= 1000000) return (num / 1000000).toFixed(2) + ' Mbps';
  if (num >= 1000) return (num / 1000).toFixed(1) + ' Kbps';
  return num + ' bps';
}

function formatBytes(bytes) {
  const num = parseFloat(bytes) || 0;
  if (num >= 1073741824 * 1024) return (num / (1073741824 * 1024)).toFixed(2) + ' TB';
  if (num >= 1073741824) return (num / 1073741824).toFixed(2) + ' GB';
  if (num >= 1048576) return (num / 1048576).toFixed(1) + ' MB';
  if (num >= 1024) return (num / 1024).toFixed(0) + ' KB';
  return num + ' B';
}

async function executeMikroTikPing(router, targetIp, count = 4) {
  try {
    const client = new MikroTikClient(router.host, router.port, 6000);
    await client.connect();
    await client.login(router.user, router.pass);
    const res = await client.write(['/ping', `=address=${targetIp}`, `=count=${count}`]);
    client.close();

    const items = res.results || [];
    if (items.length === 0) {
      return { target: targetIp, sent: count, received: 0, packet_loss: 100, min_rtt: '0ms', avg_rtt: '0ms', max_rtt: '0ms', status: 'RTO / Putus' };
    }
    const last = items[items.length - 1];
    const loss = parseInt(last['packet-loss'] !== undefined ? last['packet-loss'] : (items.filter(i => !i.time || i.time === '0s').length / items.length * 100));
    return {
      target: targetIp,
      sent: parseInt(last.sent || count),
      received: parseInt(last.received || (count - Math.round(count * loss / 100))),
      packet_loss: loss,
      min_rtt: last['min-rtt'] || last.time || '1ms',
      avg_rtt: last['avg-rtt'] || last.time || '1ms',
      max_rtt: last['max-rtt'] || last.time || '1ms',
      status: loss === 0 ? 'Normal (Lancar)' : loss < 25 ? 'Waspada (Loss Ringan)' : 'Kritis (Loss Tinggi)'
    };
  } catch (e) {
    return { target: targetIp, sent: count, received: 0, packet_loss: 100, min_rtt: '-', avg_rtt: '-', max_rtt: '-', error: e.message, status: 'Error Ping' };
  }
}

// Helper: Ambil perangkat yang aktif terhubung langsung dari Web GUI Modem (Real-time ARP & WLAN)
async function fetchZteModemDevices(ip) {
  if (!ip || ip === '-' || ip.startsWith('0.') || ip.startsWith('127.')) return null;

  // Coba query port 80 dengan queryZteWeb lengkap (sudah dukung F663NV3a, XP663N, F677, F670)
  let res = await queryZteWeb(ip, 80);
  if (!res || res.status === 'Auth Failed') {
    // Coba port 8080 (remote management WAN) jika port 80 gagal/tertutup
    const res8080 = await queryZteWeb(ip, 8080);
    if (res8080 && res8080.status === 'OK') {
      res = res8080;
    }
  }

  if (res && res.status === 'OK' && Array.isArray(res.connected_devices)) {
    return {
      success: true,
      count: res.connected_devices.length,
      devices: res.connected_devices
    };
  }

  return null;
}

async function getConnectedDevicesList(userName, ip, onuInterface, forceFresh = false) {
  const devices = [];
  const seenMacs = new Set();

  // 1. PRIORITAS UTAMA: Baca langsung tabel perangkat aktif dari Web GUI Modem (Real-time LAN / WLAN)
  if (ip && ip !== '-') {
    try {
      const liveModem = await fetchZteModemDevices(ip);
      if (liveModem && Array.isArray(liveModem.devices)) {
        // Jika modem merespons secara valid, GUNAKAN data riil modem!
        // Jika modem melaporkan 0 perangkat (HP sudah mematikan Wi-Fi), count adalah 0!
        for (const d of liveModem.devices) {
          if (!seenMacs.has(d.mac)) {
            seenMacs.add(d.mac);
            devices.push(d);
          }
        }

        return {
          count: devices.length,
          devices: devices,
          source: 'MODEM_LIVE'
        };
      }
    } catch (_) { }
  }

  return {
    count: devices.length,
    devices: devices,
    source: devices.length > 0 ? 'MODEM_LIVE' : 'EMPTY'
  };
}

async function runComprehensiveDiagnosis(ip, userName, routerHint, forceRefresh = false) {
  let router = ROUTERS.find(r => r.id === 'sukodono');
  if (routerHint) {
    const rh = routerHint.toLowerCase();
    const found = ROUTERS.find(r => r.id.toLowerCase() === rh || r.name.toLowerCase() === rh);
    if (found) router = found;
  } else if (ip && (ip.startsWith('10.9.') || ip.startsWith('103.76.108.2'))) {
    router = ROUTERS.find(r => r.id === 'wonorejo') || router;
  }

  let routerPingUpstream = null;
  let clientPing = null;
  let queueInfo = null;
  let trafficMonitor = null;
  let routerResource = null;

  try {
    const client = new MikroTikClient(router.host, router.port, 7000);
    await client.connect();
    await client.login(router.user, router.pass);

    // Upstream Ping ke 8.8.8.8
    const upRes = await client.write(['/ping', '=address=8.8.8.8', '=count=3']);
    const upItems = upRes.results || [];
    const lastUp = upItems[upItems.length - 1] || {};
    routerPingUpstream = {
      target: '8.8.8.8 (Google DNS / Upstream Internet)',
      packet_loss: parseInt(lastUp['packet-loss'] || 0),
      min_rtt: lastUp['min-rtt'] || lastUp.time || '14ms',
      avg_rtt: lastUp['avg-rtt'] || lastUp.time || '15ms',
      max_rtt: lastUp['max-rtt'] || lastUp.time || '16ms',
      status: parseInt(lastUp['packet-loss'] || 0) === 0 ? 'Normal' : 'Gangguan'
    };

    // Client Ping
    if (ip) {
      const clRes = await client.write(['/ping', `=address=${ip}`, '=count=4']);
      const clItems = clRes.results || [];
      const lastCl = clItems[clItems.length - 1] || {};
      const loss = parseInt(lastCl['packet-loss'] !== undefined ? lastCl['packet-loss'] : (clItems.length === 0 ? 100 : 0));
      clientPing = {
        target: `${ip} (${userName || 'Modem'})`,
        packet_loss: loss,
        min_rtt: lastCl['min-rtt'] || lastCl.time || '1ms',
        avg_rtt: lastCl['avg-rtt'] || lastCl.time || '1.2ms',
        max_rtt: lastCl['max-rtt'] || lastCl.time || '1.5ms',
        status: loss === 0 ? 'Normal' : loss < 25 ? 'Waspada' : 'RTO'
      };
    }

    // Router System Resource
    const resRes = await client.write(['/system/resource/print']);
    if (resRes.results && resRes.results[0]) {
      const r0 = resRes.results[0];
      routerResource = {
        cpu_load: parseInt(r0['cpu-load'] || 0),
        free_memory: formatBytes(r0['free-memory']),
        uptime: r0.uptime || '-',
        board_name: r0['board-name'] || 'MikroTik'
      };
    }

    // Simple Queue Info
    const qName = `<pppoe-${userName}>`;
    let qRes = await client.write(['/queue/simple/print', `?name=${qName}`]);
    if (!qRes.results || qRes.results.length === 0) {
      qRes = await client.write(['/queue/simple/print', `?target=${qName}`]);
    }
    if (qRes.results && qRes.results[0]) {
      const q = qRes.results[0];
      const rateParts = (q.rate || '0/0').split('/');
      const limitParts = (q['max-limit'] || '0/0').split('/');
      const byteParts = (q.bytes || '0/0').split('/');
      const dropParts = (q.dropped || '0/0').split('/');

      const upRateBps = parseInt(rateParts[0] || 0);
      const downRateBps = parseInt(rateParts[1] || 0);
      const upLimitBps = parseInt(limitParts[0] || 0);
      const downLimitBps = parseInt(limitParts[1] || 0);
      const totalDrops = parseInt(dropParts[0] || 0) + parseInt(dropParts[1] || 0);

      const upUtilPct = upLimitBps > 0 ? Math.min(100, Math.round((upRateBps / upLimitBps) * 100)) : 0;
      const downUtilPct = downLimitBps > 0 ? Math.min(100, Math.round((downRateBps / downLimitBps) * 100)) : 0;

      queueInfo = {
        name: q.name,
        up_rate_bps: upRateBps,
        down_rate_bps: downRateBps,
        up_rate_formatted: formatBits(upRateBps),
        down_rate_formatted: formatBits(downRateBps),
        up_limit_bps: upLimitBps,
        down_limit_bps: downLimitBps,
        up_limit_formatted: formatBits(upLimitBps),
        down_limit_formatted: formatBits(downLimitBps),
        up_util_pct: upUtilPct,
        down_util_pct: downUtilPct,
        total_drops: totalDrops,
        bytes_up_formatted: formatBytes(byteParts[0] || 0),
        bytes_down_formatted: formatBytes(byteParts[1] || 0),
        bytes_up_raw: parseInt(byteParts[0] || 0),
        bytes_down_raw: parseInt(byteParts[1] || 0)
      };
    }

    // Monitor interface traffic
    try {
      const monRes = await client.write(['/interface/monitor-traffic', `=interface=${qName}`, '=once=']);
      if (monRes.results && monRes.results[0]) {
        const m = monRes.results[0];
        trafficMonitor = {
          rx_bps: parseInt(m['rx-bits-per-second'] || 0),
          tx_bps: parseInt(m['tx-bits-per-second'] || 0),
          rx_formatted: formatBits(m['rx-bits-per-second'] || 0),
          tx_formatted: formatBits(m['tx-bits-per-second'] || 0),
          rx_packets: m['rx-packets-per-second'] || '0',
          tx_packets: m['tx-packets-per-second'] || '0'
        };
      }
    } catch (_) { }

    client.close();
  } catch (err) {
    console.error('Error during MikroTik diagnosis queries:', err.message);
  }

  // Optical Status: Ambil langsung dari modem fisik pelanggan (ZTE Web / Telnet / Huawei), TANPA menyentuh OLT
  let opticalData = null;
  if (ip && ip !== '-') {
    try {
      const cached = opticalCache.get(ip);
      if (cached && !forceRefresh && (Date.now() - cached.timestamp < 120000)) {
        opticalData = cached.data;
      } else {
        opticalData = await inspectModem(ip, userName);
      }
    } catch (_) { }
  }

  // Connected Devices List
  const devicesResult = await getConnectedDevicesList(userName, ip, null, forceRefresh);

  // Root Cause Determination Engine
  let rootCause = 'NORMAL';
  let severity = 'success';
  let title = '✅ SEMUA PARAMETER NORMAL (JARINGAN SEHAT)';
  let summary = 'Seluruh parameter dari sisi Server ISP, Perangkat Modem, maupun Penggunaan Pelanggan terpantau sehat.';
  let detailedFindings = [];
  let recommendations = [];

  // Analisa Layer 1: Sisi Server (Upstream / CPU)
  if (routerPingUpstream && (routerPingUpstream.packet_loss >= 5 || parseInt(routerPingUpstream.avg_rtt) > 75)) {
    rootCause = 'SERVER';
    severity = 'danger';
    title = '🔴 GANGGUAN PADA SISI SERVER (UPSTREAM ISP BERMASALAH)';
    summary = `Koneksi upstream dari Router Server ke internet publik mengalami packet loss ${routerPingUpstream.packet_loss}% dan latensi ${routerPingUpstream.avg_rtt}. Hal ini menyebabkan koneksi internet seluruh pelanggan di server Sukodono terhambat atau putus-putus.`;
    detailedFindings.push(`Ping Upstream ke 8.8.8.8 mengalami loss ${routerPingUpstream.packet_loss}%.`);
    recommendations.push('Periksa link upstream / fiber utama dari ISP penyedia bandwidth ke router.');
  }

  if (routerResource && routerResource.cpu_load > 85) {
    rootCause = 'SERVER';
    severity = 'danger';
    title = '🔴 BEBAN CPU ROUTER SERVER MENCAPAI 100%';
    summary = `Beban CPU Router Server saat ini sangat tinggi (${routerResource.cpu_load}%). Proses penanganan paket internet terhambat di level core router.`;
    detailedFindings.push(`CPU Load Router: ${routerResource.cpu_load}%.`);
    recommendations.push('Periksa rule firewall atau serangan loop trafik pada router Sukodono.');
  }

  // Analisa Layer 2: Sisi Perangkat Modem & Kabel Optik
  if (opticalData && opticalData.rx_val) {
    const rx = opticalData.rx_val;
    if (rx < -27.0) {
      if (rootCause === 'NORMAL') {
        rootCause = 'MODEM';
        severity = 'danger';
        title = '🟡 GANGGUAN PADA JALUR FIBER / MODEM (REDAMAN BURUK)';
        summary = `Redaman optik pelanggan sangat redup (${rx.toFixed(2)} dBm, standar batas normal: -15 s/d -24 dBm). Cahaya laser optik terlalu lemah menyebabkan paket internet rusak (packet drop) sebelum sampai di modem.`;
      }
      detailedFindings.push(`Redaman RX Optik OLT: ${rx.toFixed(2)} dBm (Kritis / Sangat Redup).`);
      recommendations.push('Segera periksa kabel dropcore, sambungan FAST CONNECTOR / adaptor ODP yang menuju ke rumah pelanggan.');
    } else if (rx < -24.5) {
      detailedFindings.push(`Redaman RX Optik: ${rx.toFixed(2)} dBm (Waspada, mendekati batas maksimal toleransi).`);
    }
  }

  if (clientPing && clientPing.packet_loss >= 25) {
    if (rootCause === 'NORMAL') {
      rootCause = 'MODEM';
      severity = 'danger';
      title = '🟡 MODEM PELANGGAN MENGALAMI PACKET LOSS TINGGI (RTO)';
      summary = `Ping dari Router ke IP Modem Pelanggan (${ip}) mengalami packet loss ${clientPing.packet_loss}%. Koneksi fisik modem ke jaringan terputus-putus.`;
    }
    detailedFindings.push(`Ping ke Modem Pelanggan mengalami RTO/Loss sebesar ${clientPing.packet_loss}%.`);
    recommendations.push('Coba restart hardware modem melalui tombol Restart di tabel atau periksa adaptor power modem di rumah pelanggan.');
  }

  // Analisa Layer 3: Sisi Perangkat Pelanggan (Bandwidth Habis / Banyak HP)
  if (queueInfo) {
    const maxUtil = Math.max(queueInfo.down_util_pct, queueInfo.up_util_pct);
    if (maxUtil >= 85 || queueInfo.total_drops > 20) {
      if (rootCause === 'NORMAL') {
        rootCause = 'CLIENT_BANDWIDTH';
        severity = 'warning';
        title = '🟢 GANGGUAN DI PERANGKAT PELANGGAN: BANDWIDTH TERCEKIK (100% PENUH)';
        summary = `Pelanggan merasa 'internet sangat lambat / tidak bisa browsing' karena seluruh kuota bandwidth paketnya (${queueInfo.down_limit_formatted}) sedang terpakai penuh (${queueInfo.down_rate_formatted}, ${maxUtil}%). Terjadi antrian paket terbuang (${queueInfo.total_drops} drops).`;
      }
      detailedFindings.push(`Pemakaian Download saat ini: ${queueInfo.down_rate_formatted} dari batas limit ${queueInfo.down_limit_formatted} (${queueInfo.down_util_pct}%).`);
      if (queueInfo.total_drops > 0) detailedFindings.push(`Paket terbuang (Dropped packets) akibat antrian penuh: ${queueInfo.total_drops} paket.`);
      recommendations.push('Beritahukan pelanggan bahwa salah satu HP atau laptop di rumah sedang mendownload file besar / streaming resolusi tinggi / update otomatis.');
    }
  }

  if (devicesResult.count >= 8) {
    if (rootCause === 'NORMAL') {
      rootCause = 'CLIENT_DEVICES';
      severity = 'warning';
      title = '🟢 GANGGUAN DI PERANGKAT PELANGGAN: TERLALU BANYAK HP TERHUBUNG';
      summary = `Terdeteksi ${devicesResult.count} perangkat aktif terhubung bersamaan ke Wi-Fi modem. Frekuensi Wi-Fi 2.4GHz modem mengalami interferensi/kongesti sehingga kecepatan terbagi sangat kecil per HP.`;
    }
    detailedFindings.push(`Terdeteksi ${devicesResult.count} gadget terhubung pada jaringan Wi-Fi modem.`);
    recommendations.push('Sarankan pelanggan untuk membatasi pemakai Wi-Fi atau ganti password Wi-Fi jika ada perangkat asing yang ikut nebeng.');
  }

  if (rootCause === 'NORMAL') {
    detailedFindings.push('Ping router ke upstream 8.8.8.8 lancar (0% loss, latensi rendah).');
    detailedFindings.push(`Ping router ke modem pelanggan stabil (${clientPing?.avg_rtt || '1ms'}, 0% loss).`);
    if (opticalData?.rx_power) detailedFindings.push(`Kekuatan redaman optik prima: ${opticalData.rx_power}.`);
    if (queueInfo) detailedFindings.push(`Penggunaan bandwidth santai (${queueInfo.down_rate_formatted} / ${queueInfo.down_limit_formatted}).`);
    recommendations.push('Jika pelanggan masih merasa tidak ada internet, periksa pengaturan DNS / proxy pada HP pelanggan atau lakukan restart modem pelanggan.');
  }

  return {
    success: true,
    user: userName,
    ip: ip,
    router: router.name,
    verdict: {
      root_cause: rootCause,
      severity: severity,
      title: title,
      summary: summary,
      findings: detailedFindings,
      recommendations: recommendations
    },
    metrics: {
      server_upstream: routerPingUpstream,
      router_resource: routerResource,
      client_ping: clientPing,
      queue_speed: queueInfo,
      traffic_monitor: trafficMonitor,
      optical_power: opticalData,
      connected_devices: devicesResult
    }
  };
}

function getTrafficHistoryData(user, ip, currentBytes = null) {
  const key = user || ip;
  const userLogs = trafficHistory[key] || trafficHistory[user] || trafficHistory[ip] || [];

  let curDown = 0;
  let curUp = 0;
  if (currentBytes) {
    curDown = currentBytes.down || 0;
    curUp = currentBytes.up || 0;
  } else if (userLogs.length > 0) {
    curDown = userLogs[userLogs.length - 1].rx_bytes || 0;
    curUp = userLogs[userLogs.length - 1].tx_bytes || 0;
  }

  // 1 HARI (24 Jam: jam 00:00 s/d 23:00)
  const oneDayLabels = [];
  const oneDayDown = [];
  const oneDayUp = [];
  const now = new Date();
  const currentHour = now.getHours();

  for (let i = 23; i >= 0; i--) {
    const h = (currentHour - i + 24) % 24;
    const label = `${h.toString().padStart(2, '0')}:00`;
    oneDayLabels.push(label);

    const logInHour = userLogs.find(l => {
      if (!l.timestamp) return false;
      const lt = new Date(l.timestamp);
      return lt.getHours() === h;
    });

    let sampleDown = 0;
    let sampleUp = 0;
    if (logInHour && logInHour.rx_bytes != null) {
      sampleDown = parseFloat(((logInHour.rx_bytes || 0) / 1048576).toFixed(1));
      sampleUp = parseFloat(((logInHour.tx_bytes || 0) / 1048576).toFixed(1));
    } else {
      const hourlyDownShare = curDown > 0 ? (curDown / 1048576) / 24 : 0;
      const hourlyUpShare = curUp > 0 ? (curUp / 1048576) / 24 : 0;
      sampleDown = parseFloat(hourlyDownShare.toFixed(1));
      sampleUp = parseFloat(hourlyUpShare.toFixed(1));
    }
    oneDayDown.push(sampleDown);
    oneDayUp.push(sampleUp);
  }

  // 7 HARI TERAKHIR
  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const sevenDayLabels = [];
  const sevenDayDown = [];
  const sevenDayUp = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayLabel = i === 0 ? 'Hari Ini' : dayNames[d.getDay()];
    sevenDayLabels.push(dayLabel);

    const logInDay = userLogs.find(l => {
      if (!l.timestamp) return false;
      const lt = new Date(l.timestamp);
      return lt.toDateString() === d.toDateString();
    });

    let dayDown = 0;
    let dayUp = 0;
    if (logInDay && logInDay.rx_bytes != null) {
      dayDown = parseFloat(((logInDay.rx_bytes || 0) / 1073741824).toFixed(2));
      dayUp = parseFloat(((logInDay.tx_bytes || 0) / 1073741824).toFixed(2));
    } else {
      const dailyDownShare = curDown > 0 ? (curDown / 1073741824) / 7 : 0;
      const dailyUpShare = curUp > 0 ? (curUp / 1073741824) / 7 : 0;
      dayDown = parseFloat(dailyDownShare.toFixed(2));
      dayUp = parseFloat(dailyUpShare.toFixed(2));
    }
    sevenDayDown.push(dayDown);
    sevenDayUp.push(dayUp);
  }

  // 1 BULAN TERAKHIR (30 Hari)
  const oneMonthLabels = [];
  const oneMonthDown = [];
  const oneMonthUp = [];
  for (let i = 29; i >= 0; i -= 2) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateLabel = `${d.getDate()}/${d.getMonth() + 1}`;
    oneMonthLabels.push(dateLabel);

    const logInMonth = userLogs.find(l => {
      if (!l.timestamp) return false;
      const lt = new Date(l.timestamp);
      return lt.getDate() === d.getDate() && lt.getMonth() === d.getMonth();
    });

    let downGb = 0;
    let upGb = 0;
    if (logInMonth && logInMonth.rx_bytes != null) {
      downGb = parseFloat(((logInMonth.rx_bytes || 0) / 1073741824).toFixed(2));
      upGb = parseFloat(((logInMonth.tx_bytes || 0) / 1073741824).toFixed(2));
    } else {
      const monthDownShare = curDown > 0 ? ((curDown / 1073741824) / 15) : 0;
      const monthUpShare = curUp > 0 ? ((curUp / 1073741824) / 15) : 0;
      downGb = parseFloat(monthDownShare.toFixed(2));
      upGb = parseFloat(monthUpShare.toFixed(2));
    }
    oneMonthDown.push(downGb);
    oneMonthUp.push(upGb);
  }

  const sumDownGb = sevenDayDown.reduce((a, b) => a + b, 0).toFixed(1);
  const sumUpGb = sevenDayUp.reduce((a, b) => a + b, 0).toFixed(1);

  const oneDayObj = {
    labels: oneDayLabels,
    download_mb: oneDayDown,
    upload_mb: oneDayUp,
    unit: 'MB'
  };
  const sevenDaysObj = {
    labels: sevenDayLabels,
    download_gb: sevenDayDown,
    upload_gb: sevenDayUp,
    unit: 'GB'
  };
  const oneMonthObj = {
    labels: oneMonthLabels,
    download_gb: oneMonthDown,
    upload_gb: oneMonthUp,
    unit: 'GB'
  };

  return {
    success: true,
    user: key,
    summary: {
      total_download: `${sumDownGb} GB (7 Hari)`,
      total_upload: `${sumUpGb} GB (7 Hari)`,
      avg_daily: `${(sumDownGb / 7).toFixed(1)} GB/hari`,
      current_download_raw: curDown,
      current_upload_raw: curUp
    },
    one_day: oneDayObj,
    '1_hari': oneDayObj,
    seven_days: sevenDaysObj,
    '7_hari': sevenDaysObj,
    one_month: oneMonthObj,
    '1_bulan': oneMonthObj
  };
}

// Background Traffic Collector (Setiap 15 Menit)
let trafficCollectorTimer = null;
async function startTrafficCollector() {
  if (trafficCollectorTimer) return;
  const runCollection = async () => {
    for (const r of ROUTERS) {
      try {
        const client = new MikroTikClient(r.host, r.port, 5000);
        await client.connect();
        await client.login(r.user, r.pass);
        const qRes = await client.write(['/queue/simple/print']);
        client.close();

        const nowIso = new Date().toISOString();
        (qRes.results || []).forEach(q => {
          if (q.name && q.name.startsWith('<pppoe-')) {
            const userName = q.name.replace(/^<pppoe-/, '').replace(/>$/, '');
            const byteParts = (q.bytes || '0/0').split('/');
            const tx = parseInt(byteParts[0] || 0); // up
            const rx = parseInt(byteParts[1] || 0); // down

            if (!trafficHistory[userName]) trafficHistory[userName] = [];
            trafficHistory[userName].push({ t: nowIso, rx_bytes: rx, tx_bytes: tx });
            if (trafficHistory[userName].length > 100) trafficHistory[userName].shift();
          }
        });
        scheduleSaveTrafficHistory();
      } catch (_) { }
    }
  };
  runCollection();
  trafficCollectorTimer = setInterval(runCollection, 15 * 60 * 1000);
}
startTrafficCollector();

// Helper membaca JSON body dari incoming request
const parseJsonBody = (req) => new Promise((resolve) => {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      resolve(body ? JSON.parse(body) : {});
    } catch (_) {
      resolve({});
    }
  });
});

// ==========================================
// HTTP SERVER & API ROUTES
// ==========================================
const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // 1. Health check
  if (pathname === '/api/modem/health' || (pathname === '/api/modem/ping' && !parsedUrl.query.ip)) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', time: new Date().toISOString() }));
    return;
  }

  // 2. Get Routers
  if (pathname === '/api/modem/routers') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      routers: ROUTERS.map(r => ({ id: r.id, name: r.name, host: r.host }))
    }));
    return;
  }


  // 3. Get Active Clients & Disconnect States from MikroTik
  if (pathname === '/api/modem/clients') {
    const selectedRouter = parsedUrl.query.router || 'all';
    const forceRefresh = parsedUrl.query.refresh === '1';

    // Cek cache in-memory (TTL 60 detik)
    const cachedEntry = clientsMemoryCache.get(selectedRouter);
    if (!forceRefresh && cachedEntry && (Date.now() - cachedEntry.time < 60000)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        cached: true,
        count: cachedEntry.data.length,
        data: cachedEntry.data
      }));
      return;
    }

    const targetRouters = selectedRouter === 'all'
      ? ROUTERS
      : ROUTERS.filter(r => r.id === selectedRouter);

    try {
      // Query router secara PARALEL untuk kecepatan maksimal (hemat waktu)
      const resultsByRouter = await Promise.all(targetRouters.map(async (r) => {
        try {
          const client = new MikroTikClient(r.host, r.port);
          await client.connect();
          await client.login(r.user, r.pass);

          // Ambil ppp active, ppp secret, dan router logs secara sekuensial pada koneksi yang sama
          const activeRes = await client.write(['/ppp/active/print']);
          const secretRes = await client.write(['/ppp/secret/print']);
          let logRes = { results: [] };
          try {
            logRes = await client.write(['/log/print']);
          } catch (_) { }
          client.close();

          // Buat map ppp secret dan rekam riwayat disconnect
          const secretMap = new Map();
          (secretRes.results || []).forEach(s => {
            if (s.name) {
              secretMap.set(s.name, s);
              if (s['last-logged-out'] && s['last-logged-out'] !== '-') {
                const reasonInfo = parseDisconnectReason(s['last-disconnect-reason']);
                recordDisconnectHistory(s.name, {
                  timestamp: s['last-logged-out'],
                  logged_out: s['last-logged-out'],
                  reason: s['last-disconnect-reason'] || 'Disconnected',
                  reason_info: reasonInfo,
                  caller_id: s['last-caller-id'] || '-'
                });
              }
            }
          });

          // Rekam event disconnect dari router log
          (logRes.results || []).forEach(l => {
            const msg = l.message || '';
            if (msg.includes('logged out') || msg.includes('terminating') || msg.includes('disconnected')) {
              let uName = null;
              let discReason = 'Disconnected';
              let callerMac = '-';

              const logoutMatch = msg.match(/^([^\s]+)\s+logged out,\s*.*from\s+([0-9A-Fa-f:]+)/);
              if (logoutMatch) {
                uName = logoutMatch[1];
                callerMac = logoutMatch[2];
                discReason = 'Logged out';
              } else {
                const termMatch = msg.match(/<pppoe-([^>]+)>:\s*terminating\.\.\.\s*-\s*(.+)/i);
                if (termMatch) {
                  uName = termMatch[1];
                  discReason = termMatch[2].trim();
                } else {
                  const discMatch = msg.match(/<pppoe-([^>]+)>:\s*disconnected/i);
                  if (discMatch) {
                    uName = discMatch[1];
                    discReason = 'Connection terminated';
                  }
                }
              }

              if (uName) {
                uName = uName.replace(/^pppoe-/, '').trim();
                const reasonInfo = parseDisconnectReason(discReason);
                recordDisconnectHistory(uName, {
                  timestamp: l.time,
                  logged_out: l.time,
                  reason: discReason,
                  reason_info: reasonInfo,
                  caller_id: callerMac
                });
              }
            }
          });

          // Pelacak transisi online <-> offline real-time
          const currentActiveUsers = new Set();
          (activeRes.results || []).forEach(item => {
            if (item.name) {
              currentActiveUsers.add(item.name);
              const prev = activeClientTracker.get(item.name);
              if (prev && !prev.isActive) {
                // Pelanggan kembali ONLINE (ON)
                const nowStr = new Date().toLocaleString('id-ID', { hour12: false });
                recordDisconnectHistory(item.name, {
                  timestamp: new Date().toISOString(),
                  logged_out: nowStr,
                  reason: 'Modem Menyala Kembali (Online)',
                  reason_info: {
                    state: 'ONLINE',
                    label: '🟢 Modem Menyala Kembali (ON)',
                    badgeBg: '#dcfce7',
                    badgeColor: '#166534'
                  },
                  caller_id: item['caller-id'] || '-'
                });
              }
              activeClientTracker.set(item.name, {
                isActive: true,
                ip: item.address,
                mac: item['caller-id'],
                lastSeen: Date.now()
              });
            }
          });

          // Cek pelanggan yang sebelumnya aktif tapi sekarang padam (OFF)
          for (const [trackedUser, state] of activeClientTracker.entries()) {
            if (state.isActive && !currentActiveUsers.has(trackedUser)) {
              state.isActive = false;
              state.lastOff = Date.now();
              const nowStr = new Date().toLocaleString('id-ID', { hour12: false });
              const offRecord = {
                timestamp: new Date().toISOString(),
                logged_out: nowStr,
                reason: 'Modem Terputus / Padam (OFF)',
                reason_info: {
                  state: 'OFFLINE',
                  label: '🔴 Modem Terputus / Padam (OFF)',
                  badgeBg: '#fee2e2',
                  badgeColor: '#991b1b'
                },
                caller_id: state.mac || '-'
              };
              recordDisconnectHistory(trackedUser, offRecord);
              if (state.ip) {
                recordDisconnectHistory(state.ip, offRecord);
              }
            }
          }

          const activeMap = new Map();
          (activeRes.results || []).forEach(item => {
            if (item.name) activeMap.set(item.name, item);
          });

          const clientList = [];
          const processedNames = new Set();

          // 1. Proses semua secret terdaftar di router (Online maupun Offline)
          (secretRes.results || []).forEach(s => {
            if (!s.name) return;
            processedNames.add(s.name);

            const activeItem = activeMap.get(s.name);
            const isOnline = !!activeItem;

            let customerName = '-';
            const rawComment = (activeItem && activeItem.comment) || s.comment || '';
            if (rawComment) {
              const parts = rawComment.split('|');
              customerName = parts.length > 1 ? parts[1].trim() : rawComment.trim();
            }
            if ((!customerName || customerName === '-') && s.name) {
              customerName = s.name;
            }

            const ipAddress = isOnline ? (activeItem.address || '-') : (s['remote-address'] || '-');
            const mac = isOnline ? (activeItem['caller-id'] || s['last-caller-id'] || s['caller-id'] || '-') : (s['last-caller-id'] || s['caller-id'] || '-');

            const lastLogout = s['last-logged-out'] || '-';
            const lastReasonRaw = s['last-disconnect-reason'] || '';
            const reasonInfo = parseDisconnectReason(lastReasonRaw);

            // Cek optical cache & history
            const cached = ipAddress !== '-' ? opticalCache.get(ipAddress) : null;
            const historyList = opticalHistory[s.name] || (ipAddress !== '-' ? opticalHistory[ipAddress] : []) || [];

            let bestOpt = cached ? cached.data : null;
            if (!bestOpt && historyList.length > 0) {
              bestOpt = historyList.find(h => h.model && h.model !== '-' && h.model !== 'undefined') || historyList[0];
            }

            if (bestOpt && typeof bestOpt.rx_val === 'number' && bestOpt.rx_val > -35) {
              bestOpt.link_state = 'WORKING';
            }

            const macInfo = detectModemInfoFromMac(mac);
            const oltMatch = findOltOnu(s.name, ipAddress, mac);

            let brand = (bestOpt && bestOpt.brand && bestOpt.brand !== 'Unknown' && bestOpt.brand !== 'undefined')
              ? bestOpt.brand
              : (oltMatch && oltMatch.brand ? oltMatch.brand : (macInfo.brand || 'ZTE'));
            let model = (bestOpt && bestOpt.model && bestOpt.model !== '-' && bestOpt.model !== 'undefined')
              ? bestOpt.model.replace(/^(ZTE|Huawei|ZTE\s+ONT)\s+/i, '').trim()
              : (oltMatch && oltMatch.model && oltMatch.model !== '-' ? oltMatch.model : (brand.toLowerCase().includes('zte') ? 'F677 / F663' : (brand.toLowerCase().includes('huawei') ? 'HG8245H' : (brand.toLowerCase().includes('fiberhome') ? 'AN5506' : 'GPON ONT'))));
            let serial = (bestOpt && bestOpt.serial && bestOpt.serial !== '-' && bestOpt.serial !== 'undefined' && !bestOpt.serial.includes(':'))
              ? bestOpt.serial
              : (oltMatch && oltMatch.sn ? oltMatch.sn : (mac && mac !== '-' ? mac.replace(/[^A-Fa-f0-9]/g, '').toUpperCase() : s.name.toUpperCase()));

            clientList.push({
              router_id: r.id,
              router: r.id,
              router_name: r.name,
              pppoe_user: s.name,
              customer_name: customerName,
              raw_comment: rawComment,
              ip_address: ipAddress,
              mac_address: mac,
              brand: brand,
              model: model,
              serial: serial,
              uptime: isOnline ? (activeItem.uptime || '-') : 'Offline',
              is_active: isOnline,
              link_state: isOnline ? 'WORKING' : 'OFFLINE',
              last_logged_out: lastLogout,
              last_reason_raw: lastReasonRaw,
              last_reason: isOnline ? { state: 'ONLINE', label: '🟢 Online (Aktif)', color: '#166534', badgeBg: '#dcfce7', badgeColor: '#166534' } : reasonInfo,
              optical: isOnline ? bestOpt : (bestOpt || { rx_power: 'Offline', rx_val: null, tx_power: '-', temperature: '-', voltage: '-', model: model, link_state: 'OFFLINE' }),
              history_count: historyList.length
            });
          });

          // 2. Tambahkan session active yang mungkin tidak ada di secret (misal dynamic / radius)
          (activeRes.results || []).forEach(item => {
            if (!item.name || processedNames.has(item.name)) return;
            processedNames.add(item.name);

            let customerName = '-';
            const rawComment = item.comment || '';
            if (rawComment) {
              const parts = rawComment.split('|');
              customerName = parts.length > 1 ? parts[1].trim() : rawComment.trim();
            }
            if (!customerName || customerName === '-') customerName = item.name;

            const mac = item['caller-id'] || '-';
            const macInfo = detectModemInfoFromMac(mac);
            const oltMatch = findOltOnu(item.name, item.address, mac);

            clientList.push({
              router_id: r.id,
              router: r.id,
              router_name: r.name,
              pppoe_user: item.name,
              customer_name: customerName,
              raw_comment: rawComment,
              ip_address: item.address || '-',
              mac_address: mac,
              brand: oltMatch && oltMatch.brand ? oltMatch.brand : macInfo.brand,
              model: oltMatch && oltMatch.model ? oltMatch.model : '-',
              serial: oltMatch && oltMatch.sn ? oltMatch.sn : '-',
              uptime: item.uptime || '-',
              is_active: true,
              link_state: 'WORKING',
              last_logged_out: '-',
              last_reason_raw: '',
              last_reason: { state: 'ONLINE', label: '🟢 Online (Aktif)', color: '#166534', badgeBg: '#dcfce7', badgeColor: '#166534' },
              optical: null,
              history_count: 0
            });
          });

          return clientList;
        } catch (routerErr) {
          console.error(`Error querying router ${r.name}:`, routerErr.message);
          return [];
        }
      }));

      const allClients = resultsByRouter.flat();

      // Simpan ke cache memory
      clientsMemoryCache.set(selectedRouter, {
        data: allClients,
        time: Date.now()
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, count: allClients.length, data: allClients }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 4. Check Single Modem Optical Power
  if (pathname === '/api/modem/check') {
    const ip = parsedUrl.query.ip;
    const user = parsedUrl.query.user || '';
    if (!ip) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Parameter ip required' }));
      return;
    }

    try {
      const data = await inspectModem(ip, user);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, ip, user, data }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 4B. Restart / Reboot Modem Pelanggan
  if (pathname === '/api/modem/reboot') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', async () => {
      let bJson = {};
      try { bJson = JSON.parse(body || '{}'); } catch (_) {}
      const ip = (parsedUrl.query.ip || bJson.ip || '').trim();
      const user = (parsedUrl.query.user || bJson.user || '').trim();
      if (!ip && !user) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Parameter ip atau user required' }));
        return;
      }

      try {
        const rebootResult = await rebootModem(ip, user);
        if (rebootResult.success) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            ip,
            user,
            method: rebootResult.method,
            details: rebootResult.details,
            message: `Perintah restart berhasil dieksekusi (${rebootResult.method})`
          }));
        } else {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            ip,
            user,
            message: rebootResult.message || 'Gagal merestart modem'
          }));
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 5. Get Optical & Disconnect History for Specific Client
  if (pathname === '/api/modem/history') {
    const ip = parsedUrl.query.ip || '';
    const user = parsedUrl.query.user || '';
    const key = user || ip;

    const optHist = (opticalHistory[key] || opticalHistory[user] || opticalHistory[ip] || []).slice(0, 50);
    const discHist = (disconnectHistory[key] || disconnectHistory[user] || disconnectHistory[ip] || []).slice(0, 50);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      key,
      optical_history: optHist,
      disconnect_history: discHist
    }));
    return;
  }

  // 6. Get All Disconnect Logs from Routers
  if (pathname === '/api/modem/disconnects') {
    const selectedRouter = parsedUrl.query.router || 'all';
    const targetRouters = selectedRouter === 'all'
      ? ROUTERS
      : ROUTERS.filter(r => r.id === selectedRouter);

    try {
      const disconnectList = [];
      for (const r of targetRouters) {
        try {
          const client = new MikroTikClient(r.host, r.port);
          await client.connect();
          await client.login(r.user, r.pass);
          const activeRes = await client.write(['/ppp/active/print']);
          const secretRes = await client.write(['/ppp/secret/print']);
          client.close();

          const activeNames = new Set((activeRes.results || []).map(a => a.name));

          (secretRes.results || []).forEach(s => {
            if (s.name && s['last-logged-out']) {
              const isActive = activeNames.has(s.name);
              let customerName = '-';
              if (s.comment) {
                const parts = s.comment.split('|');
                customerName = parts.length > 1 ? parts[1].trim() : s.comment.trim();
              }

              const reasonInfo = parseDisconnectReason(s['last-disconnect-reason']);

              disconnectList.push({
                router: r.name,
                username: s.name,
                customer_name: customerName,
                is_currently_active: isActive,
                last_logged_out: s['last-logged-out'],
                last_caller_id: s['last-caller-id'] || '-',
                reason_raw: s['last-disconnect-reason'] || '-',
                reason: reasonInfo
              });
            }
          });
        } catch (_) { }
      }

      // Sort by last_logged_out descending
      disconnectList.sort((a, b) => new Date(b.last_logged_out) - new Date(a.last_logged_out));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, count: disconnectList.length, data: disconnectList.slice(0, 100) }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 7. DIAGNOSTIK KONEKSI & ROOT CAUSE ANALYSIS (SERVER, MODEM, PELANGGAN)
  if (pathname === '/api/modem/diagnose') {
    const ip = parsedUrl.query.ip || '';
    const user = parsedUrl.query.user || '';
    const router = parsedUrl.query.router || '';
    const forceRefresh = parsedUrl.query.refresh === '1';

    try {
      const diag = await runComprehensiveDiagnosis(ip, user, router, forceRefresh);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(diag));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 8. REAL PING TEST (ROUTER -> MODEM & ROUTER -> UPSTREAM 8.8.8.8)
  if (pathname === '/api/modem/ping') {
    const ip = parsedUrl.query.ip || '';
    const routerName = parsedUrl.query.router || 'sukodono';
    const rObj = ROUTERS.find(r => r.id.toLowerCase() === routerName.toLowerCase() || r.name.toLowerCase() === routerName.toLowerCase()) || ROUTERS[1];

    try {
      const [clientRes, upstreamRes] = await Promise.all([
        executeMikroTikPing(rObj, ip, 4),
        executeMikroTikPing(rObj, '8.8.8.8', 4)
      ]);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        router: rObj.name,
        client_ping: clientRes,
        upstream_ping: upstreamRes
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 9. DETEKSI PERANGKAT TERHUBUNG KE MODEM (CONNECTED DEVICES)
  if (pathname === '/api/modem/devices') {
    const ip = parsedUrl.query.ip || '';
    const user = parsedUrl.query.user || '';
    const forceRefresh = parsedUrl.query.refresh === '1';
    const oltMatch = findOltOnu(user, ip);

    try {
      const dev = await getConnectedDevicesList(user, ip, oltMatch?.onu, forceRefresh);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        user,
        ip,
        onu: oltMatch?.onu || '-',
        ...dev
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 10. GRAFIK PEMAKAIAN BANDWIDTH HISTORIS (1 HARI, 7 HARI, 1 BULAN)
  if (pathname === '/api/modem/traffic-history') {
    const ip = parsedUrl.query.ip || '';
    const user = parsedUrl.query.user || '';

    try {
      const hist = getTrafficHistoryData(user, ip);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(hist));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 10B. REALTIME LIVE STREAMING BANDWIDTH TRAFFIC (Rx / Tx bps, packets, total bytes)
  if (pathname === '/api/modem/traffic-realtime') {
    const user = (parsedUrl.query.user || '').trim();
    const routerId = (parsedUrl.query.router || '').trim();
    const ip = (parsedUrl.query.ip || '').trim();

    if (!user && !ip) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Parameter user atau ip diperlukan' }));
      return;
    }

    let targetRouter = ROUTERS.find(r => r.id === routerId && r.enabled !== false);
    if (!targetRouter) {
      targetRouter = ROUTERS.find(r => r.enabled !== false);
    }

    try {
      let activeRouter = targetRouter;
      let targetUser = user;
      let targetIface = user ? `<pppoe-${user}>` : '';

      let monResult = null;
      let ifcResult = null;
      let client = null;

      const routersToTry = targetRouter ? [targetRouter, ...ROUTERS.filter(r => r.id !== targetRouter.id && r.enabled !== false)] : ROUTERS.filter(r => r.enabled !== false);

      for (const r of routersToTry) {
        try {
          client = new MikroTikClient(r.host, r.port, 4000);
          await client.connect();
          await client.login(r.user, r.pass);

          if (!targetUser && ip) {
            const actByIp = await client.write(['/ppp/active/print', `?address=${ip}`]);
            if (actByIp.results && actByIp.results.length > 0) {
              targetUser = actByIp.results[0].name;
              targetIface = `<pppoe-${targetUser}>`;
            }
          }

          if (targetUser) {
            targetIface = `<pppoe-${targetUser}>`;
            const ifcCheck = await client.write(['/interface/print', `?name=${targetIface}`]);
            if (ifcCheck.results && ifcCheck.results.length > 0) {
              ifcResult = ifcCheck.results[0];
              const monRes = await client.write(['/interface/monitor-traffic', `=interface=${targetIface}`, '=once=']);
              monResult = monRes.results?.[0] || {};
              activeRouter = r;
              client.close();
              break;
            }
          }
          client.close();
        } catch (_) {
          if (client) { try { client.close(); } catch(__) {} }
        }
      }

      if (!monResult || !ifcResult) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          is_active: false,
          user: targetUser || user,
          interface: targetIface || '-',
          message: 'Interface PPPoE sedang offline atau tidak aktif saat ini.',
          download_bps: 0,
          upload_bps: 0,
          download_kbps: '0.0',
          upload_kbps: '0.0',
          download_mbps: '0.00',
          upload_mbps: '0.00',
          rx_packets_per_sec: 0,
          tx_packets_per_sec: 0,
          total_packets_per_sec: 0,
          total_download_bytes: 0,
          total_upload_bytes: 0,
          total_download_formatted: '0 B',
          total_upload_formatted: '0 B'
        }));
        return;
      }

      // Pada interface pppoe-in MikroTik:
      // tx-bits-per-second = router kirim ke klien = DOWNLOAD klien
      // rx-bits-per-second = router terima dari klien = UPLOAD klien
      const txBps = parseInt(monResult['tx-bits-per-second'] || '0', 10);
      const rxBps = parseInt(monResult['rx-bits-per-second'] || '0', 10);
      const txPps = parseInt(monResult['tx-packets-per-second'] || '0', 10);
      const rxPps = parseInt(monResult['rx-packets-per-second'] || '0', 10);
      const txBytes = parseInt(ifcResult['tx-byte'] || '0', 10);
      const rxBytes = parseInt(ifcResult['rx-byte'] || '0', 10);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        is_active: true,
        timestamp: Date.now(),
        router_id: activeRouter ? activeRouter.id : '-',
        router_name: activeRouter ? activeRouter.name : '-',
        user: targetUser,
        interface: targetIface,
        download_bps: txBps,
        upload_bps: rxBps,
        download_kbps: (txBps / 1024).toFixed(1),
        upload_kbps: (rxBps / 1024).toFixed(1),
        download_mbps: (txBps / (1024 * 1024)).toFixed(2),
        upload_mbps: (rxBps / (1024 * 1024)).toFixed(2),
        rx_packets_per_sec: rxPps,
        tx_packets_per_sec: txPps,
        total_packets_per_sec: txPps + rxPps,
        total_download_bytes: txBytes,
        total_upload_bytes: rxBytes,
        total_download_formatted: formatBytes(txBytes),
        total_upload_formatted: formatBytes(rxBytes)
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 11. MANAJEMEN SERVER / ROUTER MIKROTIK (CRUD & STATUS TEST)
  if (pathname === '/api/servers') {
    // GET: List all registered servers with status check
    if (req.method === 'GET') {
      const checkLive = parsedUrl.query.check === '1' || routerHealthCache.size === 0;
      try {
        const serverList = await Promise.all(ROUTERS.map(async (r) => {
          let liveInfo = routerHealthCache.get(r.id) || { online: false, cpu_load: '-', free_memory: '-', active_pppoe: '-', latency: '-' };
          if (checkLive && r.enabled !== false) {
            const startT = Date.now();
            try {
              const client = new MikroTikClient(r.host, r.port, 4000);
              await client.connect();
              await client.login(r.user, r.pass);
              const resRes = await client.write(['/system/resource/print']);
              let activePppoeCount = 0;
              try {
                const countRes = await client.write(['/ppp/active/print', '=count-only=']);
                if (countRes && countRes.doneAttributes && countRes.doneAttributes.ret !== undefined) {
                  activePppoeCount = parseInt(countRes.doneAttributes.ret, 10) || 0;
                } else {
                  const pppRes = await client.write(['/ppp/active/print']);
                  activePppoeCount = pppRes.results ? pppRes.results.length : 0;
                }
              } catch (_) {
                try {
                  const pppRes = await client.write(['/ppp/active/print']);
                  activePppoeCount = pppRes.results ? pppRes.results.length : 0;
                } catch (__) { }
              }
              client.close();
              const lat = Date.now() - startT;
              const r0 = resRes.results?.[0] || {};
              liveInfo = {
                online: true,
                cpu_load: r0['cpu-load'] ? `${r0['cpu-load']}%` : '-',
                free_memory: r0['free-memory'] ? formatBytes(r0['free-memory']) : '-',
                uptime: r0.uptime || '-',
                active_pppoe: activePppoeCount,
                latency: `${lat}ms`,
                timestamp: Date.now()
              };
              routerHealthCache.set(r.id, liveInfo);
            } catch (e) {
              liveInfo = {
                online: false,
                cpu_load: '-',
                free_memory: '-',
                active_pppoe: '-',
                latency: '-',
                error: e.message,
                timestamp: Date.now()
              };
              routerHealthCache.set(r.id, liveInfo);
            }
          }
          return {
            id: r.id,
            name: r.name,
            host: r.host,
            port: r.port,
            user: r.user,
            vpn_name: r.vpn_name || '-',
            vpn_user: r.vpn_user || '-',
            enabled: r.enabled !== false,
            ...liveInfo
          };
        }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count: serverList.length, data: serverList }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // POST: Tambah atau Update Server
    if (req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        if (!body.name || !body.host || !body.port || !body.user) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Nama, Host IP, Port API, dan User API wajib diisi' }));
          return;
        }

        const id = body.id || body.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const existingIdx = ROUTERS.findIndex(r => r.id === id);

        const routerObj = {
          id,
          name: body.name.toUpperCase().trim(),
          host: body.host.trim(),
          port: parseInt(body.port, 10),
          user: body.user.trim(),
          pass: body.pass !== undefined ? body.pass : (existingIdx !== -1 ? ROUTERS[existingIdx].pass : ''),
          vpn_name: (body.vpn_name || body.name).toUpperCase().trim(),
          vpn_user: (body.vpn_user || 'PC ADMIN').trim(),
          enabled: body.enabled !== false
        };

        if (existingIdx !== -1) {
          ROUTERS[existingIdx] = routerObj;
        } else {
          ROUTERS.push(routerObj);
        }
        saveRouters();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: `Server ${routerObj.name} berhasil disimpan`, data: routerObj }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // DELETE: Hapus Server
    if (req.method === 'DELETE') {
      const id = parsedUrl.query.id;
      if (!id) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Parameter id wajib diisi' }));
        return;
      }

      const initialLen = ROUTERS.length;
      ROUTERS = ROUTERS.filter(r => r.id !== id);
      if (ROUTERS.length < initialLen) {
        saveRouters();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Server berhasil dihapus' }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Server tidak ditemukan' }));
      }
      return;
    }
  }

  // 12. TEST KONEKSI MIKROTIK
  if (pathname === '/api/servers/test' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      let host = body.host;
      let port = parseInt(body.port || 8728, 10);
      let user = body.user;
      let pass = body.pass || '';

      // Jika testing server yang sudah terdaftar, gunakan kredensial aman yang tersimpan di backend
      if (body.id) {
        const stored = ROUTERS.find(r => r.id === body.id);
        if (stored) {
          host = host || stored.host;
          port = port || stored.port;
          user = user || stored.user;
          if (!pass) pass = stored.pass;
        }
      }

      if (!host || !user) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Host dan User diperlukan' }));
        return;
      }

      const startT = Date.now();
      const client = new MikroTikClient(host, port, 6000);
      await client.connect();
      await client.login(user, pass);
      const resRes = await client.write(['/system/resource/print']);
      let activePppoeCount = 0;
      try {
        const countRes = await client.write(['/ppp/active/print', '=count-only=']);
        if (countRes && countRes.doneAttributes && countRes.doneAttributes.ret !== undefined) {
          activePppoeCount = parseInt(countRes.doneAttributes.ret, 10) || 0;
        } else {
          const pppRes = await client.write(['/ppp/active/print']);
          activePppoeCount = pppRes.results ? pppRes.results.length : 0;
        }
      } catch (_) {
        try {
          const pppRes = await client.write(['/ppp/active/print']);
          activePppoeCount = pppRes.results ? pppRes.results.length : 0;
        } catch (__) { }
      }
      client.close();
      const latency = Date.now() - startT;

      const r0 = resRes.results?.[0] || {};
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: 'Koneksi ke Router MikroTik Berhasil!',
        latency: `${latency}ms`,
        board_name: r0['board-name'] || 'MikroTik',
        version: r0.version || '-',
        cpu_load: r0['cpu-load'] ? `${r0['cpu-load']}%` : '-',
        free_memory: r0['free-memory'] ? formatBytes(r0['free-memory']) : '-',
        uptime: r0.uptime || '-',
        active_pppoe: activePppoeCount
      }));
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 404 Fallback
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`📡 MODEM SERVICE NOC MAHAWIRA READY`);
  console.log(`🌐 Port: http://127.0.0.1:${PORT}`);
  console.log(`🔑 Superadmin Credentials Active (F451, F677, F663, SIGMA, Huawei)`);
  console.log(`📊 History Redaman & Disconnect Tracking Active`);
  console.log(`=======================================================`);
});
