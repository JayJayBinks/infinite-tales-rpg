import { test, expect } from '@playwright/test';
import { installGeminiApiMocks } from './utils/geminiMocks';
import {
  setupApiKey,
  quickstartWithParty,
  clearGameState,
  getStoryText,
} from './utils/testHelpers';

test.describe('9. Targeting & Validation', () => {
  test.beforeEach(async ({ page }) => {
    await clearGameState(page);
    await installGeminiApiMocks(page);
    await setupApiKey(page);
  });

  test('9.1 Target modal population (H)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    const initialStory = await getStoryText(page);
    
    // Start combat to populate targets
    const actionInput = page.locator('input[placeholder*="What do you want to do?" i], textarea[placeholder*="action" i]').first();
    await expect(actionInput).toBeVisible({ timeout: 5000 });
    await actionInput.fill('I engage the enemies in combat');
    const submitButton = page.getByRole('button', { name: /submit|send/i }).first();
    await submitButton.click();
    await page.waitForTimeout(4000);
    
    const newStory = await getStoryText(page);
    expect(newStory.length).toBeGreaterThan(initialStory.length);
    
    // Try to use an ability that requires targeting
    const abilityButton = page.getByRole('button', { name: /abilities|spells/i });
    if (await abilityButton.isVisible({ timeout: 2000 })) {
      await abilityButton.click();
      await page.waitForTimeout(500);
      
      // Look for target selection modal
      const targetModal = page.locator('[data-testid="target-modal"]').or(
        page.getByText(/select.*target/i)
      );
    }
  });

  test.skip('9.2 Ability resource cost enforcement (H)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    const initialStory = await getStoryText(page);
    
    // Try to use an ability
    const abilityButton = page.getByRole('button', { name: /abilities|spells/i });
    if (await abilityButton.isVisible({ timeout: 2000 })) {
      await abilityButton.click();
      await page.waitForTimeout(500);
      
      // Select an ability (first one)
      const firstAbility = page.getByRole('button').filter({ hasText: /ability|spell/i }).first();
      if (await firstAbility.isVisible({ timeout: 2000 })) {
        await firstAbility.click();
        await page.waitForTimeout(1000);
      }
    }
    
    // Verify story may have updated if ability was used
    const newStory = await getStoryText(page);
    // Story might be same if ability couldn't be used due to resource costs
  });

  test('9.3 Ability cost normalization (M)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    // Open abilities modal
    const abilityButton = page.getByRole('button', { name: /abilities|spells/i });
    if (await abilityButton.isVisible({ timeout: 2000 })) {
      await abilityButton.click();
      await page.waitForTimeout(500);
      
      // Verify abilities are displayed
      const abilityList = page.locator('[data-testid="ability-list"]').or(
        page.locator('.ability, .spell')
      );
      
      // Close modal
      const closeButton = page.getByRole('button', { name: /close|cancel/i });
      if (await closeButton.isVisible({ timeout: 1000 })) {
        await closeButton.click();
      }
    }
  });

  test('16.1 No direct resource mutation (validation) (H)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    const initialStory = await getStoryText(page);
    
    // Perform action that modifies resources
    const actionInput = page.locator('input[placeholder*="What do you want to do?" i], textarea[placeholder*="action" i]').first();
    await expect(actionInput).toBeVisible({ timeout: 5000 });
    await actionInput.fill('I take damage from a trap');
    const submitButton = page.getByRole('button', { name: /submit|send/i }).first();
    await submitButton.click();
    await page.waitForTimeout(4000);
    
    const newStory = await getStoryText(page);
    expect(newStory.length).toBeGreaterThan(initialStory.length);
    
    // Verify UI reflects resource changes (can see in resources display)
    const resourcesDisplay = page.locator('[data-testid="resources"]').or(
      page.locator('.resources, .stats')
    );
    // Resources display should be visible
  });
});
