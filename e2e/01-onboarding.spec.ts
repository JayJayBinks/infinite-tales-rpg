import { test, expect } from '@playwright/test';
import { installGeminiApiMocks } from './utils/geminiMocks';
import {
  setupApiKey,
  quickstartWithParty,
  clearGameState,
  getPartyMemberCount,
  getActivePartyMemberName,
  isStoryVisible,
  getPartyMemberButtons,
  getAllPartyMemberNames,
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
    
    // Verify we're on the game page
    await expect(page).toHaveURL(/.*\/game$/);
    
    // Verify story content is visible
    const storyVisible = await isStoryVisible(page);
    expect(storyVisible).toBeTruthy();
    
    // Verify party was created with 4 members by counting party switcher buttons
    const partyCount = await getPartyMemberCount(page);
    expect(partyCount).toBe(4);
    
    // Verify we have an active party member
    const activeMemberName = await getActivePartyMemberName(page);
    expect(activeMemberName).toBeTruthy();
    expect(activeMemberName.length).toBeGreaterThan(0);
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
    
    // Verify UI shows party with 2 members
    const partyCount = await getPartyMemberCount(page);
    expect(partyCount).toBe(2);
    
    // Verify story is visible
    const storyVisible = await isStoryVisible(page);
    expect(storyVisible).toBeTruthy();
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
    
    // Verify tale was created - story should be visible
    const storyVisible = await isStoryVisible(page);
    expect(storyVisible).toBeTruthy();
    
    // Verify party was created (default size)
    const partyCount = await getPartyMemberCount(page);
    expect(partyCount).toBeGreaterThan(0);
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
      
      // Verify story is visible
      const storyVisible = await isStoryVisible(page);
      expect(storyVisible).toBeTruthy();
    }
  });

  test('1.6 Save import (C)', async ({ page }) => {
    // Create a complete game state first
    await quickstartWithParty(page);
    await page.waitForTimeout(2000);
    
    // Capture current UI state
    const originalPartyCount = await getPartyMemberCount(page);
    const originalActiveMember = await getActivePartyMemberName(page);
    const originalPartyNames = await getAllPartyMemberNames(page);
    
    expect(originalPartyCount).toBeGreaterThan(0);
    expect(originalActiveMember).toBeTruthy();
    
    // Export current state (we need localStorage for this specific test)
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
    
    // Clear state and verify UI changes
    await clearGameState(page);
    await page.reload();
    await page.goto('/game');
    await page.waitForTimeout(1000);
    
    // Verify party switcher is not visible (no party loaded)
    const partyCountAfterClear = await getPartyMemberCount(page);
    expect(partyCountAfterClear).toBe(0);
    
    // Import saved state
    await page.evaluate((data) => {
      Object.keys(data).forEach(key => {
        localStorage.setItem(key, typeof data[key] === 'string' ? data[key] : JSON.stringify(data[key]));
      });
    }, originalState);
    
    // Reload page to apply changes
    await page.reload();
    await page.goto('/game');
    await page.waitForTimeout(2000);
    
    // Verify UI shows restored state
    const restoredPartyCount = await getPartyMemberCount(page);
    expect(restoredPartyCount).toBe(originalPartyCount);
    
    const restoredActiveMember = await getActivePartyMemberName(page);
    expect(restoredActiveMember).toBe(originalActiveMember);
    
    const restoredPartyNames = await getAllPartyMemberNames(page);
    expect(restoredPartyNames).toEqual(originalPartyNames);
    
    // Verify story is visible again
    const storyVisible = await isStoryVisible(page);
    expect(storyVisible).toBeTruthy();
  });
});
