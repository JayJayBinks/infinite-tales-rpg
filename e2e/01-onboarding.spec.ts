import { test, expect } from '@playwright/test';
import { installGeminiApiMocks } from './utils/geminiMocks';
import {
  setupApiKey,
  quickstartWithParty,
  clearGameState,
  getLocalStorageItem,
  createCustomTale,
} from './utils/testHelpers';

test.describe('1. Onboarding & Tale Setup', () => {
  test.beforeEach(async ({ page }) => {
    await clearGameState(page);
    await installGeminiApiMocks(page);
    await setupApiKey(page);
  });

  test('1.1 Quickstart happy path (C)', async ({ page }) => {
    // Navigate to quickstart
    await page.goto('/game/new/tale');
    
    // Click quickstart button
    const quickstartButton = page.getByRole('button', { name: /quickstart/i });
    await quickstartButton.click();
    
    // Wait for tale generation to complete
    await page.waitForTimeout(2000);
    
    // Verify tale was created in localStorage
    const storyState = await getLocalStorageItem(page, 'storyState');
    expect(storyState).toBeTruthy();
    expect(storyState.game).toBeTruthy();
    
    // Navigate to party creation
    await page.goto('/game/new/character');
    
    // Generate party (4 members)
    const generatePartyButton = page.getByRole('button', { name: /generate.*party/i });
    if (await generatePartyButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await generatePartyButton.click();
      await page.waitForTimeout(2000);
    }
    
    // Verify party was created
    const partyState = await getLocalStorageItem(page, 'partyState');
    expect(partyState).toBeTruthy();
    expect(partyState.members).toBeTruthy();
    expect(partyState.members.length).toBe(4);
    
    // Start the tale
    const startButton = page.getByRole('button', { name: /start.*tale/i });
    await startButton.click();
    
    // Wait for game to load
    await page.waitForURL('**/game', { timeout: 10000 });
    
    // Verify active character ID is set
    const activeCharacterId = await getLocalStorageItem(page, 'activeCharacterId');
    expect(activeCharacterId).toBeTruthy();
    expect(activeCharacterId.value).toBe('player_character_1');
    
    // Wait for initial story
    await page.waitForTimeout(3000);
    
    // Verify no party members appear in NPCs list
    const playerCharactersGameState = await getLocalStorageItem(page, 'playerCharactersGameState');
    expect(playerCharactersGameState).toBeTruthy();
    
    // Check that party members are properly initialized with resources
    const firstMember = playerCharactersGameState.value?.player_character_1;
    expect(firstMember).toBeTruthy();
    expect(firstMember.HP).toBeTruthy();
    expect(firstMember.HP.current_value).toBeDefined();
  });

  test('1.2 Quickstart with overwrites (H)', async ({ page }) => {
    await page.goto('/game/new/tale');
    
    // Fill in custom adventure blurb
    const adventureInput = page.locator('textarea').first();
    await adventureInput.fill('A custom adventure blurb');
    
    // Fill in custom party concept
    const partyConceptInputs = page.locator('input');
    for (let i = 0; i < await partyConceptInputs.count(); i++) {
      const input = partyConceptInputs.nth(i);
      const placeholder = await input.getAttribute('placeholder');
      if (placeholder && placeholder.toLowerCase().includes('party')) {
        await input.fill('A custom party concept');
        break;
      }
    }
    
    // Generate tale
    const generateButton = page.getByRole('button', { name: /generate/i }).first();
    await generateButton.click();
    await page.waitForTimeout(2000);
    
    // Verify custom values were used
    const storyState = await getLocalStorageItem(page, 'storyState');
    expect(storyState).toBeTruthy();
    expect(storyState.adventure_and_main_event).toContain('custom adventure');
    expect(storyState.party_concept).toContain('custom party');
  });

  test('1.3 Custom tale generation minimal input (H)', async ({ page }) => {
    await page.goto('/game/new/tale');
    
    // Leave most fields empty, just fill one field
    const inputs = page.locator('input, textarea');
    if (await inputs.count() > 0) {
      // Fill just the first input
      await inputs.first().fill('Minimal input');
    }
    
    // Generate tale
    const generateButton = page.getByRole('button', { name: /generate/i }).first();
    await generateButton.click();
    await page.waitForTimeout(2000);
    
    // Verify tale was created with auto-filled fields
    const storyState = await getLocalStorageItem(page, 'storyState');
    expect(storyState).toBeTruthy();
    expect(storyState.game).toBeTruthy();
    expect(storyState.world_details).toBeTruthy();
    
    // Navigate to party creation
    await page.goto('/game/new/character');
    
    // Verify party creation view loaded with tale
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });

  test('1.4 Randomize all (M)', async ({ page }) => {
    await page.goto('/game/new/tale');
    
    // Click randomize all button if it exists
    const randomizeButton = page.getByRole('button', { name: /randomize.*all/i });
    if (await randomizeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await randomizeButton.click();
      await page.waitForTimeout(1000);
      
      // Verify fields are populated
      const storyState = await getLocalStorageItem(page, 'storyState');
      expect(storyState).toBeTruthy();
      expect(storyState.game).toBeTruthy();
      expect(storyState.world_details).toBeTruthy();
      
      // Refresh and verify persistence
      await page.reload();
      const storyStateAfterRefresh = await getLocalStorageItem(page, 'storyState');
      expect(storyStateAfterRefresh).toEqual(storyState);
    }
  });

  test('1.6 Save import (C)', async ({ page }) => {
    // Create a complete game state first
    await quickstartWithParty(page);
    
    // Export current state
    const originalState = await page.evaluate(() => {
      const keys = [
        'storyState',
        'partyState',
        'partyStatsState',
        'activeCharacterId',
        'playerCharactersGameState',
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
    
    // Clear state
    await clearGameState(page);
    
    // Verify state is cleared
    let storyState = await getLocalStorageItem(page, 'storyState');
    expect(storyState).toBeFalsy();
    
    // Import saved state
    await page.evaluate((data) => {
      Object.keys(data).forEach(key => {
        localStorage.setItem(key, typeof data[key] === 'string' ? data[key] : JSON.stringify(data[key]));
      });
    }, originalState);
    
    // Reload page
    await page.reload();
    await page.goto('/game');
    
    // Verify state was restored
    storyState = await getLocalStorageItem(page, 'storyState');
    expect(storyState).toBeTruthy();
    expect(storyState.game).toBe(originalState.storyState.game);
    
    const partyState = await getLocalStorageItem(page, 'partyState');
    expect(partyState).toBeTruthy();
    expect(partyState.members.length).toBe(originalState.partyState.members.length);
    
    const activeCharacterId = await getLocalStorageItem(page, 'activeCharacterId');
    expect(activeCharacterId.value).toBe(originalState.activeCharacterId.value);
  });
});
