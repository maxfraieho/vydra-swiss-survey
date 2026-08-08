const { chromium } = require('playwright-core');

(async () => {
  console.log('[LogoLogin] Connecting to Chrome CDP 192.168.3.184:9226...');
  const browser = await chromium.connectOverCDP('http://192.168.3.184:9226');
  const context = browser.contexts()[0] || await browser.newContext();
  const page = context.pages()[0] || await context.newPage();

  console.log('[LogoLogin] Current page URL:', page.url());

  // 1. Click Logo to open top-right header login form
  console.log('[LogoLogin] Clicking logo to access header login form...');
  try {
    const logo = await page.$('.navbar-brand, .logo, a[class*="logo"], img[alt*="logo"], header a[href="/"]');
    if (logo) {
      await logo.click({ force: true });
      await page.waitForTimeout(2000);
    }
  } catch (e) {
    console.log('[LogoLogin] Logo click note:', e.message);
  }

  // 2. Accept cookies if modal visible
  try {
    const cookieBtn = await page.$('#cookiesModal button, button:has-text("Accepter"), button:has-text("Tout accepter"), .btn-accept');
    if (cookieBtn) {
      await cookieBtn.click({ force: true });
      await page.waitForTimeout(1000);
    }
  } catch (e) {}

  // 3. Fill top-right login form (lekov00@gmail.com / Iris0523)
  console.log('[LogoLogin] Filling top-right login credentials...');
  try {
    const emailInput = await page.$('header input[type="email"], header input[name*="user"], input[name="_username"], input[type="email"]');
    if (emailInput) {
      await emailInput.fill('lekov00@gmail.com');
    }

    const passInput = await page.$('header input[type="password"], header input[name*="pass"], input[name="_password"], input[type="password"]');
    if (passInput) {
      await passInput.fill('Iris0523');
    }

    await page.screenshot({ path: '/home/vokov/latest_survey_step.png' });
    console.log('[LogoLogin] Filled credentials in header login form.');

    // 4. Submit header login form
    const submitBtn = await page.$('header button[type="submit"], header input[type="submit"], button:has-text("Se connecter"), button:has-text("Anmelden")');
    if (submitBtn) {
      console.log('[LogoLogin] Submitting header login form...');
      await submitBtn.click({ force: true });
      await page.waitForTimeout(4000);
    }
  } catch (err) {
    console.log('[LogoLogin] Form fill error:', err.message);
  }

  await page.screenshot({ path: '/home/vokov/latest_survey_step.png' });
  console.log('[LogoLogin] Completed. Final URL:', page.url());

  await browser.close();
})().catch(err => console.error('[LogoLogin] Error:', err));
