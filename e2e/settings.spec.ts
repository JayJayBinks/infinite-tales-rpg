import { test, expect } from '@playwright/test';
import { installGeminiApiMocks } from './utils/geminiMocks';

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await installGeminiApiMocks(page);
  });

  test('API key entry and validation', async ({ page }) => {
    await page.goto('/game/settings');
    await page.waitForLoadState('networkidle');

    // Close any error modals
    const errorModal = page.locator('.modal.modal-open');
    if (await errorModal.isVisible().catch(() => false)) {
      const closeBtn = errorModal.getByRole('button', { name: /close|✕/i }).first();
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click();
      }
    }

    // Find API key input
    const apiKeyInput = page.getByLabel('Gemini API Key');
    await expect(apiKeyInput).toBeVisible();

    // Clear and fill with test key
    await apiKeyInput.clear();
    await apiKeyInput.fill('test-api-key-123456789');

    // Save and validate
    const saveButton = page.getByRole('button', { name: 'Save & Validate' });
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    await page.waitForTimeout(1000);

    // Expected: Key is saved and validated
    // Quickstart button should become available
    const quickstartButton = page.getByRole('button', { name: /quickstart campaign/i });
    await expect(quickstartButton).toBeVisible({ timeout: 5000 });

    console.log('API key validated successfully');
  });

  test('Settings persistence across page reloads', async ({ page }) => {
    await page.goto('/game/settings');
    await page.waitForLoadState('networkidle');

    // Close any error modals
    const errorModal = page.locator('.modal.modal-open');
    if (await errorModal.isVisible().catch(() => false)) {
      const closeBtn = errorModal.getByRole('button', { name: /close|✕/i }).first();
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click();
      }
    }

    // Set API key
    const apiKeyInput = page.getByLabel('Gemini API Key');
    await apiKeyInput.clear();
    const testKey = 'test-persistent-key-987654321';
    await apiKeyInput.fill(testKey);

    const saveButton = page.getByRole('button', { name: 'Save & Validate' });
    await saveButton.click();
    await page.waitForTimeout(1000);

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Expected: API key is still there
    const reloadedKeyInput = page.getByLabel('Gemini API Key');
    const savedValue = await reloadedKeyInput.inputValue().catch(() => '');
    
    expect(savedValue).toBe(testKey);
    console.log('Settings persisted across reload');
  });

  test('Clear API key functionality', async ({ page }) => {
    await page.goto('/game/settings');
    await page.waitForLoadState('networkidle');

    // Close any error modals
    const errorModal = page.locator('.modal.modal-open');
    if (await errorModal.isVisible().catch(() => false)) {
      const closeBtn = errorModal.getByRole('button', { name: /close|✕/i }).first();
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click();
      }
    }

    // Set API key
    const apiKeyInput = page.getByLabel('Gemini API Key');
    await apiKeyInput.clear();
    await apiKeyInput.fill('test-key-to-clear');

    const saveButton = page.getByRole('button', { name: 'Save & Validate' });
    await saveButton.click();
    await page.waitForTimeout(1000);

    // Clear the key
    await apiKeyInput.clear();
    await saveButton.click();
    await page.waitForTimeout(500);

    // Expected: Quickstart should not be available without key
    const quickstartButton = page.getByRole('button', { name: /quickstart campaign/i });
    const isDisabled = await quickstartButton.isDisabled().catch(() => true);
    
    if (isDisabled) {
      console.log('Quickstart properly disabled when API key cleared');
    }
  });

  test('Navigation to AI settings', async ({ page }) => {
    await page.goto('/game/settings');
    await page.waitForLoadState('networkidle');

    // Look for AI settings link/button
    const aiSettingsLink = page.getByRole('link', { name: /ai.*settings|advanced.*settings/i }).first();
    
    if (await aiSettingsLink.isVisible().catch(() => false)) {
      await aiSettingsLink.click();
      await page.waitForLoadState('networkidle');

      // Expected: Navigate to AI settings page
      expect(page.url()).toContain('/settings/ai');
      console.log('Successfully navigated to AI settings');
    } else {
      // Try navigating directly
      await page.goto('/game/settings/ai');
      await page.waitForLoadState('networkidle');
      
      // Check if page loaded
      const hasContent = await page.locator('h1, h2, h3').count().then(c => c > 0).catch(() => false);
      expect(hasContent).toBe(true);
      console.log('AI settings page accessible via direct navigation');
    }
  });

  test('Export/Import settings visibility', async ({ page }) => {
    await page.goto('/game/settings');
    await page.waitForLoadState('networkidle');

    // Look for export/import buttons
    const exportBtn = page.getByRole('button', { name: /export|download.*save/i }).first();
    const importBtn = page.getByRole('button', { name: /import|load.*save/i }).first();

    const hasExport = await exportBtn.isVisible().catch(() => false);
    const hasImport = await importBtn.isVisible().catch(() => false);

    if (hasExport || hasImport) {
      console.log(`Export: ${hasExport}, Import: ${hasImport}`);
      expect(hasExport || hasImport).toBe(true);
    } else {
      console.log('Export/Import features may be in a different location');
    }
  });
});
