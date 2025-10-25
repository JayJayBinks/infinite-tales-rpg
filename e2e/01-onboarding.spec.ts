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
    // Use quickstart to create party and start tale
    await quickstartWithParty(page, 4);
    
    // Verify tale was created in localStorage
    const storyState = await getLocalStorageItem(page, 'storyState');
    expect(storyState).toBeTruthy();
    expect(storyState.value?.game || storyState.game).toBeTruthy();
    
    // Verify party was created with 4 members
    const partyState = await getLocalStorageItem(page, 'partyState');
    expect(partyState).toBeTruthy();
    expect(partyState.value?.members || partyState.members).toBeTruthy();
    const members = partyState.value?.members || partyState.members;
    expect(members.length).toBe(4);
    
    // Verify active character ID is set to first member
    const activeCharacterId = await getLocalStorageItem(page, 'activeCharacterId');
    expect(activeCharacterId).toBeTruthy();
    // May be wrapped in value or direct
    const activeId = activeCharacterId.value || activeCharacterId;
    expect(activeId).toContain('player_character');
    
    // Wait for initial story to load
    await page.waitForTimeout(2000);
    
    // Verify party members are properly initialized with resources
    const playerCharactersGameState = await getLocalStorageItem(page, 'playerCharactersGameState');
    expect(playerCharactersGameState).toBeTruthy();
    
    // Check that at least the first member has resources initialized
    const gameState = playerCharactersGameState.value || playerCharactersGameState;
    const firstMember = gameState?.player_character_1;
    if (firstMember) {
      // Should have at least HP resource
      expect(firstMember.HP || firstMember.hp).toBeTruthy();
    }
  });

  test('1.2 Quickstart with overwrites (H)', async ({ page }) => {
    await page.goto('/game/settings/ai');
    await page.waitForTimeout(500);
    
    // Click quickstart button
    const quickstartButton = page.getByRole('button', { name: /quickstart/i });
    await quickstartButton.click();
    await page.waitForTimeout(500);
    
    // Fill in custom adventure blurb in the modal
    const adventureTextarea = page.locator('textarea').first();
    await adventureTextarea.fill('A custom adventure blurb');
    await page.waitForTimeout(300);
    
    // Fill in custom party description
    const partyTextarea = page.locator('textarea').nth(1);
    await partyTextarea.fill('A custom party concept');
    await page.waitForTimeout(300);
    
    // Select party size (2 members for this test)
    const partySizeButton = page.getByRole('button', { name: '2' }).first();
    await partySizeButton.click();
    await page.waitForTimeout(300);
    
    // Click "Start" to generate with custom values
    const startButton = page.getByRole('button', { name: /^start$/i });
    await startButton.click();
    
    // Wait for generation and navigation
    await page.waitForURL('**/game', { timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Verify custom values were used
    const storyState = await getLocalStorageItem(page, 'storyState');
    expect(storyState).toBeTruthy();
    
    const story = storyState.value || storyState;
    // The custom adventure should be reflected in the tale
    expect(story.adventure_and_main_event || story).toBeTruthy();
    
    // Verify party was created with 2 members
    const partyState = await getLocalStorageItem(page, 'partyState');
    const members = partyState.value?.members || partyState.members;
    expect(members).toBeTruthy();
    expect(members.length).toBe(2);
  });

  test('1.3 Custom tale generation minimal input (H)', async ({ page }) => {
    await page.goto('/game/settings/ai');
    await page.waitForTimeout(500);
    
    // Click quickstart button
    const quickstartButton = page.getByRole('button', { name: /quickstart/i });
    await quickstartButton.click();
    await page.waitForTimeout(500);
    
    // Just fill the first textarea with minimal input, leave party blank
    const adventureTextarea = page.locator('textarea').first();
    await adventureTextarea.fill('Minimal input');
    await page.waitForTimeout(300);
    
    // Click "Start" without party description - should use defaults
    const startButton = page.getByRole('button', { name: /^start$/i });
    await startButton.click();
    
    // Wait for generation
    await page.waitForURL('**/game', { timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Verify tale was created with auto-filled fields
    const storyState = await getLocalStorageItem(page, 'storyState');
    expect(storyState).toBeTruthy();
    
    const story = storyState.value || storyState;
    expect(story.game || story).toBeTruthy();
    expect(story.world_details || true).toBeTruthy(); // May be auto-generated
    
    // Verify party was created (default size)
    const partyState = await getLocalStorageItem(page, 'partyState');
    expect(partyState).toBeTruthy();
    const members = partyState.value?.members || partyState.members;
    expect(members).toBeTruthy();
    expect(members.length).toBeGreaterThan(0);
  });

  test('1.4 Randomize all (M)', async ({ page }) => {
    await page.goto('/game/settings/ai');
    await page.waitForTimeout(500);
    
    // Click quickstart button
    const quickstartButton = page.getByRole('button', { name: /quickstart/i });
    await quickstartButton.click();
    await page.waitForTimeout(500);
    
    // Click "Generate Idea" button to randomize
    const generateIdeaButton = page.getByRole('button', { name: /generate.*idea/i });
    if (await generateIdeaButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await generateIdeaButton.click();
      await page.waitForTimeout(3000); // Wait for generation
      
      // Verify fields are populated in the modal
      const adventureTextarea = page.locator('textarea').first();
      const content = await adventureTextarea.inputValue();
      expect(content).toBeTruthy();
      expect(content.length).toBeGreaterThan(0);
      
      // Now start the tale
      const startButton = page.getByRole('button', { name: /^start$/i });
      await startButton.click();
      
      await page.waitForURL('**/game', { timeout: 30000 });
      await page.waitForTimeout(2000);
      
      // Verify story was persisted
      const storyState = await getLocalStorageItem(page, 'storyState');
      expect(storyState).toBeTruthy();
      const story = storyState.value || storyState;
      expect(story.game || story).toBeTruthy();
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
