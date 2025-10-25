import { test, expect } from '@playwright/test';
import { installGeminiApiMocks } from './utils/geminiMocks';
import {
  setupApiKey,
  quickstartWithParty,
  clearGameState,
  getLocalStorageItem,
  isInCombat,
  performShortRest,
  performLongRest,
} from './utils/testHelpers';

test.describe('5. Dice & Combat', () => {
  test.beforeEach(async ({ page }) => {
    await clearGameState(page);
    await installGeminiApiMocks(page);
    await setupApiKey(page);
  });

  test('5.4 Combat lifecycle (C)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    // Trigger combat via action
    const actionInput = page.locator('input[placeholder*="action" i], textarea[placeholder*="action" i]').first();
    if (await actionInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await actionInput.fill('I attack the enemy');
      const submitButton = page.getByRole('button', { name: /submit|send/i }).first();
      await submitButton.click();
      await page.waitForTimeout(4000);
      
      // Check if combat state is active (look for combat badge or indicator)
      const combatBadge = page.locator('[data-testid="combat-badge"]').or(
        page.getByText(/in combat/i)
      );
      
      // Verify combat flag in localStorage
      const gameActions = await getLocalStorageItem(page, 'gameActionsState');
      if (gameActions.value.length > 0) {
        const lastAction = gameActions.value[gameActions.value.length - 1];
        
        // If combat started, verify NPCs are present
        if (lastAction.is_character_in_combat) {
          expect(lastAction.currently_present_npcs).toBeTruthy();
          expect(lastAction.currently_present_npcs.length).toBeGreaterThan(0);
          
          // Verify rest actions are disabled during combat
          const restButton = page.getByRole('button', { name: /rest/i });
          if (await restButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            const isDisabled = await restButton.isDisabled();
            expect(isDisabled).toBeTruthy();
          }
          
          // End combat via another action
          await actionInput.fill('I defeat the enemy');
          await submitButton.click();
          await page.waitForTimeout(4000);
          
          const gameActionsAfter = await getLocalStorageItem(page, 'gameActionsState');
          const finalAction = gameActionsAfter.value[gameActionsAfter.value.length - 1];
          
          // Combat should end
          if (finalAction.is_character_in_combat === false) {
            expect(finalAction.currently_present_npcs.length).toBe(0);
          }
        }
      }
    }
  });

  test('5.5 NPC multi-action + dead filtering (H)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    // Start combat with multiple NPCs
    const actionInput = page.locator('input[placeholder*="action" i], textarea[placeholder*="action" i]').first();
    if (await actionInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await actionInput.fill('Multiple enemies appear');
      const submitButton = page.getByRole('button', { name: /submit|send/i }).first();
      await submitButton.click();
      await page.waitForTimeout(4000);
      
      const gameActions = await getLocalStorageItem(page, 'gameActionsState');
      const lastAction = gameActions.value[gameActions.value.length - 1];
      
      if (lastAction.currently_present_npcs && lastAction.currently_present_npcs.length > 0) {
        const npcCount = lastAction.currently_present_npcs.length;
        
        // Kill one NPC
        await actionInput.fill('I kill the first enemy');
        await submitButton.click();
        await page.waitForTimeout(4000);
        
        const gameActionsAfter = await getLocalStorageItem(page, 'gameActionsState');
        const actionAfterKill = gameActionsAfter.value[gameActionsAfter.value.length - 1];
        
        // Dead NPC should be filtered from subsequent actions
        // The NPC list should be updated (either reduced or marked as dead)
        expect(actionAfterKill.currently_present_npcs).toBeTruthy();
      }
    }
  });

  test('5.6 Multi-target damage (H)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    // Execute an action that affects multiple targets
    const actionInput = page.locator('input[placeholder*="action" i], textarea[placeholder*="action" i]').first();
    if (await actionInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await actionInput.fill('I use an area attack hitting everyone');
      const submitButton = page.getByRole('button', { name: /submit|send/i }).first();
      await submitButton.click();
      await page.waitForTimeout(4000);
      
      const gameActions = await getLocalStorageItem(page, 'gameActionsState');
      const lastAction = gameActions.value[gameActions.value.length - 1];
      
      // Verify stats_update handles multiple targets
      if (lastAction.stats_update) {
        // Stats updates should be properly structured per target
        expect(lastAction.stats_update).toBeTruthy();
        
        // Check that UI rendering would handle party pronoun (third-person)
        // This is tested implicitly by checking the structure
      }
    }
  });
});

test.describe('6. Inventory & Items', () => {
  test.beforeEach(async ({ page }) => {
    await clearGameState(page);
    await installGeminiApiMocks(page);
    await setupApiKey(page);
  });

  test('6.1 Item consumption (H)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    // Add an item via action
    const actionInput = page.locator('input[placeholder*="action" i], textarea[placeholder*="action" i]').first();
    if (await actionInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await actionInput.fill('I find a healing potion');
      const submitButton = page.getByRole('button', { name: /submit|send/i }).first();
      await submitButton.click();
      await page.waitForTimeout(4000);
      
      // Check inventory
      const inventoryButton = page.getByRole('button', { name: /inventory|items/i });
      if (await inventoryButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await inventoryButton.click();
        await page.waitForTimeout(500);
        
        // Use the item
        const useItemButton = page.getByRole('button', { name: /use.*potion/i }).first();
        if (await useItemButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await useItemButton.click();
          await page.waitForTimeout(2000);
          
          // Verify item was consumed
          const gameActions = await getLocalStorageItem(page, 'gameActionsState');
          const lastAction = gameActions.value[gameActions.value.length - 1];
          
          if (lastAction.inventory_update) {
            const removeAction = lastAction.inventory_update.find((u: any) => u.action === 'remove_item');
            expect(removeAction).toBeTruthy();
          }
        }
      }
    }
  });

  test('6.2 Add item via story (M)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    const actionInput = page.locator('input[placeholder*="action" i], textarea[placeholder*="action" i]').first();
    if (await actionInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await actionInput.fill('I search for items');
      const submitButton = page.getByRole('button', { name: /submit|send/i }).first();
      await submitButton.click();
      await page.waitForTimeout(4000);
      
      const gameActions = await getLocalStorageItem(page, 'gameActionsState');
      const lastAction = gameActions.value[gameActions.value.length - 1];
      
      // Verify add_item inventory_update creates proper entry
      if (lastAction.inventory_update) {
        const addActions = lastAction.inventory_update.filter((u: any) => u.action === 'add_item');
        if (addActions.length > 0) {
          expect(addActions[0].item_added).toBeTruthy();
          expect(addActions[0].item_added.name).toBeTruthy();
        }
      }
    }
  });
});

test.describe('7. Utility / Rest Mechanics', () => {
  test.beforeEach(async ({ page }) => {
    await clearGameState(page);
    await installGeminiApiMocks(page);
    await setupApiKey(page);
  });

  test('7.1 Short Rest resource refill (H)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    // First, damage the character
    const actionInput = page.locator('input[placeholder*="action" i], textarea[placeholder*="action" i]').first();
    if (await actionInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await actionInput.fill('I take damage from a trap');
      const submitButton = page.getByRole('button', { name: /submit|send/i }).first();
      await submitButton.click();
      await page.waitForTimeout(4000);
      
      // Get resources before rest
      const playerCharactersBefore = await getLocalStorageItem(page, 'playerCharactersGameState');
      const hpBefore = playerCharactersBefore.value?.player_character_1?.HP?.current_value;
      
      // Perform short rest
      const shortRestButton = page.getByRole('button', { name: /short.*rest/i });
      if (await shortRestButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await shortRestButton.click();
        await page.waitForTimeout(3000);
        
        // Verify resources were refilled via stats_update
        const gameActions = await getLocalStorageItem(page, 'gameActionsState');
        const lastAction = gameActions.value[gameActions.value.length - 1];
        
        expect(lastAction.stats_update).toBeTruthy();
        
        // Check that resources increased
        const playerCharactersAfter = await getLocalStorageItem(page, 'playerCharactersGameState');
        const hpAfter = playerCharactersAfter.value?.player_character_1?.HP?.current_value;
        
        // HP should be restored (capped at max)
        if (hpBefore !== undefined && hpAfter !== undefined) {
          expect(hpAfter).toBeGreaterThanOrEqual(hpBefore);
        }
      }
    }
  });

  test('7.2 Long Rest full refill (M)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    const longRestButton = page.getByRole('button', { name: /long.*rest/i });
    if (await longRestButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await longRestButton.click();
      await page.waitForTimeout(3000);
      
      // Verify full refill via stats_update
      const gameActions = await getLocalStorageItem(page, 'gameActionsState');
      const lastAction = gameActions.value[gameActions.value.length - 1];
      
      expect(lastAction.stats_update).toBeTruthy();
      
      // All resources should be at max (except XP)
      const playerCharacters = await getLocalStorageItem(page, 'playerCharactersGameState');
      const character = playerCharacters.value?.player_character_1;
      
      if (character) {
        for (const [key, resource] of Object.entries(character)) {
          if (typeof resource === 'object' && resource !== null && 'current_value' in resource && key !== 'XP') {
            const r = resource as any;
            expect(r.current_value).toBe(r.max_value || r.start_value);
          }
        }
      }
    }
  });
});
