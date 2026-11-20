// modem_service.js - Service Backend Cek Modem & Mikrotik PPPoE untuk Dashboard NOC Mahawira
// Menggunakan pure Node.js (http, net, crypto) tanpa dependency eksternal

const http = require('http');
const net = require('net');
const crypto = require('crypto');
const url = require('url');
const querystring = require('querystring');

const PORT = 7878;

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
      try { this.socket.destroy(); } catch (_) {}
    }
    this.connected = false;
  }
}

// ==========================================
// MODEM INSPECTOR (ZTE & HUAWEI)
// ==========================================
function decodeHtmlEntities(str) {
  if (!str) return '';
  return str.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');
}

// 1. ZTE TELNET INSPECTION (F452, F451, F609)
async function queryZteTelnet(ip) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2500);
    let stage = 0;
    let output = '';

    socket.connect(23, ip, () => {});

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
        auth: 'Telnet (root / Zte521)'
      });
    });
  });
}

// 2. ZTE WEB GUI INSPECTION (F677, F663NV3a, F670L, XP663N, GM220-S)
async function queryZteWeb(ip) {
  return new Promise((resolve) => {
    const timeoutMs = 2500;
    const req = http.get(`http://${ip}/`, { timeout: timeoutMs }, (res) => {
      let html = '';
      res.on('data', c => html += c);
      res.on('end', () => {
        const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : 'ZTE ONT';

        const tokenMatch = html.match(/getObj\("Frm_Logintoken"\)\.value\s*=\s*"(\d+)"/);
        const token = tokenMatch ? tokenMatch[1] : '1';

        const postData = querystring.stringify({
          action: 'login',
          Username: 'admin',
          Password: 'admin',
          Frm_Logintoken: token,
          frashnum: ''
        });

        const postReq = http.request({
          hostname: ip,
          port: 80,
          path: '/',
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData),
            'User-Agent': 'Mozilla/5.0'
          },
          timeout: timeoutMs
        }, (postRes) => {
          http.get({
            hostname: ip,
            port: 80,
            path: '/getpage.gch?pid=1002&nextpage=gpon_status_link_t.gch',
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: timeoutMs
          }, (optRes) => {
            let optHtml = '';
            optRes.on('data', c => optHtml += c);
            optRes.on('end', () => {
              const rxMatch = optHtml.match(/var\s+RxPower\s*=\s*"(-?[0-9]+)"/i);
              const txMatch = optHtml.match(/var\s+TxPower\s*=\s*"(-?[0-9]+)"/i);
              const voltMatch = optHtml.match(/id="Frm_Volt"[^>]*>([0-9]+)</i);
              const tempMatch = optHtml.match(/id="Frm_Temp"[^>]*>([0-9]+)</i);

              let rxDbm = '-';
              let txDbm = '-';
              let voltV = '-';
              let tempC = '-';

              if (rxMatch) {
                const val = parseFloat(rxMatch[1]) / 10000;
                rxDbm = `${val.toFixed(2)} dBm`;
              }
              if (txMatch) {
                const val = parseFloat(txMatch[1]) / 10000;
                txDbm = `${val.toFixed(2)} dBm`;
              }
              if (voltMatch) {
                const val = parseFloat(voltMatch[1]) / 1000000;
                voltV = `${val.toFixed(2)} V`;
              }
              if (tempMatch && tempMatch[1] !== '0') {
                tempC = `${tempMatch[1]} °C`;
              }

              // Query device info
              http.get({
                hostname: ip,
                port: 80,
                path: '/getpage.gch?pid=1002&nextpage=status_dev_info_t.gch',
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: timeoutMs
              }, (devRes) => {
                let devHtml = '';
                devRes.on('data', c => devHtml += c);
                devRes.on('end', () => {
                  const modelTr = devHtml.match(/<tr[^>]*>\s*<td[^>]*>\s*Model\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
                  const snTr = devHtml.match(/<tr[^>]*>\s*<td[^>]*>\s*Serial\s+Number\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);

                  let model = title;
                  let sn = '-';
                  if (modelTr) {
                    const clean = decodeHtmlEntities(modelTr[1].replace(/<[^>]*>/g, '').trim());
                    if (clean && !clean.includes('model name')) model = clean;
                  }
                  if (snTr) {
                    sn = decodeHtmlEntities(snTr[1].replace(/<[^>]*>/g, '').trim());
                  }

                  resolve({
                    brand: 'ZTE',
                    model: model || title,
                    serial: sn,
                    rx_power: rxDbm,
                    rx_val: rxDbm !== '-' ? parseFloat(rxDbm) : null,
                    tx_power: txDbm,
                    temperature: tempC,
                    voltage: voltV,
                    status: 'OK',
                    auth: 'Web (admin / admin)'
                  });
                });
              }).on('error', () => {
                resolve({
                  brand: 'ZTE',
                  model: title,
                  serial: '-',
                  rx_power: rxDbm,
                  rx_val: rxDbm !== '-' ? parseFloat(rxDbm) : null,
                  tx_power: txDbm,
                  temperature: tempC,
                  voltage: voltV,
                  status: 'OK',
                  auth: 'Web (admin / admin)'
                });
              });
            });
          }).on('error', () => resolve(null));
        });
        postReq.on('error', () => resolve(null));
        postReq.write(postData);
        postReq.end();
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

// 3. HUAWEI ONT INSPECTION
async function queryHuawei(ip) {
  return new Promise((resolve) => {
    // Check if port 80 / 23 is Huawei
    const socket = new net.Socket();
    socket.setTimeout(2000);
    let stage = 0;
    let output = '';

    socket.connect(23, ip, () => {});
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
        auth: 'Telnet (root / adminHW)'
      });
    });
  });
}

// 4. MAIN INSPECTION DISPATCHER
async function inspectModem(ip) {
  // Check memory cache (< 3 minutes)
  const cached = opticalCache.get(ip);
  if (cached && Date.now() - cached.timestamp < 180000) {
    return cached.data;
  }

  // A. Try ZTE Web GUI (F677, F663NV3a, F670L, etc.)
  const webResult = await queryZteWeb(ip);
  if (webResult && webResult.rx_power !== '-') {
    opticalCache.set(ip, { data: webResult, timestamp: Date.now() });
    return webResult;
  }

  // B. Try ZTE Telnet (F452, F451, F609)
  const telnetResult = await queryZteTelnet(ip);
  if (telnetResult && telnetResult.rx_power !== '-') {
    if (webResult && webResult.model && webResult.model !== 'ZTE ONT') {
      telnetResult.model = webResult.model;
    }
    opticalCache.set(ip, { data: telnetResult, timestamp: Date.now() });
    return telnetResult;
  }

  // C. Try Huawei ONT
  const huaweiResult = await queryHuawei(ip);
  if (huaweiResult && huaweiResult.rx_power !== '-') {
    opticalCache.set(ip, { data: huaweiResult, timestamp: Date.now() });
    return huaweiResult;
  }

  if (webResult) {
    opticalCache.set(ip, { data: webResult, timestamp: Date.now() });
    return webResult;
  }
  if (telnetResult) {
    opticalCache.set(ip, { data: telnetResult, timestamp: Date.now() });
    return telnetResult;
  }
  if (huaweiResult) {
    opticalCache.set(ip, { data: huaweiResult, timestamp: Date.now() });
    return huaweiResult;
  }

  const failResult = {
    brand: 'Unknown',
    model: '-',
    serial: '-',
    rx_power: '-',
    rx_val: null,
    tx_power: '-',
    temperature: '-',
    voltage: '-',
    status: 'Offline / Port Closed',
    auth: '-'
  };
  return failResult;
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

  // 3. Get Active Clients from MikroTik
  if (pathname === '/api/modem/clients') {
    const selectedRouter = parsedUrl.query.router || 'all';
    const targetRouters = selectedRouter === 'all'
      ? ROUTERS
      : ROUTERS.filter(r => r.id === selectedRouter);

    try {
      const allClients = [];
      for (const r of targetRouters) {
        try {
          const client = new MikroTikClient(r.host, r.port);
          await client.connect();
          await client.login(r.user, r.pass);
          const activeRes = await client.write(['/ppp/active/print']);
          client.close();

          const list = (activeRes.results || []).map(item => {
            // Parse customer name from comment if available
            let customerName = '-';
            const rawComment = item.comment || '';
            if (rawComment) {
              const parts = rawComment.split('|');
              customerName = parts.length > 1 ? parts[1].trim() : rawComment.trim();
            }

            // Check if cached optical data exists
            const cached = opticalCache.get(item.address);

            return {
              router_id: r.id,
              router_name: r.name,
              pppoe_user: item.name || '-',
              customer_name: customerName,
              ip_address: item.address || '-',
              mac_address: item['caller-id'] || '-',
              uptime: item.uptime || '-',
              optical: cached ? cached.data : null
            };
          });

          allClients.push(...list);
        } catch (routerErr) {
          console.error(`Error querying router ${r.name}:`, routerErr.message);
        }
      }

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
    if (!ip) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Parameter ip required' }));
      return;
    }

    try {
      const data = await inspectModem(ip);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, ip, data }));
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
  console.log(`📡 Routers: WONOREJO & SUKODONO connected`);
  console.log(`=======================================================`);
});
