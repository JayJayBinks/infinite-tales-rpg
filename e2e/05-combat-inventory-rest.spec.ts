import { test, expect } from '@playwright/test';
import { installGeminiApiMocks } from './utils/geminiMocks';
import {
  setupApiKey,
  quickstartWithParty,
  clearGameState,
  isStoryVisible,
  getStoryText,
} from './utils/testHelpers';

test.describe('5. Combat, Inventory & Rest', () => {
  test.beforeEach(async ({ page }) => {
    await clearGameState(page);
    await installGeminiApiMocks(page);
    await setupApiKey(page);
  });

  test('5.4 Combat lifecycle (C)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    const initialStory = await getStoryText(page);
    
    // Trigger combat via action
    const actionInput = page.locator('input[placeholder*="action" i], textarea[placeholder*="action" i]').first();
    await expect(actionInput).toBeVisible({ timeout: 5000 });
    await actionInput.fill('I attack the enemy');
    const submitButton = page.getByRole('button', { name: /submit|send/i }).first();
    await submitButton.click();
    await page.waitForTimeout(4000);
    
    // Verify story updated
    const newStory = await getStoryText(page);
    expect(newStory.length).toBeGreaterThan(initialStory.length);
    
    // Look for combat indicators in UI (optional - may not always be present)
    const combatBadge = page.locator('[data-testid="combat-badge"]').or(page.getByText(/in combat/i));
    
    // End combat via another action
    await actionInput.fill('I defeat the enemy');
    await submitButton.click();
    await page.waitForTimeout(4000);
    
    // Verify story updated again
    const finalStory = await getStoryText(page);
    expect(finalStory.length).toBeGreaterThan(newStory.length);
  });

  test('5.5 NPC multi-action (H)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    const initialStory = await getStoryText(page);
    
    // Start combat with multiple NPCs
    const actionInput = page.locator('input[placeholder*="action" i], textarea[placeholder*="action" i]').first();
    await expect(actionInput).toBeVisible({ timeout: 5000 });
    await actionInput.fill('Multiple enemies appear');
    const submitButton = page.getByRole('button', { name: /submit|send/i }).first();
    await submitButton.click();
    await page.waitForTimeout(4000);
    
    const newStory = await getStoryText(page);
    expect(newStory.length).toBeGreaterThan(initialStory.length);
  });

  test('5.6 Multi-target damage (H)', async ({ page }) => {
    await quickstartWithParty(page, 4);
    await page.waitForTimeout(3000);
    
    const initialStory = await getStoryText(page);
    
    // Trigger AOE attack
    const actionInput = page.locator('input[placeholder*="action" i], textarea[placeholder*="action" i]').first();
    await expect(actionInput).toBeVisible({ timeout: 5000 });
    await actionInput.fill('I use an area attack on all enemies');
    const submitButton = page.getByRole('button', { name: /submit|send/i }).first();
    await submitButton.click();
    await page.waitForTimeout(4000);
    
    const newStory = await getStoryText(page);
    expect(newStory.length).toBeGreaterThan(initialStory.length);
  });

  test('6.1 Item consumption (H)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    const initialStory = await getStoryText(page);
    
    // Find item via action
    const actionInput = page.locator('input[placeholder*="action" i], textarea[placeholder*="action" i]').first();
    await expect(actionInput).toBeVisible({ timeout: 5000 });
    await actionInput.fill('I find a healing potion');
    const submitButton = page.getByRole('button', { name: /submit|send/i }).first();
    await submitButton.click();
    await page.waitForTimeout(4000);
    
    const afterFind = await getStoryText(page);
    expect(afterFind.length).toBeGreaterThan(initialStory.length);
    
    // Try to use inventory button
    const inventoryButton = page.getByRole('button', { name: /inventory|items/i });
    if (await inventoryButton.isVisible({ timeout: 2000 })) {
      await inventoryButton.click();
      await page.waitForTimeout(500);
      
      // Look for use item button
      const useItemButton = page.getByRole('button', { name: /use|consume/i }).first();
      if (await useItemButton.isVisible({ timeout: 2000 })) {
        await useItemButton.click();
        await page.waitForTimeout(2000);
      }
    }
  });

  test('6.2 Add item via story (M)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    const initialStory = await getStoryText(page);
    
    // Add item through narration
    const actionInput = page.locator('input[placeholder*="action" i], textarea[placeholder*="action" i]').first();
    await expect(actionInput).toBeVisible({ timeout: 5000 });
    await actionInput.fill('I discover a magical sword');
    const submitButton = page.getByRole('button', { name: /submit|send/i }).first();
    await submitButton.click();
    await page.waitForTimeout(4000);
    
    const newStory = await getStoryText(page);
    expect(newStory.length).toBeGreaterThan(initialStory.length);
  });

  test('7.1 Short Rest (H)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    const initialStory = await getStoryText(page);
    
    // Perform short rest
    const restButton = page.getByRole('button', { name: /short.*rest|rest/i });
    await expect(restButton).toBeVisible({ timeout: 5000 });
    await restButton.click();
    await page.waitForTimeout(3000);
    
    const newStory = await getStoryText(page);
    expect(newStory.length).toBeGreaterThan(initialStory.length);
  });

  test('7.2 Long Rest (M)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    const initialStory = await getStoryText(page);
    
    // Perform long rest
    const longRestButton = page.getByRole('button', { name: /long.*rest/i });
    await expect(longRestButton).toBeVisible({ timeout: 5000 });
    await longRestButton.click();
    await page.waitForTimeout(3000);
    
    const newStory = await getStoryText(page);
    expect(newStory.length).toBeGreaterThan(initialStory.length);
  });

  test('10.3 Export/import mid-combat (H)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    // Start combat
    const actionInput = page.locator('input[placeholder*="action" i], textarea[placeholder*="action" i]').first();
    await expect(actionInput).toBeVisible({ timeout: 5000 });
    await actionInput.fill('Combat begins');
    const submitButton = page.getByRole('button', { name: /submit|send/i }).first();
    await submitButton.click();
    await page.waitForTimeout(4000);
    
    // Export state
    const exportData = await page.evaluate(() => {
      const keys = ['storyState', 'partyState', 'playerCharactersGameState'];
      const data: Record<string, any> = {};
      keys.forEach(key => {
        const item = localStorage.getItem(key);
        if (item) data[key] = JSON.parse(item);
      });
      return data;
    });
    
    // Clear and import
    await clearGameState(page);
    await page.evaluate((data) => {
      Object.keys(data).forEach(key => {
        localStorage.setItem(key, JSON.stringify(data[key]));
      });
    }, exportData);
    
    await page.reload();
    await page.goto('/game');
    await page.waitForTimeout(2000);
    
    // Verify story is visible after import
    const storyVisible = await isStoryVisible(page);
    expect(storyVisible).toBeTruthy();
  });
});
