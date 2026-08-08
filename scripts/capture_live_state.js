const { chromium } = require('playwright-core');

(async () => {
  console.log('[Capture] Connecting to Chrome CDP 192.168.3.184:9226...');
  const browser = await chromium.connectOverCDP('http://192.168.3.184:9226');
  const context = browser.contexts()[0] || await browser.newContext();
  const pages = context.pages();
  
  console.log('[Capture] Total open tabs:', pages.length);
  const activePage = pages[pages.length - 1] || context.newPage();
  
  console.log('[Capture] Current page URL:', activePage.url());
  console.log('[Capture] Current page Title:', await activePage.title());
  
  await activePage.screenshot({ path: '/home/vokov/latest_survey_step.png' });
  console.log('[Capture] Captured fresh screenshot to /home/vokov/latest_survey_step.png');
  
  await browser.close();
})().catch(err => console.error('[Capture] Error:', err));
