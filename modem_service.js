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

// Load persistent history
function loadHistory(file) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8')) || {};
    }
  } catch (_) { }
  return {};
}

function saveHistory(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Gagal simpan history:', err.message);
  }
}

let opticalHistory = loadHistory(OPTICAL_HISTORY_FILE);
let disconnectHistory = loadHistory(DISCONNECT_HISTORY_FILE);

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
  saveHistory(OPTICAL_HISTORY_FILE, opticalHistory);
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
    serial: cleanMac || mac
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
async function queryZteWeb(ip) {
  return new Promise((resolve) => {
    const timeoutMs = 2500;
    const req = http.get(`http://${ip}/`, { timeout: timeoutMs }, (res) => {
      let html = '';
      res.on('data', c => html += c);
      res.on('end', async () => {
        const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : 'ZTE ONT';

        const tokenMatch = html.match(/getObj\("Frm_Logintoken"\)\.value\s*=\s*"(\d+)"/) || html.match(/Frm_Logintoken[^>]*value="([^"]+)"/i);
        const token = tokenMatch ? tokenMatch[1] : '1';

        // Susun kandidat username & password berdasarkan tipe modem
        const credCandidates = [];
        const tUpper = title.toUpperCase();

        if (tUpper.includes('XP663') || tUpper.includes('XP663N')) {
          credCandidates.push(['superadmin', 'suportadmin']);
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

        for (const [user, pass] of uniqueCreds) {
          const postData = querystring.stringify({
            action: 'login',
            Username: user,
            username: user,
            user_name: user,
            Password: pass,
            password: pass,
            Frm_Logintoken: token,
            frashnum: ''
          });

          const loginAttempt = await new Promise((lResolve) => {
            const pReq = http.request({
              hostname: ip,
              port: 80,
              path: '/',
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData),
                'User-Agent': 'Mozilla/5.0'
              },
              timeout: 1500
            }, (pRes) => {
              if (pRes.statusCode === 302 || Boolean(pRes.headers.location)) {
                lResolve(true);
              } else {
                lResolve(false);
              }
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

        const fetchPage = (pageName) => new Promise((pRes) => {
          http.get({
            hostname: ip,
            port: 80,
            path: `/getpage.gch?pid=1002&nextpage=${pageName}`,
            headers: { 'User-Agent': 'Mozilla/5.0' },
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

        // 2. Jika rxVal belum ada, coba gpon_status_link_t.gch (GPON model F677 / F663)
        if (rxVal === null) {
          const gponHtml = await fetchPage('gpon_status_link_t.gch');
          if (gponHtml) {
            const rxMatch = gponHtml.match(/var\s+RxPower\s*=\s*"(-?[0-9]+)"/i);
            const txMatch = gponHtml.match(/var\s+TxPower\s*=\s*"(-?[0-9]+)"/i);
            const voltMatch = gponHtml.match(/id="Frm_Volt"[^>]*>([0-9]+)</i);
            const tempMatch = gponHtml.match(/id="Frm_Temp"[^>]*>([0-9]+)</i);

            if (rxMatch) {
              rxVal = parseFloat((parseFloat(rxMatch[1]) / 10000).toFixed(2));
              rxDbm = `${rxVal.toFixed(2)} dBm`;
            }
            if (txMatch) txDbm = `${(parseFloat(txMatch[1]) / 10000).toFixed(2)} dBm`;
            if (voltMatch) voltV = `${(parseFloat(voltMatch[1]) / 1000000).toFixed(2)} V`;
            if (tempMatch && tempMatch[1] !== '0') tempC = `${tempMatch[1]} °C`;

            if (rxVal !== null && rxVal > -35) {
              linkState = 'WORKING';
            } else if (/\b(Alarm_LOS|Loss of signal|LOS_Alarm)\b/i.test(gponHtml)) {
              linkState = 'LOS';
            }
          }
        }

        // 3. Jika rxVal masih belum ada, coba pon_status_link_info_t.gch (EPON model F451)
        if (rxVal === null) {
          const ponHtml = await fetchPage('pon_status_link_info_t.gch');
          if (ponHtml) {
            const rxMatch = ponHtml.match(/var\s+RxPower\s*=\s*"(-?[0-9]+)"/i);
            const txMatch = ponHtml.match(/var\s+TxPower\s*=\s*"(-?[0-9]+)"/i);
            const losMatch = ponHtml.match(/var\s+LosInfo\s*=\s*"([0-9]+)"/i);

            if (rxMatch) {
              rxVal = parseFloat((parseFloat(rxMatch[1]) / 10000).toFixed(2));
              rxDbm = `${rxVal.toFixed(2)} dBm`;
            }
            if (txMatch) txDbm = `${(parseFloat(txMatch[1]) / 10000).toFixed(2)} dBm`;
            if (losMatch && losMatch[1] === '1' && (rxVal === null || rxVal <= -35)) {
              linkState = 'LOS';
            }
          }
        }

        // 4. Fallback model & serial jika belum ketemu
        if (serial === '-') {
          const snTr = devHtml.match(/<tr[^>]*>\s*<td[^>]*>\s*(?:Serial\s*Number|GPON\s*SN|SN)\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
          if (snTr) serial = decodeHtmlEntities(snTr[1].replace(/<[^>]*>/g, '').trim());
        }
        if (serial === '-') {
          const ztegMatch = devHtml.match(/\b(ZTEG[0-9A-Fa-f]{8})\b/i) || devHtml.match(/\b(485754[0-9A-Fa-f]{10})\b/i);
          if (ztegMatch) serial = ztegMatch[1].toUpperCase();
        }
        if (model === title) {
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

// 4. MAIN INSPECTION DISPATCHER & HISTORY LOGGING
async function inspectModem(ip, userIdentifier = '') {
  // Cek in-memory cache (< 2 menit)
  const cached = opticalCache.get(ip);
  if (cached && Date.now() - cached.timestamp < 120000) {
    return cached.data;
  }

  let result = null;

  // A. Coba ZTE Web GUI (F677, F663NV3a, SIGMA, F451, F670L)
  const webResult = await queryZteWeb(ip);
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

  // Simpan pembacaan ke history persisten HANYA jika pembacaan optik valid (status OK)
  if (result && result.status === 'OK' && result.rx_val !== null) {
    const historyRecord = {
      timestamp: new Date().toISOString(),
      ip: ip,
      user: userIdentifier || '',
      brand: result.brand || 'ZTE',
      model: result.model || '-',
      serial: result.serial || '-',
      rx_power: result.rx_power,
      rx_val: result.rx_val,
      tx_power: result.tx_power,
      temperature: result.temperature,
      voltage: result.voltage,
      link_state: result.link_state,
      auth: result.auth
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

  // Cache in-memory untuk klien aktif agar load data super cepat & hemat sumber daya
  const clientsMemoryCache = new Map();

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

          // Ambil ppp active dan ppp secret bersamaan
          const [activeRes, secretRes] = await Promise.all([
            client.write(['/ppp/active/print']),
            client.write(['/ppp/secret/print'])
          ]);
          client.close();

          // Buat map ppp secret untuk disconnect info (last-logged-out, last-disconnect-reason)
          const secretMap = new Map();
          (secretRes.results || []).forEach(s => {
            if (s.name) {
              secretMap.set(s.name, s);
            }
          });

          return (activeRes.results || []).map(item => {
            let customerName = '-';
            const rawComment = item.comment || '';
            if (rawComment) {
              const parts = rawComment.split('|');
              customerName = parts.length > 1 ? parts[1].trim() : rawComment.trim();
            }

            const sInfo = secretMap.get(item.name) || {};
            const lastLogout = sInfo['last-logged-out'] || '-';
            const lastReasonRaw = sInfo['last-disconnect-reason'] || '';
            const reasonInfo = parseDisconnectReason(lastReasonRaw);

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

            let brand = (bestOpt && bestOpt.brand && bestOpt.brand !== 'Unknown' && bestOpt.brand !== 'undefined')
              ? bestOpt.brand
              : macInfo.brand;
            let model = (bestOpt && bestOpt.model && bestOpt.model !== '-' && bestOpt.model !== 'undefined')
              ? bestOpt.model.replace(/^(ZTE|Huawei|ZTE\s+ONT)\s+/i, '').trim()
              : '-';
            let serial = (bestOpt && bestOpt.serial && bestOpt.serial !== '-' && bestOpt.serial !== 'undefined')
              ? bestOpt.serial
              : (macInfo.serial !== '-' ? macInfo.serial : mac);

            return {
              router_id: r.id,
              router_name: r.name,
              pppoe_user: item.name || '-',
              customer_name: customerName,
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

  // 5. Get Optical & Disconnect History for Specific Client
  if (pathname === '/api/modem/history') {
    const ip = parsedUrl.query.ip || '';
    const user = parsedUrl.query.user || '';
    const key = user || ip;

    const optHist = (opticalHistory[key] || opticalHistory[ip] || []).slice(0, 30);
    const discHist = (disconnectHistory[key] || disconnectHistory[ip] || []).slice(0, 30);

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
          const [activeRes, secretRes] = await Promise.all([
            client.write(['/ppp/active/print']),
            client.write(['/ppp/secret/print'])
          ]);
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
