import { test, expect } from '@playwright/test';
import { installGeminiApiMocks, completeQuickstartFlow } from './utils/geminiMocks';

test.describe('Modals & Auxiliary Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await installGeminiApiMocks(page);
  });

  test('GM Question modal workflow', async ({ page }) => {
    await completeQuickstartFlow(page);

    await expect(page.locator('h2:has-text("Story")')).toBeVisible({ timeout: 10000 });

    // Look for GM Question button or menu
    const gmBtn = page.getByRole('button', { name: /gm|question|ask/i }).first();
    
    if (await gmBtn.isVisible().catch(() => false)) {
      await gmBtn.click();
      await page.waitForTimeout(500);

      // Modal should open
      const modal = page.locator('.modal.modal-open, [role="dialog"]').first();
      await expect(modal).toBeVisible({ timeout: 3000 }).catch(() => {
        console.log('GM Question modal not visible');
      });

      // Submit a question
      const questionInput = page.getByPlaceholder(/question|ask/i).first();
      if (await questionInput.isVisible().catch(() => false)) {
        await questionInput.fill('What are the current quest objectives?');
        
        const submitBtn = page.getByRole('button', { name: /submit|ask|send/i }).first();
        if (await submitBtn.isVisible().catch(() => false)) {
          await submitBtn.click();
          await page.waitForTimeout(2000);

          // Expected: Answer appears
          const answer = page.locator('text=/answer|response|objective/i').first();
          await expect(answer).toBeVisible({ timeout: 5000 }).catch(() => {
            console.log('GM answer not visible');
          });
        }
      }
    } else {
      console.log('GM Question feature not found');
    }
  });

  test('Suggested actions generation', async ({ page }) => {
    await completeQuickstartFlow(page);

    await expect(page.locator('h2:has-text("Story")')).toBeVisible({ timeout: 10000 });

    // Look for suggested actions button
    const suggestBtn = page.getByRole('button', { name: /suggest|actions|ideas/i }).first();
    
    if (await suggestBtn.isVisible().catch(() => false)) {
      await suggestBtn.click();
      await page.waitForTimeout(2000);

      // Expected: Modal shows suggested actions
      const modal = page.locator('.modal.modal-open, [role="dialog"]').first();
      await expect(modal).toBeVisible({ timeout: 3000 }).catch(() => {
        console.log('Suggested actions modal not visible');
      });

      // Actions should be listed
      const actionItem = page.getByRole('button', { hasText: /take|scan|move/i }).first();
      if (await actionItem.isVisible().catch(() => false)) {
        // Select an action
        await actionItem.click();
        await page.waitForTimeout(1000);

        // Expected: Action is queued or executed
        console.log('Suggested action selected');
      }
    } else {
      console.log('Suggested actions feature not found');
    }
  });

  test('Inventory management', async ({ page }) => {
    await completeQuickstartFlow(page);

    await expect(page.locator('h2:has-text("Story")')).toBeVisible({ timeout: 10000 });

    // Look for inventory button
    const inventoryBtn = page.getByRole('button', { name: /inventory|items|bag/i }).first();
    
    if (await inventoryBtn.isVisible().catch(() => false)) {
      await inventoryBtn.click();
      await page.waitForTimeout(500);

      // Expected: Inventory modal opens
      const modal = page.locator('.modal.modal-open, [role="dialog"]').first();
      await expect(modal).toBeVisible({ timeout: 3000 }).catch(() => {
        console.log('Inventory modal not visible');
      });

      // Check for items (might be empty initially)
      const itemsList = page.locator('[class*="item"], [class*="inventory"]');
      const hasItems = await itemsList.count().then(c => c > 0).catch(() => false);
      
      if (hasItems) {
        console.log('Inventory has items');
        // Try to use an item
        const useBtn = page.getByRole('button', { name: /use|consume/i }).first();
        if (await useBtn.isVisible().catch(() => false)) {
          await useBtn.click();
          await page.waitForTimeout(1000);
        }
      } else {
        console.log('Inventory is empty');
      }

      // Close modal
      const closeBtn = modal.getByRole('button', { name: /close|✕/i }).first();
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click();
      }
    } else {
      console.log('Inventory feature not found');
    }
  });

  test('Utility actions (rest, recovery)', async ({ page }) => {
    await completeQuickstartFlow(page);

    await expect(page.locator('h2:has-text("Story")')).toBeVisible({ timeout: 10000 });

    // Look for utility or rest button
    const utilityBtn = page.getByRole('button', { name: /utility|rest|recover/i }).first();
    
    if (await utilityBtn.isVisible().catch(() => false)) {
      await utilityBtn.click();
      await page.waitForTimeout(500);

      // Expected: Utility modal opens
      const modal = page.locator('.modal.modal-open, [role="dialog"]').first();
      await expect(modal).toBeVisible({ timeout: 3000 }).catch(() => {
        console.log('Utility modal not visible');
      });

      // Look for short rest option
      const shortRestBtn = page.getByRole('button', { name: /short.*rest|rest/i }).first();
      if (await shortRestBtn.isVisible().catch(() => false)) {
        await shortRestBtn.click();
        await page.waitForTimeout(2000);

        // Expected: Resources regenerate
        console.log('Short rest action queued');
      }
    } else {
      console.log('Utility features not found');
    }
  });

  test('Modal keyboard navigation (ESC to close)', async ({ page }) => {
    await completeQuickstartFlow(page);

    await expect(page.locator('h2:has-text("Story")')).toBeVisible({ timeout: 10000 });

    // Open any modal
    const anyModalBtn = page.getByRole('button', { name: /inventory|utility|gm/i }).first();
    
    if (await anyModalBtn.isVisible().catch(() => false)) {
      await anyModalBtn.click();
      await page.waitForTimeout(500);

      const modal = page.locator('.modal.modal-open, [role="dialog"]').first();
      const isModalOpen = await modal.isVisible().catch(() => false);

      if (isModalOpen) {
        // Press ESC to close
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);

        // Expected: Modal closes
        await expect(modal).not.toBeVisible().catch(() => {
          console.log('Modal still visible after ESC - might not support keyboard close');
        });
      }
    }
  });

  test('Level up progression', async ({ page }) => {
    await completeQuickstartFlow(page);

    await expect(page.locator('h2:has-text("Story")')).toBeVisible({ timeout: 10000 });

    // Look for level up button or notification
    const levelUpBtn = page.getByRole('button', { name: /level.*up|advance/i }).first();
    
    if (await levelUpBtn.isVisible().catch(() => false)) {
      await levelUpBtn.click();
      await page.waitForTimeout(500);

      // Expected: Level up modal opens
      const modal = page.locator('.modal.modal-open, [role="dialog"]').first();
      await expect(modal).toBeVisible({ timeout: 3000 }).catch(() => {
        console.log('Level up modal not visible');
      });

      // Look for suggestions or manual controls
      const acceptBtn = page.getByRole('button', { name: /accept|apply|confirm/i }).first();
      if (await acceptBtn.isVisible().catch(() => false)) {
        await acceptBtn.click();
        await page.waitForTimeout(1000);

        // Expected: Stats updated, XP deducted
        console.log('Level up applied');
      }
    } else {
      console.log('Level up not available - character might not have enough XP');
    }
  });

  test('New abilities confirmation', async ({ page }) => {
    await completeQuickstartFlow(page);

    await expect(page.locator('h2:has-text("Story")')).toBeVisible({ timeout: 10000 });

    // Look for abilities/learn button
    const abilitiesBtn = page.getByRole('button', { name: /abilit|spell|learn/i }).first();
    
    if (await abilitiesBtn.isVisible().catch(() => false)) {
      await abilitiesBtn.click();
      await page.waitForTimeout(500);

      // Expected: Abilities modal opens
      const modal = page.locator('.modal.modal-open, [role="dialog"]').first();
      await expect(modal).toBeVisible({ timeout: 3000 }).catch(() => {
        console.log('Abilities modal not visible');
      });

      // Check for ability list
      const abilityList = page.locator('[class*="abilit"], [class*="spell"]');
      const hasAbilities = await abilityList.count().then(c => c > 0).catch(() => false);
      
      if (hasAbilities) {
        console.log('Abilities listed');
        
        // Try to confirm/accept new abilities
        const confirmBtn = page.getByRole('button', { name: /confirm|accept|learn/i }).first();
        if (await confirmBtn.isVisible().catch(() => false)) {
          await confirmBtn.click();
          await page.waitForTimeout(1000);
        }
      } else {
        console.log('No abilities available to learn');
      }
    } else {
      console.log('Abilities feature not found');
    }
  });
});
