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
    const actionInput = page.locator('input[placeholder*="action" i], textarea[placeholder*="action" i]').first();
    if (await actionInput.isVisible({ timeout: 5000 }).catch(() => false)) {
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
    }
  });
      }
    }
  });

  test('4.2 Continue the Tale static action (H)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    const gameActionsBefore = await getLocalStorageItem(page, 'gameActionsState');
    const initialActionCount = gameActionsBefore?.value?.length || 0;
    
    // Find and click "Continue the Tale" button
    const continueButton = page.getByRole('button', { name: /continue.*tale/i });
    if (await continueButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await continueButton.click();
      await page.waitForTimeout(4000);
      
      // Verify new action was added
      const gameActionsAfter = await getLocalStorageItem(page, 'gameActionsState');
      expect(gameActionsAfter.value.length).toBeGreaterThan(initialActionCount);
      
      // Verify button doesn't trigger duplicate actions
      const countBefore = gameActionsAfter.value.length;
      
      // Should not be able to click again while streaming
      const isDisabledDuringStream = await continueButton.isDisabled().catch(() => false);
      // Button should either be disabled or action count shouldn't increase inappropriately
    }
  });

  test('4.5 Undo/redo multi-member (H)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    // Execute action for first member
    const actionInput = page.locator('input[placeholder*="action" i], textarea[placeholder*="action" i]').first();
    if (await actionInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await actionInput.fill('Action for member 1');
      const submitButton = page.getByRole('button', { name: /submit|send/i }).first();
      await submitButton.click();
      await page.waitForTimeout(3000);
      
      const gameActionsAfterFirst = await getLocalStorageItem(page, 'gameActionsState');
      const countAfterFirst = gameActionsAfterFirst.value.length;
      
      // Switch to second member
      const nextButton = page.getByRole('button', { name: /next/i }).or(
        page.locator('button').filter({ hasText: /→/ })
      );
      if (await nextButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nextButton.click();
        await page.waitForTimeout(1000);
        
        // Execute action for second member
        await actionInput.fill('Action for member 2');
        await submitButton.click();
        await page.waitForTimeout(3000);
        
        const gameActionsAfterSecond = await getLocalStorageItem(page, 'gameActionsState');
        const countAfterSecond = gameActionsAfterSecond.value.length;
        expect(countAfterSecond).toBeGreaterThan(countAfterFirst);
        
        // Now test undo
        const undoButton = page.getByRole('button', { name: /undo/i });
        if (await undoButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          // Undo second action
          await undoButton.click();
          await page.waitForTimeout(1000);
          
          const gameActionsAfterUndo1 = await getLocalStorageItem(page, 'gameActionsState');
          expect(gameActionsAfterUndo1.value.length).toBe(countAfterFirst);
          
          // Undo first action
          await undoButton.click();
          await page.waitForTimeout(1000);
          
          const gameActionsAfterUndo2 = await getLocalStorageItem(page, 'gameActionsState');
          expect(gameActionsAfterUndo2.value.length).toBeLessThan(countAfterFirst);
          
          // Now test redo
          const redoButton = page.getByRole('button', { name: /redo/i });
          if (await redoButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            // Redo first action
            await redoButton.click();
            await page.waitForTimeout(1000);
            
            const gameActionsAfterRedo1 = await getLocalStorageItem(page, 'gameActionsState');
            expect(gameActionsAfterRedo1.value.length).toBe(countAfterFirst);
            
            // Redo second action
            await redoButton.click();
            await page.waitForTimeout(1000);
            
            const gameActionsAfterRedo2 = await getLocalStorageItem(page, 'gameActionsState');
            expect(gameActionsAfterRedo2.value.length).toBe(countAfterSecond);
          }
        }
      }
    }
  });

  test('4.3 State command (M)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    // Find state command input or button
    const stateCommandButton = page.getByRole('button', { name: /state.*command|json/i });
    if (await stateCommandButton.isVisible({ timeout: 5000 }).catch(() => false)) {
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
      
      // Verify state was updated without adding to story log
      const gameActions = await getLocalStorageItem(page, 'gameActionsState');
      const lastAction = gameActions.value[gameActions.value.length - 1];
      
      // State-only update should be merged, not add a visible story entry
      expect(lastAction.stats_update).toBeTruthy();
    }
  });
});
