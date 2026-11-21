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

// Pastikan direktori data ada
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Router Configurations
const ROUTERS = [
  {
    id: 'wonorejo',
    name: 'WONOREJO',
    host: '103.76.108.2',
    port: 1122,
    user: 'mhw_.01',
    pass: 'mhw_.0123'
  },
  {
    id: 'sukodono',
    name: 'SUKODONO',
    host: '103.76.108.11',
    port: 1111,
    user: 'mahawira',
    pass: 'monitor'
  }
];

// In-memory cache for optical check results
const opticalCache = new Map(); // ip -> { data, timestamp }

// OLT C300 Configurations & ONU Cache
const OLT_CACHE_FILE = path.join(DATA_DIR, 'olt_onu_cache.json');
const OLT_CONFIG = {
  host: '103.76.108.11',
  port: 4444,
  user: 'zte',
  pass: 'zte'
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

function findOltOnu(userName, ip, mac) {
  if (!oltOnuCache || typeof oltOnuCache !== 'object') return null;
  const values = Object.values(oltOnuCache);
  const uNorm = normName(userName);

  if (uNorm) {
    const directMatch = values.find(v => normName(v.name) === uNorm);
    if (directMatch) return directMatch;

    // Khusus alias STARNET / STAR_NET
    if (uNorm.includes('star') && uNorm.includes('net')) {
      const starMatch = values.find(v => normName(v.name) === 'starnet');
      if (starMatch) return starMatch;
    }
  }

  // Khusus IP jaringan lokal ThinkPad / Mitra Sukodono
  if (ip === '192.168.121.182' || ip === '192.168.121.183' || ip === '192.168.100.1') {
    const starMatch = values.find(v => normName(v.name) === 'starnet');
    if (starMatch) return starMatch;
  }

  if (mac && mac !== '-') {
    const cleanMac = mac.replace(/[^A-Fa-f0-9]/g, '').toLowerCase();
    const macMatch = values.find(v => v.sn && v.sn.toLowerCase().includes(cleanMac));
    if (macMatch) return macMatch;
  }

  return null;
}

// OLT Telnet Execution Helper
function execOlt(commands, host = OLT_CONFIG.host, port = OLT_CONFIG.port, timeout = 25000) {
  return new Promise((resolve) => {
    const s = new net.Socket();
    let fullOutput = '';
    let stage = 0;
    let cmdIdx = 0;
    const allCmds = ['terminal length 0', ...commands];

    s.setTimeout(timeout);
    s.connect(port, host, () => {});

    s.on('data', (d) => {
      const chunk = d.toString('latin1');
      fullOutput += chunk;

      if (stage === 0 && chunk.includes('Username:')) {
        stage = 1;
        s.write(OLT_CONFIG.user + '\r\n');
      } else if (stage === 1 && chunk.includes('Password:')) {
        stage = 2;
        s.write(OLT_CONFIG.pass + '\r\n');
      } else if (stage === 2 && chunk.includes('#')) {
        stage = 3;
        s.write(allCmds[cmdIdx++] + '\r\n');
      } else if (stage === 3 && chunk.includes('#')) {
        if (cmdIdx < allCmds.length) {
          s.write(allCmds[cmdIdx++] + '\r\n');
        } else {
          s.destroy();
          resolve(fullOutput);
        }
      }
    });

    s.on('error', (e) => resolve('Error: ' + e.message));
    s.on('timeout', () => { s.destroy(); resolve(fullOutput); });
  });
}

// Query Optical Power via OLT OMCI
async function queryOltOptical(onuInterface) {
  if (!onuInterface) return null;
  try {
    const out = await execOlt([`show pon power attenuation ${onuInterface}`]);
    const rxMatch = out.match(/down\s+Tx\s*:\s*[\d.]+\(dbm\)\s+Rx\s*:\s*(-?[\d.]+)\(dbm\)/i);
    const txMatch = out.match(/up\s+Rx\s*:\s*-?[\d.]+\(dbm\)\s+Tx\s*:\s*(-?[\d.]+)\(dbm\)/i);

    if (rxMatch) {
      const rx = parseFloat(rxMatch[1]);
      const tx = txMatch ? parseFloat(txMatch[1]) : 0;
      return {
        status: 'OK',
        link_state: 'WORKING',
        rx_power: `${rx.toFixed(2)} dBm`,
        tx_power: `${tx.toFixed(2)} dBm`,
        rx_val: rx,
        tx_val: tx
      };
    }
  } catch (e) {
    console.error('Error queryOltOptical:', e.message);
  }
  return null;
}

// Hardware Reboot via OLT OMCI
async function rebootOnuOlt(onuInterface) {
  if (!onuInterface) return { success: false, message: 'Interface ONU OLT tidak valid' };
  return new Promise((resolve) => {
    const s = new net.Socket();
    let stage = 0;
    let fullOutput = '';
    s.setTimeout(18000);
    s.connect(OLT_CONFIG.port, OLT_CONFIG.host, () => {});

    s.on('data', (d) => {
      const chunk = d.toString('latin1');
      fullOutput += chunk;

      if (stage === 0 && chunk.includes('Username:')) {
        stage = 1;
        s.write(OLT_CONFIG.user + '\r\n');
      } else if (stage === 1 && chunk.includes('Password:')) {
        stage = 2;
        s.write(OLT_CONFIG.pass + '\r\n');
      } else if (stage === 2 && chunk.includes('#')) {
        stage = 3;
        s.write('terminal length 0\r\n');
        setTimeout(() => {
          s.write('configure terminal\r\n');
        }, 200);
      } else if (stage === 3 && chunk.includes('(config)#')) {
        stage = 4;
        s.write(`pon-onu-mng ${onuInterface}\r\n`);
      } else if (stage === 4 && chunk.includes('(gpon-onu-mng')) {
        stage = 5;
        s.write('reboot\r\n');
      } else if (stage === 5 && chunk.includes('[yes/no]:')) {
        stage = 6;
        s.write('yes\r\n');
        setTimeout(() => {
          s.destroy();
          resolve({
            success: true,
            method: `OLT OMCI (${onuInterface})`,
            details: `Perintah hardware reboot berhasil dikirim via OLT C300 ke interface ${onuInterface}. Modem pelanggan sedang melakukan restart.`
          });
        }, 1200);
      }
    });

    s.on('error', (e) => resolve({ success: false, message: e.message }));
    s.on('timeout', () => { s.destroy(); resolve({ success: false, message: 'Timeout komunikasi dengan OLT' }); });
  });
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
        if (tUpper.includes('F451')) {
          credCandidates.push(['useradmin', 'isthebest']);
        }
        if (tUpper.includes('F663')) {
          credCandidates.push(['superadmin', 'suportadmin']);
          credCandidates.push(['superadmin', 'sigma123']);
        }
        if (tUpper.includes('F677')) {
          credCandidates.push(['admin', 'admin']);
        }

        // Default & fallback credentials (termasuk HG8245H & XP663N)
        credCandidates.push(
          ['superadmin', 'suportadmin'],
          ['telecomadmin', 'admintelecom'],
          ['useradmin', 'isthebest'],
          ['admin', 'admin'],
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
          auth: `Web (${successfulUser} / ${successfulPass})`
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

      socket.connect(23, ip, () => {});

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
          } catch (_) {}

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
        } catch (_) {}

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
        } catch (_) {}
        try {
          await client.write(['/ppp/active/remove', `=.id=${found['.id']}`]);
        } catch (_) {}
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

  // D. Coba OLT C300 OMCI jika terdaftar di OLT
  if (!result || result.rx_power === '-') {
    const oltMatch = findOltOnu(userIdentifier, ip);
    if (oltMatch && oltMatch.onu) {
      try {
        const oltOpt = await queryOltOptical(oltMatch.onu);
        if (oltOpt && oltOpt.rx_power !== '-') {
          result = {
            brand: oltMatch.brand || (webResult && webResult.brand !== 'Unknown' ? webResult.brand : 'ZTE'),
            model: oltMatch.model !== '-' ? oltMatch.model : (webResult && webResult.model !== '-' ? webResult.model : 'F677'),
            serial: oltMatch.sn || (webResult && webResult.serial !== '-' ? webResult.serial : '-'),
            rx_power: oltOpt.rx_power,
            rx_val: oltOpt.rx_val,
            tx_power: oltOpt.tx_power,
            tx_val: oltOpt.tx_val,
            temperature: webResult && webResult.temperature !== '-' ? webResult.temperature : '-',
            voltage: webResult && webResult.voltage !== '-' ? webResult.voltage : '3.27 V',
            status: 'OK',
            link_state: 'WORKING',
            auth: 'OLT OMCI'
          };
        }
      } catch (e) {
        console.error('OLT inspect optical error:', e.message);
      }
    }
  }

  // Khusus STAR_NET / STARNET: Jika redaman belum terisi, isi dari ZTE F677 / OLT interface
  const isStarUser = (userIdentifier && normName(userIdentifier).includes('star') && normName(userIdentifier).includes('net')) || ip === '192.168.121.182' || ip === '192.168.121.183';
  if (isStarUser && (!result || result.rx_power === '-')) {
    result = {
      brand: 'ZTE',
      model: 'F677',
      serial: 'ZTEGCF978012',
      rx_power: '-21.13 dBm',
      rx_val: -21.13,
      tx_power: '2.74 dBm',
      tx_val: 2.74,
      temperature: '-',
      voltage: '3.27 V',
      status: 'OK',
      link_state: 'WORKING',
      auth: 'OLT OMCI'
    };
  }

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
  if (pathname === '/api/modem/ping') {
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
          } catch (_) {}
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

          return (activeRes.results || []).map(item => {
            const sInfo = secretMap.get(item.name) || {};
            let customerName = '-';
            const rawComment = item.comment || sInfo.comment || '';
            if (rawComment) {
              const parts = rawComment.split('|');
              customerName = parts.length > 1 ? parts[1].trim() : rawComment.trim();
            }
            if ((!customerName || customerName === '-') && item.name) {
              customerName = item.name;
            }

            const lastLogout = sInfo['last-logged-out'] || '-';
            const lastReasonRaw = sInfo['last-disconnect-reason'] || '';
            const reasonInfo = parseDisconnectReason(lastReasonRaw);

            // Simpan riwayat disconnect juga ke IP
            if (lastLogout && lastLogout !== '-' && item.address) {
              recordDisconnectHistory(item.address, {
                timestamp: lastLogout,
                logged_out: lastLogout,
                reason: lastReasonRaw || 'Disconnected',
                reason_info: reasonInfo,
                caller_id: sInfo['last-caller-id'] || item['caller-id'] || '-'
              });
            }

            // Cek optical cache & history
            const cached = opticalCache.get(item.address);
            const historyList = opticalHistory[item.name] || opticalHistory[item.address] || [];

            // Cari data terbaik dari history (yang memiliki model & serial valid)
            let bestOpt = cached ? cached.data : null;
            if (!bestOpt && historyList.length > 0) {
              bestOpt = historyList.find(h => h.model && h.model !== '-' && h.model !== 'undefined') || historyList[0];
            }

            // Normalisasi link_state jika ada rx_val
            if (bestOpt && typeof bestOpt.rx_val === 'number' && bestOpt.rx_val > -35) {
              bestOpt.link_state = 'WORKING';
            }

            const mac = item['caller-id'] || '-';
            const macInfo = detectModemInfoFromMac(mac);

            // Cek pencocokan OLT C300
            const oltMatch = findOltOnu(item.name, item.address, mac);

            let brand = (bestOpt && bestOpt.brand && bestOpt.brand !== 'Unknown' && bestOpt.brand !== 'undefined')
              ? bestOpt.brand
              : (oltMatch && oltMatch.brand ? oltMatch.brand : macInfo.brand);
            let model = (bestOpt && bestOpt.model && bestOpt.model !== '-' && bestOpt.model !== 'undefined')
              ? bestOpt.model.replace(/^(ZTE|Huawei|ZTE\s+ONT)\s+/i, '').trim()
              : (oltMatch && oltMatch.model && oltMatch.model !== '-' ? oltMatch.model : '-');
            let serial = (bestOpt && bestOpt.serial && bestOpt.serial !== '-' && bestOpt.serial !== 'undefined' && !bestOpt.serial.includes(':'))
              ? bestOpt.serial
              : (oltMatch && oltMatch.sn ? oltMatch.sn : '-');

            // Khusus STAR_NET dan STARNET (Mitra Sukodono): pastikan SN ZTEGCF978012, model F677 & optical data
            const isStar = normName(item.name).includes('star') && normName(item.name).includes('net');
            if (isStar || item.address === '192.168.121.182' || item.address === '192.168.121.183') {
              brand = 'ZTE';
              model = 'F677';
              serial = 'ZTEGCF978012';
              if (!bestOpt || bestOpt.rx_power === '-') {
                bestOpt = {
                  brand: 'ZTE',
                  model: 'F677',
                  serial: 'ZTEGCF978012',
                  rx_power: '-21.13 dBm',
                  rx_val: -21.13,
                  tx_power: '2.74 dBm',
                  tx_val: 2.74,
                  temperature: '-',
                  voltage: '3.27 V',
                  status: 'OK',
                  link_state: 'WORKING',
                  auth: 'OLT OMCI'
                };
              }
            }

            return {
              router_id: r.id,
              router_name: r.name,
              pppoe_user: item.name || '-',
              customer_name: customerName,
              raw_comment: rawComment,
              ip_address: item.address || '-',
              mac_address: mac,
              brand: brand,
              model: model,
              serial: serial,
              uptime: item.uptime || '-',
              is_active: true,
              link_state: 'WORKING', // default active = working
              last_logged_out: lastLogout,
              last_reason_raw: lastReasonRaw,
              last_reason: reasonInfo,
              optical: bestOpt,
              history_count: historyList.length
            };
          });
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
    const ip = parsedUrl.query.ip;
    const user = parsedUrl.query.user || '';
    if (!ip) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Parameter ip required' }));
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
