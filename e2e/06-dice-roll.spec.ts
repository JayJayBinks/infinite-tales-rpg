import { test, expect } from '@playwright/test';
import { installGeminiApiMocks } from './utils/geminiMocks';
import { setupApiKey, quickstartWithParty, clearGameState, getStoryText } from './utils/testHelpers';

test.describe('6. Dice Roll Flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearGameState(page);
    await installGeminiApiMocks(page);
    await setupApiKey(page);
  });

  test('6.1 Action requiring dice roll opens modal, rolls, and continues (H)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);

    // Choose an action that (via mocks) requires a dice roll: 'Investigate the area carefully'
    const investigateButton = page.getByRole('button', { name: /Investigate the area carefully/i });
    await expect(investigateButton).toBeVisible({ timeout: 5000 });
    await investigateButton.click();

    // Dice roll dialog should appear
    const diceDialog = page.locator('#dice-rolling-dialog');
    await expect(diceDialog).toBeVisible({ timeout: 5000 });

    // Verify key modifier outputs exist and contain expected content from mock action
    await expect(page.locator('#dice-roll-difficulty')).toBeVisible();
    await expect(page.locator('#attribute-modifier')).toContainText(/Wisdom/i);
    await expect(page.locator('#skill-modifier')).toContainText(/Perception/i);
    await expect(page.locator('#modifier-reason')).toContainText(/Standard conditions apply/i);
    await expect(page.locator('#dice-roll-result')).toContainText('?');

    // Roll the dice
    const rollButton = page.locator('#roll-dice-button');
    await expect(rollButton).toBeEnabled();
    await rollButton.click();

    // Wait until the continue button becomes enabled (indicates roll finished)
    const continueButton = page.locator('#dice-rolling-dialog-continue');
    await expect(continueButton).toBeEnabled({ timeout: 15000 });

    // Then ensure the result shows a rolled value (no '?')
    await expect(page.locator('#dice-roll-result')).not.toContainText('?');

    // Continue after roll
    await continueButton.click();

    // Verify result format (e.g., "14  + 2 = 16")
    const finalResult = await page.locator('#dice-roll-result').innerText();
    expect(finalResult).toMatch(/\d+\s+\+\s+[+-]?\d+\s+=\s+\d+/);

    // Story should still be accessible (no requirement that modal auto-closes in mock environment)
    const story = await getStoryText(page);
    expect(story.length).toBeGreaterThan(0);
  });
});
