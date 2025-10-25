import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Test helpers for Infinite Tales RPG E2E tests
 */

/**
 * Navigate to the API settings page and save a mock Gemini API key
 */
export async function setupApiKey(page: Page, apiKey: string = 'test-api-key-mock') {
  await page.goto('/game/settings/ai');
  
  // Find and fill the API key input
  const apiKeyInput = page.locator('input[type="password"]').first();
  await apiKeyInput.fill(apiKey);
  
  // Save the key
  const saveButton = page.getByRole('button', { name: /save/i });
  await saveButton.click();
  
  // Wait for success indication (adjust based on actual UI)
  await page.waitForTimeout(500);
}

/**
 * Navigate to quickstart and create a default party
 */
export async function quickstartWithParty(page: Page, partySize: number = 4) {
  await page.goto('/game/new/tale');
  
  // Click quickstart button
  const quickstartButton = page.getByRole('button', { name: /quickstart/i });
  await quickstartButton.click();
  
  // Wait for tale generation
  await page.waitForTimeout(2000);
  
  // Navigate to party creation
  await page.goto('/game/new/character');
  
  // Generate party
  const generatePartyButton = page.getByRole('button', { name: /generate.*party/i });
  if (await generatePartyButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    await generatePartyButton.click();
    await page.waitForTimeout(2000);
  }
  
  // Start tale
  const startButton = page.getByRole('button', { name: /start.*tale/i });
  await startButton.click();
  
  // Wait for game to load
  await page.waitForURL('**/game', { timeout: 10000 });
  await page.waitForTimeout(1000);
}

/**
 * Create a custom tale with specific parameters
 */
export async function createCustomTale(page: Page, options: {
  adventureBlurb?: string;
  partyConcept?: string;
  partySize?: number;
}) {
  await page.goto('/game/new/tale');
  
  if (options.adventureBlurb) {
    const adventureInput = page.locator('textarea').filter({ hasText: /adventure/i }).or(
      page.locator('textarea').nth(0)
    );
    await adventureInput.fill(options.adventureBlurb);
  }
  
  if (options.partyConcept) {
    const partyConceptInput = page.locator('input').filter({ hasText: /party.*concept/i }).or(
      page.locator('input[placeholder*="party"]')
    );
    await partyConceptInput.fill(options.partyConcept);
  }
  
  // Generate tale
  const generateButton = page.getByRole('button', { name: /generate/i });
  await generateButton.click();
  await page.waitForTimeout(2000);
}

/**
 * Wait for streaming story to complete
 */
export async function waitForStoryComplete(page: Page, timeout: number = 15000) {
  // Wait for any loading/streaming indicators to disappear
  await page.waitForTimeout(2000);
  
  // Look for story content to be visible
  const storyContainer = page.locator('[data-testid="story-container"]').or(
    page.locator('main').first()
  );
  await expect(storyContainer).toBeVisible({ timeout });
}

/**
 * Execute a character action
 */
export async function executeAction(page: Page, actionText: string) {
  // Find action input
  const actionInput = page.locator('input[placeholder*="action"]').or(
    page.locator('textarea[placeholder*="action"]')
  );
  
  await actionInput.fill(actionText);
  
  // Submit action
  const submitButton = page.getByRole('button', { name: /submit/i }).or(
    page.getByRole('button', { name: /send/i })
  );
  await submitButton.click();
  
  // Wait for story to update
  await waitForStoryComplete(page);
}

/**
 * Switch to a specific party member
 */
export async function switchPartyMember(page: Page, memberIndex: number) {
  // Find party switcher/carousel
  const nextButton = page.getByRole('button', { name: /next/i }).or(
    page.locator('button').filter({ hasText: '→' })
  );
  
  // Click next button memberIndex times
  for (let i = 0; i < memberIndex; i++) {
    await nextButton.click();
    await page.waitForTimeout(300);
  }
}

/**
 * Get current party member name
 */
export async function getCurrentPartyMemberName(page: Page): Promise<string> {
  const nameElement = page.locator('[data-testid="active-character-name"]').or(
    page.locator('h1').first()
  );
  return await nameElement.textContent() || '';
}

/**
 * Check if element contains text (case-insensitive)
 */
export async function elementContainsText(locator: Locator, text: string): Promise<boolean> {
  const content = await locator.textContent();
  return content ? content.toLowerCase().includes(text.toLowerCase()) : false;
}

/**
 * Clear all localStorage (reset game state)
 */
export async function clearGameState(page: Page) {
  await page.evaluate(() => {
    localStorage.clear();
  });
}

/**
 * Get localStorage value
 */
export async function getLocalStorageItem(page: Page, key: string): Promise<any> {
  return await page.evaluate((k) => {
    const item = localStorage.getItem(k);
    return item ? JSON.parse(item) : null;
  }, key);
}

/**
 * Set localStorage value
 */
export async function setLocalStorageItem(page: Page, key: string, value: any) {
  await page.evaluate(({ k, v }) => {
    localStorage.setItem(k, JSON.stringify(v));
  }, { k: key, v: value });
}

/**
 * Export save game data
 */
export async function exportSaveGame(page: Page): Promise<any> {
  // Navigate to settings or wherever export is
  await page.goto('/game/settings/ai');
  
  // Find and click export button
  const exportButton = page.getByRole('button', { name: /export/i });
  
  if (await exportButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    // Get the exported data before clicking (if it triggers download)
    const saveData = await page.evaluate(() => {
      // Collect all relevant localStorage keys
      const keys = [
        'storyState',
        'campaignState', 
        'currentChapterState',
        'characterState',
        'characterStatsState',
        'partyState',
        'partyStatsState',
        'activeCharacterId',
        'playerCharactersGameState'
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
    
    return saveData;
  }
  
  return null;
}

/**
 * Import save game data
 */
export async function importSaveGame(page: Page, saveData: any) {
  await page.goto('/game/settings/ai');
  
  // Set localStorage directly
  await page.evaluate((data) => {
    Object.keys(data).forEach(key => {
      localStorage.setItem(key, typeof data[key] === 'string' ? data[key] : JSON.stringify(data[key]));
    });
  }, saveData);
  
  // Reload to apply changes
  await page.reload();
}

/**
 * Check if in combat state
 */
export async function isInCombat(page: Page): Promise<boolean> {
  // Look for combat indicator badge or state
  const combatBadge = page.locator('[data-testid="combat-badge"]').or(
    page.getByText(/in combat/i)
  );
  
  return await combatBadge.isVisible({ timeout: 1000 }).catch(() => false);
}

/**
 * Perform short rest
 */
export async function performShortRest(page: Page) {
  const restButton = page.getByRole('button', { name: /short.*rest/i });
  await restButton.click();
  await page.waitForTimeout(1000);
}

/**
 * Perform long rest
 */
export async function performLongRest(page: Page) {
  const restButton = page.getByRole('button', { name: /long.*rest/i });
  await restButton.click();
  await page.waitForTimeout(1000);
}

/**
 * Get resource value for current character
 */
export async function getResourceValue(page: Page, resourceName: string): Promise<number | null> {
  const resourceElement = page.locator(`[data-testid="resource-${resourceName}"]`).or(
    page.getByText(new RegExp(`${resourceName}.*:\\s*\\d+`, 'i'))
  );
  
  if (await resourceElement.isVisible({ timeout: 2000 }).catch(() => false)) {
    const text = await resourceElement.textContent();
    const match = text?.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }
  
  return null;
}

/**
 * Wait for modal to appear
 */
export async function waitForModal(page: Page, modalTitle?: string): Promise<Locator> {
  if (modalTitle) {
    const modal = page.getByRole('dialog').filter({ hasText: modalTitle });
    await expect(modal).toBeVisible({ timeout: 5000 });
    return modal;
  } else {
    const modal = page.getByRole('dialog').first();
    await expect(modal).toBeVisible({ timeout: 5000 });
    return modal;
  }
}

/**
 * Close modal
 */
export async function closeModal(page: Page) {
  const closeButton = page.getByRole('button', { name: /close/i }).or(
    page.locator('button').filter({ hasText: '×' })
  );
  
  if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await closeButton.click();
    await page.waitForTimeout(300);
  }
}
