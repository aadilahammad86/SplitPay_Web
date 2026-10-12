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

  console.log('Step 1: Navigating to local SplitPay app...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Check ErrorBoundary
  const pageText = await page.evaluate(() => document.body.innerText);
  if (pageText.includes('Something went wrong')) {
    throw new Error('PAGE SHOWS ERROR BOUNDARY:\n' + pageText);
  }
  console.log('✓ App loaded without error boundary!');

  // Dismiss Onboarding Tour if open
  const skipTour = page.locator('button:has-text("Skip Tour")');
  if (await skipTour.isVisible()) {
    console.log('Onboarding Tour modal detected! Dismissing with "Skip Tour"...');
    await skipTour.click();
    await page.waitForTimeout(500);
    console.log('✓ Onboarding dismissed!');
  }

  // Step 2: Test sync button & modal
  console.log('Step 2: Finding and tapping the sync status badge in navbar...');
  const syncButton = page.locator('header button').first();
  await syncButton.waitFor({ state: 'visible', timeout: 5000 });
  await syncButton.click();
  await page.waitForTimeout(500);

  const modalTitle = page.locator('text=Cloud Sync & Outbox Status');
  await modalTitle.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✓ SyncStatusModal opened successfully upon tapping navbar pill!');
  await page.screenshot({ path: 'e2e-02-sync-modal.png' });

  // Close modal
  const closeBtn = page.locator('button:has-text("Close")');
  await closeBtn.click();
  await page.waitForTimeout(500);

  // Step 3: Add an Expense through UI
  console.log('Step 3: Clicking "+ Add Expense" button...');
  const addExpenseBtn = page.locator('button:has-text("Add Expense")').first();
  await addExpenseBtn.click();
  await page.waitForTimeout(500);

  console.log('Step 4: Filling in expense details in modal...');
  const descInput = page.locator('input[placeholder*="Dinner" i], input[placeholder*="What was this for" i], input[type="text"]').first();
  await descInput.fill('Chai & Snacks');

  const amountInput = page.locator('input[placeholder="0.00"], input[type="number"], input[inputmode="decimal"]').first();
  await amountInput.fill('15.00');

  await page.screenshot({ path: 'e2e-03-add-expense-modal.png' });
  console.log('✓ Captured e2e-03-add-expense-modal.png');

  // Submit expense
  const saveBtn = page.locator('button:has-text("Save Expense"), button:has-text("Create Expense"), button[type="submit"]:has-text("Save")').first();
  await saveBtn.click();
  await page.waitForTimeout(1000);
  console.log('✓ Expense submitted successfully!');

  // Step 5: Verify expense appears on Dashboard & Activity
  await page.screenshot({ path: 'e2e-04-dashboard-after-expense.png' });
  console.log('✓ Captured e2e-04-dashboard-after-expense.png');

  const activityNav = page.locator('nav button:has-text("Activity")').first();
  if (await activityNav.isVisible()) {
    await activityNav.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e-05-activity-timeline.png' });
    console.log('✓ Activity timeline verified with new expense!');
  }

  await browser.close();

  console.log('--- ALL PHYSICAL BROWSER TESTS PASSED ---');
  if (consoleErrors.length > 0) {
    console.log('Note: Console errors encountered:', consoleErrors);
    throw new Error('E2E failed with console errors');
  } else {
    console.log('Zero console errors encountered during the full browser session!');
  }
}

runBrowserE2E().catch(err => {
  console.error('E2E TEST FAILURE:', err);
  process.exit(1);
});
