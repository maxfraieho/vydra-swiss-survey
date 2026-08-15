#!/usr/bin/env node
/**
 * bin/dom_probe.mjs
 * Connects via CDP to inspect the live Astryx survey console on https://survey.exodus.pp.ua
 * Captures live screenshots and verifies navCount, Viewport modes, 390px overflow, and /gate redirect.
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
let WebSocket;
try {
  WebSocket = require('ws');
} catch {
  WebSocket = require('/usr/share/nodejs/ws/index.js');
}

const BASE_URL = (process.argv[2] || 'https://survey.exodus.pp.ua').replace(/\/+$/, '');
const CDP_PORT = 9226;
const AUTH_COOKIE = 'oDWnckh7aaA8HOJiskM3uvvmUi7nQFX6';
const OUT_DIR = path.resolve('docs/astryx-refactor/evidence/020C');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function getCDPTarget() {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${CDP_PORT}/json/list`, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          const list = JSON.parse(data);
          const page = list.find(t => t.type === 'page' && !t.url.startsWith('devtools://'));
          if (!page || !page.webSocketDebuggerUrl) {
            return reject(new Error('No debuggable page target found'));
          }
          resolve(page.webSocketDebuggerUrl);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function createCDPSession(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 1;
  const pending = new Map();
  const pageErrors = [];

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        const txt = msg.params.exceptionDetails?.text || 'Unknown JS Exception';
        pageErrors.push(txt);
      }
    } catch (e) {}
  });

  const send = (method, params = {}) => {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  };

  const waitReady = () => new Promise((resolve) => ws.on('open', resolve));

  return { ws, send, waitReady, pageErrors };
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function captureShot(session, filepath) {
  const shot = await session.send('Page.captureScreenshot', { format: 'png' });
  const buf = Buffer.from(shot.data, 'base64');
  fs.writeFileSync(filepath, buf);
  const hash = crypto.createHash('sha256').update(buf).digest('hex');
  return hash;
}

async function runProbe() {
  const wsUrl = await getCDPTarget();
  const session = createCDPSession(wsUrl);
  await session.waitReady();

  // Enable necessary CDP domains
  await session.send('Page.enable');
  await session.send('Runtime.enable');
  await session.send('Network.enable');

  // Set Auth Cookie
  const domain = new URL(BASE_URL).hostname;
  await session.send('Network.setCookie', {
    name: 'astryx_k',
    value: AUTH_COOKIE,
    domain: domain === 'localhost' || domain === '127.0.0.1' ? '' : domain,
    path: '/',
  });

  const results = {
    baseUrl: BASE_URL,
    timestamp: new Date().toISOString(),
    navCount: 0,
    navHrefs: [],
    fullscreenDiff: false,
    hasFullscreenAttr: false,
    horizontalScrollOn390px: {},
    gateRedirectOk: false,
    finalGateUrl: '',
    pageErrors: [],
    screenshots: {},
    status: 'PASS',
  };

  // 1. Probe /ops (Default Desktop Viewport: inline mode)
  await session.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await session.send('Page.navigate', { url: `${BASE_URL}/ops` });
  await sleep(2500);

  const hash30 = await captureShot(session, path.join(OUT_DIR, '30-ops-inline.png'));
  results.screenshots['30-ops-inline.png'] = hash30;

  const opsInfo = await session.send('Runtime.evaluate', {
    expression: `(() => {
      const links = Array.from(document.querySelectorAll('a[href]'));
      const navLinks = links
        .map(a => a.getAttribute('href'))
        .filter(href => href && (href.startsWith('/') || href.startsWith(window.location.origin)))
        .map(h => h.replace(window.location.origin, ''))
        .filter(h => ['/ops', '/traces', '/rules', '/report', '/analytics', '/settings'].includes(h));
      
      const uniqueNav = Array.from(new Set(navLinks));
      const hasFullscreen = Boolean(document.querySelector('[data-viewport-mode="fullscreen"]'));
      return {
        uniqueNav,
        hasFullscreen,
        innerTextLength: document.body.innerText.length
      };
    })()`,
    returnByValue: true,
  });

  const opsData = opsInfo.result?.value || {};
  results.navCount = opsData.uniqueNav ? opsData.uniqueNav.length : 0;
  results.navHrefs = opsData.uniqueNav || [];

  // 2. Probe Focus mode /ops?view=focus
  await session.send('Page.navigate', { url: `${BASE_URL}/ops?view=focus` });
  await sleep(2000);
  const hash31 = await captureShot(session, path.join(OUT_DIR, '31-ops-focus.png'));
  results.screenshots['31-ops-focus.png'] = hash31;

  // 3. Probe Fullscreen mode /ops?view=fullscreen
  await session.send('Page.navigate', { url: `${BASE_URL}/ops?view=fullscreen` });
  await sleep(2000);
  const hash32 = await captureShot(session, path.join(OUT_DIR, '32-ops-fullscreen.png'));
  results.screenshots['32-ops-fullscreen.png'] = hash32;

  const fsInfo = await session.send('Runtime.evaluate', {
    expression: `(() => {
      const hasFsAttr = Boolean(document.querySelector('[data-viewport-mode="fullscreen"]'));
      const fixedEl = Boolean(document.querySelector('.fixed-fullscreen'));
      return {
        hasFsAttr: hasFsAttr || fixedEl,
        innerTextLength: document.body.innerText.length
      };
    })()`,
    returnByValue: true,
  });

  const fsData = fsInfo.result?.value || {};
  results.hasFullscreenAttr = fsData.hasFsAttr;
  results.fullscreenDiff = fsData.hasFsAttr || (fsData.innerTextLength !== opsData.innerTextLength);

  // 4. Probe 390px Mobile Viewport Overflow on all routes
  await session.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });

  await session.send('Page.navigate', { url: `${BASE_URL}/ops` });
  await sleep(1500);
  const hash33 = await captureShot(session, path.join(OUT_DIR, '33-ops-390.png'));
  results.screenshots['33-ops-390.png'] = hash33;

  const routesToTest = ['/ops', '/traces', '/rules', '/report', '/settings'];
  for (const route of routesToTest) {
    await session.send('Page.navigate', { url: `${BASE_URL}${route}` });
    await sleep(1500);
    const overflowRes = await session.send('Runtime.evaluate', {
      expression: `(() => {
        const root = document.documentElement;
        const body = document.body;
        const diff = Math.max(root.scrollWidth - root.clientWidth, body.scrollWidth - body.clientWidth);
        return { overflowDiff: diff, scrollWidth: root.scrollWidth, clientWidth: root.clientWidth };
      })()`,
      returnByValue: true,
    });
    const ov = overflowRes.result?.value || { overflowDiff: 0 };
    results.horizontalScrollOn390px[route] = {
      scrollWidth: ov.scrollWidth,
      clientWidth: ov.clientWidth,
      overflow: ov.overflowDiff,
      pass: ov.overflowDiff <= 1, // allow <=1px rounding
    };
  }

  // 5. Probe /gate Redirect to /settings?tab=hosts
  await session.send('Page.navigate', { url: `${BASE_URL}/gate` });
  await sleep(2000);
  const gateRes = await session.send('Runtime.evaluate', {
    expression: `window.location.pathname + window.location.search`,
    returnByValue: true,
  });
  const finalGateUrl = gateRes.result?.value || '';
  results.gateRedirectOk = finalGateUrl.includes('/settings') && finalGateUrl.includes('tab=hosts');
  results.finalGateUrl = finalGateUrl;

  // Restore Desktop Viewport
  await session.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // Check distinct hashes
  const uniqueHashes = new Set([hash30, hash31, hash32, hash33]);
  const hashesDistinct = uniqueHashes.size === 4;

  // Write checksums file
  const checksumContent = [
    `${hash30}  30-ops-inline.png`,
    `${hash31}  31-ops-focus.png`,
    `${hash32}  32-ops-fullscreen.png`,
    `${hash33}  33-ops-390.png`,
  ].join('\n') + '\n';
  fs.writeFileSync(path.join(OUT_DIR, '40-checksums.txt'), checksumContent);

  results.pageErrors = session.pageErrors;
  if (
    results.navCount !== 5 ||
    !results.fullscreenDiff ||
    !results.gateRedirectOk ||
    !hashesDistinct ||
    results.pageErrors.length > 0 ||
    Object.values(results.horizontalScrollOn390px).some(r => !r.pass)
  ) {
    results.status = 'FAIL';
  }

  session.ws.close();
  console.log(JSON.stringify(results, null, 2));
  if (results.status === 'FAIL') {
    process.exit(1);
  }
}

runProbe().catch((err) => {
  console.error('DOM Probe exception:', err);
  console.error(JSON.stringify({ error: err.message || String(err), stack: err.stack, status: 'FAIL' }, null, 2));
  process.exit(1);
});
