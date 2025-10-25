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
    
    // Find and click "Continue the Tale" button
    const continueButton = page.getByRole('button', { name: /continue.*tale/i });
    await expect(continueButton).toBeVisible({ timeout: 5000 });
    await continueButton.click();
    await page.waitForTimeout(4000);
    
    // Verify story content changed (new narration appeared)
    const newStory = await getStoryText(page);
    expect(newStory.length).toBeGreaterThan(initialStory.length);
    
    // Verify button is re-enabled after completion
    await expect(continueButton).toBeEnabled({ timeout: 5000 });
  });

  test('4.5 Undo/redo multi-member (H)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    // Get initial story content
    const initialStory = await getStoryText(page);
    
    // Execute action for first member
    const actionInput = page.locator('input[placeholder*="What do you want to do?" i], textarea[placeholder*="action" i]').first();
    await expect(actionInput).toBeVisible({ timeout: 5000 });
    await actionInput.fill('Action for member 1');
    const submitButton = page.getByRole('button', { name: /submit|send/i }).first();
    await submitButton.click();
    await page.waitForTimeout(3000);
    
    const storyAfterFirst = await getStoryText(page);
    expect(storyAfterFirst.length).toBeGreaterThan(initialStory.length);
    
    // Switch to second party member if available
    const partyButtons = page.locator('.party-switcher button');
    const buttonCount = await partyButtons.count();
    if (buttonCount > 1) {
      await partyButtons.nth(1).click();
      await page.waitForTimeout(1000);
      
      // Execute action for second member
      await actionInput.fill('Action for member 2');
      await submitButton.click();
      await page.waitForTimeout(3000);
      
      const storyAfterSecond = await getStoryText(page);
      expect(storyAfterSecond.length).toBeGreaterThan(storyAfterFirst.length);
      
      // Test undo
      const undoButton = page.getByRole('button', { name: /undo/i });
      await expect(undoButton).toBeVisible({ timeout: 5000 });
      
      // Undo second action
      await undoButton.click();
      await page.waitForTimeout(1000);
      
      // Story should be shorter after undo
      const storyAfterUndo1 = await getStoryText(page);
      expect(storyAfterUndo1.length).toBeLessThan(storyAfterSecond.length);
      
      // Undo first action
      await undoButton.click();
      await page.waitForTimeout(1000);
      
      const storyAfterUndo2 = await getStoryText(page);
      expect(storyAfterUndo2.length).toBeLessThan(storyAfterUndo1.length);
      
      // Test redo
      const redoButton = page.getByRole('button', { name: /redo/i });
      await expect(redoButton).toBeVisible({ timeout: 2000 });
      
      // Redo first action
      await redoButton.click();
      await page.waitForTimeout(1000);
      
      const storyAfterRedo1 = await getStoryText(page);
      expect(storyAfterRedo1.length).toBeGreaterThan(storyAfterUndo2.length);
      
      // Redo second action
      await redoButton.click();
      await page.waitForTimeout(1000);
      
      const storyAfterRedo2 = await getStoryText(page);
      expect(storyAfterRedo2.length).toBeGreaterThan(storyAfterRedo1.length);
    }
  });

  test('4.3 State command (M)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    const initialStory = await getStoryText(page);
    
    // Find state command input or button
    const stateCommandButton = page.getByRole('button', { name: /state.*command|json/i });
    await expect(stateCommandButton).toBeVisible({ timeout: 5000 });
    await stateCommandButton.click();
    await page.waitForTimeout(500);
    
    // Enter JSON state update
    const jsonInput = page.locator('textarea').last();
    const jsonUpdate = JSON.stringify({
      resource_updates: { HP: 5 }
    });
    await jsonInput.fill(jsonUpdate);
    
    const submitButton = page.getByRole('button', { name: /submit|apply/i }).first();
    await submitButton.click();
    await page.waitForTimeout(1000);
    
    // Verify story didn't change (state-only update)
    const storyAfter = await getStoryText(page);
    // State updates shouldn't add visible story text
    expect(Math.abs(storyAfter.length - initialStory.length)).toBeLessThan(100);
  });
});
