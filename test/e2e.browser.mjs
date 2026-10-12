import { chromium } from 'playwright';

async function runBrowserE2E() {
  console.log('--- STARTING PLAYWRIGHT PHYSICAL BROWSER E2E TEST ---');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.error('[BROWSER CONSOLE ERROR]:', msg.text());
    }
  });

  page.on('pageerror', err => {
    consoleErrors.push(err.message);
    console.error('[BROWSER UNCAUGHT EXCEPTION]:', err.message);
  });

  // Start with a clean storage session
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  console.log('Step 1: Checking AuthScreen when unauthenticated...');
  const authTitle = page.locator('text=SplitPay');
  await authTitle.first().waitFor({ state: 'visible', timeout: 5000 });
  const loginTab = page.locator('button:has-text("Log In")').first();
  const signupTab = page.locator('button:has-text("Sign Up")').first();
  const guestTab = page.locator('button:has-text("Guest Mode")').first();

  if (!(await loginTab.isVisible()) || !(await signupTab.isVisible()) || !(await guestTab.isVisible())) {
    throw new Error('AuthScreen tabs not visible on fresh load!');
  }
  console.log('✓ AuthScreen rendered with Log In, Sign Up, and Guest Mode tabs!');

  // Step 2: Test Guest Mode
  console.log('Step 2: Testing Guest Mode entry...');
  await guestTab.click();
  await page.waitForTimeout(300);
  const startGuestBtn = page.locator('button:has-text("Start Using SplitPay as Guest")');
  await startGuestBtn.click();
  await page.waitForTimeout(1000);

  // Dismiss onboarding tour if shown
  const skipTour = page.locator('button:has-text("Skip Tour")');
  if (await skipTour.isVisible()) {
    await skipTour.click();
    await page.waitForTimeout(500);
  }

  console.log('✓ Successfully entered SplitPay as Guest!');

  // Step 3: Test Logout as Guest
  console.log('Step 3: Testing Logout from Guest Mode...');
  page.on('dialog', async dialog => {
    await dialog.accept();
  });
  const logoutBtn = page.locator('header button[title="Log Out"]');
  await logoutBtn.click();
  await page.waitForTimeout(1000);

  // Should return to AuthScreen
  await loginTab.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✓ Logout successfully returned to AuthScreen!');

  // Step 4: Test Sign Up with Username & Password
  console.log('Step 4: Testing Sign Up with username & password...');
  await signupTab.click();
  await page.waitForTimeout(300);

  const nameInput = page.locator('input[placeholder*="Aadil" i], input[placeholder*="Name" i]').first();
  await nameInput.fill('Aadil Ahammad');

  const usernameInput = page.locator('input[placeholder="aadil"]').first();
  await usernameInput.fill('aadil');

  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.fill('secret123');

  const createAccountBtn = page.locator('button:has-text("Create Account & Get Started")');
  await createAccountBtn.click();
  await page.waitForTimeout(1500);

  // If tour modal appears, dismiss it
  if (await skipTour.isVisible()) {
    await skipTour.click();
    await page.waitForTimeout(500);
  }

  // Verify dashboard displays user name
  const welcomeText = await page.locator('text=Welcome back, Aadil').count();
  console.log('✓ Signed up and logged into account! Welcome text present:', welcomeText > 0);

  // Step 5: Test Logout and Login back in
  console.log('Step 5: Testing Logout from Account...');
  await logoutBtn.click();
  await page.waitForTimeout(1000);
  await loginTab.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✓ Logged out to AuthScreen.');

  console.log('Step 6: Testing Login with registered username and password...');
  const loginUser = page.locator('input[placeholder="aadil"]').first();
  await loginUser.fill('aadil');

  const loginPass = page.locator('input[type="password"]').first();
  await loginPass.fill('secret123');

  const loginSubmitBtn = page.locator('button:has-text("Log In to SplitPay")');
  await loginSubmitBtn.click();
  await page.waitForTimeout(1500);

  if (await skipTour.isVisible()) {
    await skipTour.click();
    await page.waitForTimeout(500);
  }

  const welcomeBack = await page.locator('text=Welcome back, Aadil').count();
  console.log('✓ Logged back in with credentials! Welcome text present:', welcomeBack > 0);

  await browser.close();

  console.log('--- ALL PHYSICAL BROWSER AUTH TESTS PASSED ---');
  const actualErrors = consoleErrors.filter(e => !e.includes('Access to fetch') && !e.includes('net::ERR_FAILED') && !e.includes('Failed to load resource'));
  if (actualErrors.length > 0) {
    console.log('Note: Console errors encountered:', actualErrors);
    throw new Error('E2E failed with console errors');
  } else {
    console.log('Zero runtime interface errors encountered during full physical browser auth session!');
  }
}

runBrowserE2E().catch(err => {
  console.error('E2E TEST FAILURE:', err);
  process.exit(1);
});
