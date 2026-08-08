const { chromium } = require('playwright-core');

(async () => {
  console.log('[Runner] Connecting to Chrome CDP on 192.168.3.184:9226...');
  const browser = await chromium.connectOverCDP('http://192.168.3.184:9226');
  const context = browser.contexts()[0] || await browser.newContext();
  const page = context.pages()[0] || await context.newPage();
  
  console.log('[Runner] Navigating to https://espacedopinion.ch/login...');
  try {
    await page.goto('https://espacedopinion.ch/login', { waitUntil: 'commit', timeout: 15000 });
  } catch (e) {}
  
  await page.waitForTimeout(2000);
  
  // Accept cookie modal if present
  try {
    const acceptCookiesBtn = await page.$('#cookiesModal button, button:has-text("Accepter"), button:has-text("Tout accepter"), .btn-accept, #accept-cookies');
    if (acceptCookiesBtn) {
      console.log('[Runner] Dismissing Cookies modal...');
      await acceptCookiesBtn.click({ force: true });
      await page.waitForTimeout(1000);
    }
  } catch (e) {}
  
  // Fill credentials for Olena (lekov00@gmail.com / Iris0523)
  console.log('[Runner] Filling credentials for Olena...');
  try {
    const emailInput = await page.$('input[type="email"], input[name="email"], input[name="_username"], #username, #email');
    if (emailInput) {
      await emailInput.fill('lekov00@gmail.com');
    }
    
    const passInput = await page.$('input[type="password"], input[name="password"], input[name="_password"], #password');
    if (passInput) {
      await passInput.fill('Iris0523');
    }
    
    await page.screenshot({ path: '/home/vokov/latest_survey_step.png' });
    console.log('[Runner] Filled email and password.');
    
    const submitBtn = await page.$('button[type="submit"], input[type="submit"], .btn-primary, button:has-text("Se connecter"), button:has-text("Anmelden")');
    if (submitBtn) {
      console.log('[Runner] Submitting login form...');
      await submitBtn.click({ force: true });
    }
  } catch (err) {
    console.log('[Runner] Form fill error:', err.message);
  }
  
  await page.waitForTimeout(4000);
  await page.screenshot({ path: '/home/vokov/latest_survey_step.png' });
  console.log('[Runner] Captured logged in page screenshot. Current URL:', page.url());
  
  await browser.close();
})().catch(err => console.error('[Runner] Error:', err));
