#!/usr/bin/env node
/**
 * bin/dom_probe.mjs
 * Connects via CDP to inspect the live Astryx survey console.
 */
import http from 'http';
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

async function getCDPTarget() {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${CDP_PORT}/json/list`, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          const list = JSON.parse(data);
          const page = list.find(t => t.type === 'page');
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
        pageErrors.push(msg.params.exceptionDetails?.text || 'Unknown JS Exception');
      }
    } catch (e) {
      // ignore parse err
    }
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

async function runProbe() {
  const wsUrl = await getCDPTarget();
  const session = createCDPSession(wsUrl);
  await session.waitReady();

  // Enable necessary CDP domains
  await session.send('Page.enable');
  await session.send('Runtime.enable');
  await session.send('Network.enable');

  // Set Auth Cookie
  await session.send('Network.setCookie', {
    name: 'astryx_k',
    value: AUTH_COOKIE,
    domain: 'survey.exodus.pp.ua',
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
    pageErrors: [],
    status: 'PASS',
  };

  // 1. Probe /ops (Default Desktop Viewport)
  await session.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await session.send('Page.navigate', { url: `${BASE_URL}/ops` });
  await sleep(2500);

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

  const opsData = opsInfo.result.value || {};
  results.navCount = opsData.uniqueNav ? opsData.uniqueNav.length : 0;
  results.navHrefs = opsData.uniqueNav || [];

  // 2. Probe /ops?view=fullscreen
  await session.send('Page.navigate', { url: `${BASE_URL}/ops?view=fullscreen` });
  await sleep(2000);

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

  const fsData = fsInfo.result.value || {};
  results.hasFullscreenAttr = fsData.hasFsAttr;
  results.fullscreenDiff = fsData.hasFsAttr || (fsData.innerTextLength !== opsData.innerTextLength);

  // 3. Probe 390px Mobile Viewport Overflow on all routes
  await session.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });

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
    const ov = overflowRes.result.value || { overflowDiff: 0 };
    results.horizontalScrollOn390px[route] = {
      scrollWidth: ov.scrollWidth,
      clientWidth: ov.clientWidth,
      overflow: ov.overflowDiff,
      pass: ov.overflowDiff === 0,
    };
  }

  // 4. Probe /gate Redirect to /settings?tab=hosts
  await session.send('Page.navigate', { url: `${BASE_URL}/gate` });
  await sleep(2000);
  const gateRes = await session.send('Runtime.evaluate', {
    expression: `window.location.pathname + window.location.search`,
    returnByValue: true,
  });
  const finalGateUrl = gateRes.result.value || '';
  results.gateRedirectOk = finalGateUrl.includes('/settings') && finalGateUrl.includes('tab=hosts');
  results.finalGateUrl = finalGateUrl;

  // Restore Desktop Viewport
  await session.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });

  results.pageErrors = session.pageErrors;
  if (
    results.navCount !== 5 ||
    !results.fullscreenDiff ||
    !results.gateRedirectOk ||
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
