import { test, expect } from '@playwright/test';
import { installGeminiApiMocks } from './utils/geminiMocks';
import {
  setupApiKey,
  quickstartWithParty,
  clearGameState,
  isStoryVisible,
  getStoryText,
} from './utils/testHelpers';

test.describe('4. Game Loop Core Actions', () => {
  test.beforeEach(async ({ page }) => {
    await clearGameState(page);
    await installGeminiApiMocks(page);
    await setupApiKey(page);
  });

  test('4.1 Character action execution (C)', async ({ page }) => {
    // Create party and start tale
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    // Get initial story content
    const initialStory = await getStoryText(page);
    
    // Execute a custom action
    const actionInput = page.locator('input[placeholder*="What do you want to do?" i], textarea[placeholder*="action" i]').first();
    await expect(actionInput).toBeVisible({ timeout: 5000 });
    await actionInput.fill('I look around cautiously');
    
    const submitButton = page.getByRole('button', { name: /submit|send/i }).first();
    await submitButton.click();
    
    // Wait for story streaming to complete
    await page.waitForTimeout(4000);
    
    // Verify story content updated (new narration appeared)
    const newStory = await getStoryText(page);
    expect(newStory.length).toBeGreaterThan(initialStory.length);
    
    // Verify story is still visible
    const storyVisible = await isStoryVisible(page);
    expect(storyVisible).toBeTruthy();
  });

  test('4.2 Continue the Tale static action (H)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    // Get initial story content
    const initialStory = await getStoryText(page);
    
    // Find and click "Continue The Tale" button (note: capital T)
    const continueButton = page.getByRole('button', { name: /continue.*the.*tale/i });
    await expect(continueButton).toBeVisible({ timeout: 5000 });
    await continueButton.click();
    await page.waitForTimeout(5000);
    
    // Verify story content changed (new narration appeared)
    const newStory = await getStoryText(page);
    expect(newStory).not.toEqual(initialStory);
  });

  test('4.3 State command (M)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    const initialStory = await getStoryText(page);
    // Capture initial HP current value (format: current/max)
    const hpBeforeText = await page.getByTestId('resource-HP-value').innerText();
    const hpBefore = parseInt(hpBeforeText.split('/')[0], 10);
    
    // Find the action receiver select dropdown and select "State Command"
    const receiverSelect = page.locator('select.select-bordered');
    await expect(receiverSelect).toBeVisible({ timeout: 5000 });
    await receiverSelect.selectOption('State Command');
    await page.waitForTimeout(500);
    
    // Enter state command action
    const actionInput = page.locator('input[placeholder*="Updates character state only, not story" i]').first();
    await expect(actionInput).toBeVisible({ timeout: 5000 });
    await actionInput.fill('I gain 50 HP');
    
    const submitButton = page.getByRole('button', { name: /submit|send/i }).first();
    await submitButton.click();
    await page.waitForTimeout(2000);
    
    // Verify we're still on game page (state command processed)
    await expect(page).toHaveURL(/.*\/game$/);

    // HP should have increased (capped at max). New value must be >= old and usually greater.
    const hpAfterText = await page.getByTestId('resource-HP-value').innerText();
    const hpAfter = parseInt(hpAfterText.split('/')[0], 10);
    expect(hpAfter).not.toBe(hpBefore); // ensure visible change
  });
});
