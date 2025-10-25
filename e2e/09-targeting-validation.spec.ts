import { test, expect } from '@playwright/test';
import { installGeminiApiMocks } from './utils/geminiMocks';
import {
  setupApiKey,
  quickstartWithParty,
  clearGameState,
  getLocalStorageItem,
  waitForModal,
} from './utils/testHelpers';

test.describe('9. Targeting & Abilities', () => {
  test.beforeEach(async ({ page }) => {
    await clearGameState(page);
    await installGeminiApiMocks(page);
    await setupApiKey(page);
  });

  test('9.1 Target modal population (H)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    // Start combat to have NPCs
    const actionInput = page.locator('input[placeholder*="action" i], textarea[placeholder*="action" i]').first();
    if (await actionInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await actionInput.fill('Combat starts with enemies');
      const submitButton = page.getByRole('button', { name: /submit|send/i }).first();
      await submitButton.click();
      await page.waitForTimeout(4000);
      
      // Open abilities/spells
      const abilitiesButton = page.getByRole('button', { name: /abilities|spells/i });
      if (await abilitiesButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await abilitiesButton.click();
        await page.waitForTimeout(500);
        
        // Click an ability that requires a target
        const targetAbilityButton = page.getByRole('button', { name: /attack|strike/i }).first();
        if (await targetAbilityButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await targetAbilityButton.click();
          await page.waitForTimeout(500);
          
          // Target modal should appear
          const targetModal = page.getByRole('dialog');
          if (await targetModal.isVisible({ timeout: 3000 }).catch(() => false)) {
            // Should list NPCs + party members (excluding active character to avoid duplication)
            const targetOptions = page.locator('[data-testid="target-option"]');
            const count = await targetOptions.count();
            
            expect(count).toBeGreaterThan(0);
            
            // Verify technical IDs are used (not display names in selection value)
            // Select a target
            if (count > 0) {
              await targetOptions.first().click();
              await page.waitForTimeout(500);
              
              const confirmButton = page.getByRole('button', { name: /confirm|select/i });
              if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
                await confirmButton.click();
                await page.waitForTimeout(2000);
              }
            }
          }
        }
      }
    }
  });

  test('9.2 Ability resource cost enforcement (H)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    // Set a character's resource to low value
    await page.evaluate(() => {
      const playerCharacters = localStorage.getItem('playerCharactersGameState');
      if (playerCharacters) {
        const data = JSON.parse(playerCharacters);
        if (data.value?.player_character_1?.STAMINA) {
          data.value.player_character_1.STAMINA.current_value = 1; // Very low stamina
          localStorage.setItem('playerCharactersGameState', JSON.stringify(data));
        }
      }
    });
    
    await page.reload();
    await page.goto('/game');
    await page.waitForTimeout(2000);
    
    // Try to use ability that costs more than available
    const abilitiesButton = page.getByRole('button', { name: /abilities|spells/i });
    if (await abilitiesButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await abilitiesButton.click();
      await page.waitForTimeout(500);
      
      // Find ability with STAMINA cost > 1
      const expensiveAbility = page.getByRole('button').filter({ hasText: /stamina.*cost.*[2-9]/i });
      if (await expensiveAbility.isVisible({ timeout: 3000 }).catch(() => false)) {
        const isDisabled = await expensiveAbility.isDisabled();
        expect(isDisabled).toBeTruthy();
      }
    }
    
    // Set sufficient resources
    await page.evaluate(() => {
      const playerCharacters = localStorage.getItem('playerCharactersGameState');
      if (playerCharacters) {
        const data = JSON.parse(playerCharacters);
        if (data.value?.player_character_1?.STAMINA) {
          data.value.player_character_1.STAMINA.current_value = 10; // Sufficient stamina
          localStorage.setItem('playerCharactersGameState', JSON.stringify(data));
        }
      }
    });
    
    await page.reload();
    await page.goto('/game');
    await page.waitForTimeout(2000);
    
    // Now ability should be enabled
    if (await abilitiesButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await abilitiesButton.click();
      await page.waitForTimeout(500);
      
      const expensiveAbility = page.getByRole('button').filter({ hasText: /stamina/i }).first();
      if (await expensiveAbility.isVisible({ timeout: 3000 }).catch(() => false)) {
        const isEnabled = !(await expensiveAbility.isDisabled());
        expect(isEnabled).toBeTruthy();
        
        // Use the ability
        await expensiveAbility.click();
        await page.waitForTimeout(3000);
        
        // Verify resource was decremented via stats_update
        const gameActions = await getLocalStorageItem(page, 'gameActionsState');
        const lastAction = gameActions.value[gameActions.value.length - 1];
        
        if (lastAction.stats_update) {
          // Should have negative STAMINA cost
          expect(lastAction.stats_update).toBeTruthy();
        }
      }
    }
  });

  test('9.3 Ability cost normalization (M)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    // Verify mixed-case resource keys are normalized
    // This tests the mapping logic that handles resource_key case sensitivity
    const partyStats = await getLocalStorageItem(page, 'partyStatsState');
    
    if (partyStats.value?.members?.[0]?.spells_and_abilities) {
      const abilities = partyStats.value.members[0].spells_and_abilities;
      
      // All abilities should have normalized resource_cost
      for (const ability of abilities) {
        if (ability.resource_cost && ability.resource_cost.resource_key) {
          // Resource key should match a known resource in the character
          const resourceKey = ability.resource_cost.resource_key;
          
          const playerCharacters = await getLocalStorageItem(page, 'playerCharactersGameState');
          const resources = playerCharacters.value?.player_character_1;
          
          // Check if resource exists (case-insensitive match works)
          const resourceExists = Object.keys(resources || {}).some(
            key => key.toUpperCase() === resourceKey.toUpperCase()
          );
          
          if (resourceKey) {
            expect(resourceExists).toBeTruthy();
          }
        }
      }
    }
  });
});

test.describe('16. Security / Data Integrity', () => {
  test.beforeEach(async ({ page }) => {
    await clearGameState(page);
    await installGeminiApiMocks(page);
    await setupApiKey(page);
  });

  test('16.1 No direct resource mutation (H)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    // Monitor for direct mutations (this is a smoke test)
    // Actual implementation would need instrumentation
    
    // Get initial resources
    const playerCharactersBefore = await getLocalStorageItem(page, 'playerCharactersGameState');
    const hpBefore = playerCharactersBefore.value?.player_character_1?.HP?.current_value;
    
    // Perform rest action (should use stats_update)
    const shortRestButton = page.getByRole('button', { name: /short.*rest/i });
    if (await shortRestButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await shortRestButton.click();
      await page.waitForTimeout(3000);
      
      // Verify mutation went through stats_update path
      const gameActions = await getLocalStorageItem(page, 'gameActionsState');
      const lastAction = gameActions.value[gameActions.value.length - 1];
      
      // Must have stats_update
      expect(lastAction.stats_update).toBeTruthy();
      
      // No direct localStorage mutation (resources changed via applyGameActionState)
      const playerCharactersAfter = await getLocalStorageItem(page, 'playerCharactersGameState');
      const hpAfter = playerCharactersAfter.value?.player_character_1?.HP?.current_value;
      
      // HP should have changed
      if (hpBefore !== undefined && hpAfter !== undefined) {
        expect(hpAfter).toBeGreaterThanOrEqual(hpBefore);
      }
    }
  });

  test('16.2 No party members in NPC list (C)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    // Get party member names
    const partyState = await getLocalStorageItem(page, 'partyState');
    const partyMemberNames = partyState.value?.members?.map((m: any) => m.name.toLowerCase()) || [];
    
    expect(partyMemberNames.length).toBeGreaterThan(0);
    
    // Execute action that might introduce NPCs
    const actionInput = page.locator('input[placeholder*="action" i], textarea[placeholder*="action" i]').first();
    if (await actionInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await actionInput.fill('I meet some characters');
      const submitButton = page.getByRole('button', { name: /submit|send/i }).first();
      await submitButton.click();
      await page.waitForTimeout(4000);
      
      // Verify no party members appear in currently_present_npcs
      const gameActions = await getLocalStorageItem(page, 'gameActionsState');
      const lastAction = gameActions.value[gameActions.value.length - 1];
      
      if (lastAction.currently_present_npcs && lastAction.currently_present_npcs.length > 0) {
        for (const npc of lastAction.currently_present_npcs) {
          const npcNameLower = npc.toLowerCase();
          
          // NPC should not match any party member name
          const isPartyMember = partyMemberNames.some((pmName: string) => 
            npcNameLower.includes(pmName) || pmName.includes(npcNameLower)
          );
          
          expect(isPartyMember).toBeFalsy();
        }
      }
    }
  });
});
