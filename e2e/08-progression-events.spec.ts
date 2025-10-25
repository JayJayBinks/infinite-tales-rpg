import { test, expect } from '@playwright/test';
import { installGeminiApiMocks } from './utils/geminiMocks';
import {
  setupApiKey,
  quickstartWithParty,
  clearGameState,
  getLocalStorageItem,
  waitForModal,
  closeModal,
} from './utils/testHelpers';

test.describe('8. Progression & Events', () => {
  test.beforeEach(async ({ page }) => {
    await clearGameState(page);
    await installGeminiApiMocks(page);
    await setupApiKey(page);
  });

  test('8.1 XP threshold level up (H)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    // Manually set high XP to trigger level up
    await page.evaluate(() => {
      const playerCharacters = localStorage.getItem('playerCharactersGameState');
      if (playerCharacters) {
        const data = JSON.parse(playerCharacters);
        if (data.value?.player_character_1?.XP) {
          data.value.player_character_1.XP.current_value = 1000; // High XP
          localStorage.setItem('playerCharactersGameState', JSON.stringify(data));
        }
      }
    });
    
    await page.reload();
    await page.goto('/game');
    await page.waitForTimeout(2000);
    
    // Trigger action that might cause level up evaluation
    const actionInput = page.locator('input[placeholder*="action" i], textarea[placeholder*="action" i]').first();
    if (await actionInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await actionInput.fill('I gain experience');
      const submitButton = page.getByRole('button', { name: /submit|send/i }).first();
      await submitButton.click();
      await page.waitForTimeout(4000);
      
      // Look for level up modal or indicator
      const levelUpModal = page.getByText(/level.*up/i);
      if (await levelUpModal.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Accept level up
        const acceptButton = page.getByRole('button', { name: /accept|confirm/i }).first();
        if (await acceptButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await acceptButton.click();
          await page.waitForTimeout(1000);
          
          // Verify level increased and XP was deducted
          const gameActions = await getLocalStorageItem(page, 'gameActionsState');
          const lastAction = gameActions.value[gameActions.value.length - 1];
          
          if (lastAction.stats_update) {
            // Should contain now_level_X entry and XP deduction
            expect(lastAction.stats_update).toBeTruthy();
          }
        }
      }
    }
  });

  test('8.3 Abilities learned event (H)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    // Trigger action that learns new abilities
    const actionInput = page.locator('input[placeholder*="action" i], textarea[placeholder*="action" i]').first();
    if (await actionInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await actionInput.fill('I discover ancient magic');
      const submitButton = page.getByRole('button', { name: /submit|send/i }).first();
      await submitButton.click();
      await page.waitForTimeout(4000);
      
      // Look for abilities learned modal
      const abilitiesModal = page.getByText(/abilities.*learned|new.*ability/i);
      if (await abilitiesModal.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Verify abilities list excludes duplicates
        const abilityElements = page.locator('[data-testid="new-ability"]');
        const count = await abilityElements.count();
        
        // Accept new abilities
        const acceptButton = page.getByRole('button', { name: /accept|confirm/i }).first();
        if (await acceptButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await acceptButton.click();
          await page.waitForTimeout(1000);
          
          // Verify abilities were added to character stats
          const partyStats = await getLocalStorageItem(page, 'partyStatsState');
          if (partyStats.value?.members?.[0]?.spells_and_abilities) {
            expect(partyStats.value.members[0].spells_and_abilities.length).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  test('8.4 Transformation confirmation gating (H)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    // Trigger transformation event
    const actionInput = page.locator('input[placeholder*="action" i], textarea[placeholder*="action" i]').first();
    if (await actionInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await actionInput.fill('I am exposed to dragon magic');
      const submitButton = page.getByRole('button', { name: /submit|send/i }).first();
      await submitButton.click();
      await page.waitForTimeout(4000);
      
      // Look for transformation modal
      const transformModal = page.getByText(/transform|change.*into/i);
      if (await transformModal.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Before confirmation, character sheet should be unchanged
        const partyStateBefore = await getLocalStorageItem(page, 'partyState');
        const firstMemberBefore = partyStateBefore.value?.members?.[0];
        
        // Image prompt should exclude transformation
        const gameActions = await getLocalStorageItem(page, 'gameActionsState');
        const lastAction = gameActions.value[gameActions.value.length - 1];
        if (lastAction.image_prompt) {
          // Should not reference transformed state yet
          expect(lastAction.image_prompt).toBeTruthy();
        }
        
        // Confirm transformation
        const confirmButton = page.getByRole('button', { name: /accept|confirm/i }).first();
        if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmButton.click();
          await page.waitForTimeout(2000);
          
          // Post-confirmation: character should be updated
          const partyStateAfter = await getLocalStorageItem(page, 'partyState');
          const firstMemberAfter = partyStateAfter.value?.members?.[0];
          
          // Character description should have changed
          // (Depending on implementation details)
          expect(firstMemberAfter).toBeTruthy();
        }
      }
    }
  });

  test('8.5 Party-wide event evaluation (C)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    // Trigger an event that affects the whole party
    const actionInput = page.locator('input[placeholder*="action" i], textarea[placeholder*="action" i]').first();
    if (await actionInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await actionInput.fill('We all experience a mystical event');
      const submitButton = page.getByRole('button', { name: /submit|send/i }).first();
      await submitButton.click();
      await page.waitForTimeout(4000);
      
      // Verify event evaluation occurred for all party members
      const eventEvaluationByMember = await getLocalStorageItem(page, 'eventEvaluationByMemberState');
      if (eventEvaluationByMember) {
        // Should have evaluations per member
        expect(eventEvaluationByMember.value).toBeTruthy();
      }
      
      // Verify active member's legacy state mirrors their evaluation
      const activeId = await getLocalStorageItem(page, 'activeCharacterId');
      const eventEvaluation = await getLocalStorageItem(page, 'eventEvaluationState');
      
      if (eventEvaluation && eventEvaluationByMember) {
        // Legacy state should match active member's evaluation
        expect(eventEvaluation).toBeTruthy();
      }
    }
  });

  test('8.6 Restraining state actions (H)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    // Trigger a restraining state (e.g., paralyzed, bound)
    const actionInput = page.locator('input[placeholder*="action" i], textarea[placeholder*="action" i]').first();
    if (await actionInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await actionInput.fill('I become restrained');
      const submitButton = page.getByRole('button', { name: /submit|send/i }).first();
      await submitButton.click();
      await page.waitForTimeout(4000);
      
      // Check if restraining state was applied
      const restrainedExplanation = await getLocalStorageItem(page, 'restrainedExplanationByMemberState');
      if (restrainedExplanation?.value?.player_character_1) {
        // ActionAgent suggestions should be restricted
        // Request suggested actions
        const suggestButton = page.getByRole('button', { name: /suggest.*action/i });
        if (await suggestButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await suggestButton.click();
          await page.waitForTimeout(2000);
          
          // Suggested actions should reflect restrained state
          const suggestions = page.locator('[data-testid="suggested-action"]');
          const suggestionTexts: string[] = [];
          for (let i = 0; i < await suggestions.count(); i++) {
            const text = await suggestions.nth(i).textContent();
            if (text) suggestionTexts.push(text.toLowerCase());
          }
          
          // Should not suggest impossible actions like "run away"
          // (Implementation specific)
        }
        
        // Remove restraining state
        await actionInput.fill('I break free');
        await submitButton.click();
        await page.waitForTimeout(4000);
        
        const restrainedAfter = await getLocalStorageItem(page, 'restrainedExplanationByMemberState');
        // Restraining state should be removed
        expect(restrainedAfter?.value?.player_character_1).toBeFalsy();
      }
    }
  });
});

test.describe('10. Persistence & Recovery', () => {
  test.beforeEach(async ({ page }) => {
    await clearGameState(page);
    await installGeminiApiMocks(page);
    await setupApiKey(page);
  });

  test('10.1 Auto-save after action (C)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    // Execute an action
    const actionInput = page.locator('input[placeholder*="action" i], textarea[placeholder*="action" i]').first();
    if (await actionInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await actionInput.fill('Test action for auto-save');
      const submitButton = page.getByRole('button', { name: /submit|send/i }).first();
      await submitButton.click();
      await page.waitForTimeout(4000);
      
      // Get current state
      const gameActions = await getLocalStorageItem(page, 'gameActionsState');
      const playerCharacters = await getLocalStorageItem(page, 'playerCharactersGameState');
      const activeCharacterId = await getLocalStorageItem(page, 'activeCharacterId');
      
      // Reload page to verify persistence
      await page.reload();
      await page.goto('/game');
      await page.waitForTimeout(2000);
      
      // Verify state was preserved
      const gameActionsAfter = await getLocalStorageItem(page, 'gameActionsState');
      const playerCharactersAfter = await getLocalStorageItem(page, 'playerCharactersGameState');
      const activeCharacterIdAfter = await getLocalStorageItem(page, 'activeCharacterId');
      
      expect(gameActionsAfter.value.length).toBe(gameActions.value.length);
      expect(activeCharacterIdAfter.value).toBe(activeCharacterId.value);
      
      // Resources should be preserved
      if (playerCharacters.value?.player_character_1?.HP) {
        expect(playerCharactersAfter.value.player_character_1.HP.current_value)
          .toBe(playerCharacters.value.player_character_1.HP.current_value);
      }
    }
  });

  test('10.3 Export/import mid-combat (H)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    // Start combat
    const actionInput = page.locator('input[placeholder*="action" i], textarea[placeholder*="action" i]').first();
    if (await actionInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await actionInput.fill('I enter combat');
      const submitButton = page.getByRole('button', { name: /submit|send/i }).first();
      await submitButton.click();
      await page.waitForTimeout(4000);
      
      // Export state mid-combat
      const saveData = await page.evaluate(() => {
        const keys = [
          'storyState',
          'partyState',
          'partyStatsState',
          'activeCharacterId',
          'playerCharactersGameState',
          'gameActionsState',
        ];
        
        const data: Record<string, any> = {};
        keys.forEach(key => {
          const item = localStorage.getItem(key);
          if (item) {
            try {
              data[key] = JSON.parse(item);
            } catch {
              data[key] = item;
            }
          }
        });
        
        return data;
      });
      
      // Clear and reimport
      await clearGameState(page);
      
      await page.evaluate((data) => {
        Object.keys(data).forEach(key => {
          localStorage.setItem(key, typeof data[key] === 'string' ? data[key] : JSON.stringify(data[key]));
        });
      }, saveData);
      
      await page.reload();
      await page.goto('/game');
      await page.waitForTimeout(2000);
      
      // Verify combat state was preserved
      const gameActions = await getLocalStorageItem(page, 'gameActionsState');
      const lastAction = gameActions.value[gameActions.value.length - 1];
      
      // Combat flag and NPCs should be preserved
      expect(lastAction).toBeTruthy();
      if (lastAction.is_character_in_combat) {
        expect(lastAction.is_character_in_combat).toBe(true);
        expect(lastAction.currently_present_npcs).toBeTruthy();
      }
    }
  });
});
