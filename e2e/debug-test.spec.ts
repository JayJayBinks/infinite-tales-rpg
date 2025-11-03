import { test, expect } from '@playwright/test';

test.skip('debug story visibility', async ({ page, context }) => {
  // Listen for console messages
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('pageerror', err => console.log('ERROR:', err.message));
  
  await page.goto('/');
  await page.waitForTimeout(500);
  
  // Click quickstart
  const quickstartButton = page.getByRole('button', { name: /quickstart/i });
  await quickstartButton.click();
  await page.waitForTimeout(500);
  
  // Click start
  const startButton = page.getByRole('button', { name: /^start$/i });
  await startButton.click();
  
  // Wait for navigation
  await page.waitForURL('**/game', { timeout: 30000 });
  await page.waitForTimeout(3000);
  
  // Take screenshot
  await page.screenshot({ path: '/tmp/game-page.png', fullPage: true });
  
  // Check for main tag
  const mainTag = page.locator('main');
  const isVisible = await mainTag.isVisible({ timeout: 5000 }).catch(() => false);
  console.log('Main tag visible:', isVisible);
  
  // Get page content
  const htmlContent = await page.content();
  console.log('Page has <main>:', htmlContent.includes('<main'));
  
  // Count divs
  const divCount = await page.locator('div').count();
  console.log('Div count:', divCount);
  
  expect(isVisible).toBeTruthy();
});
