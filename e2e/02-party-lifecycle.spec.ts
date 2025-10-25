import { test, expect } from '@playwright/test';
import { installGeminiApiMocks } from './utils/geminiMocks';
import {
  setupApiKey,
  quickstartWithParty,
  clearGameState,
  getPartyMemberCount,
  getActivePartyMemberName,
  getAllPartyMemberNames,
} from './utils/testHelpers';

test.describe('2. Party Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await clearGameState(page);
    await installGeminiApiMocks(page);
    await setupApiKey(page);
  });

  test('2.1 Manual add/edit (H)', async ({ page }) => {
    await page.goto('/game/new/character');
    await page.waitForTimeout(500);
    
    // Add a party member manually
    const addButton = page.getByRole('button', { name: /add.*member/i });
    await expect(addButton).toBeVisible({ timeout: 5000 });
    await addButton.click();
    await page.waitForTimeout(500);
    
    // Fill in character details
    const nameInput = page.getByRole('textbox').first();
    await nameInput.fill('Test Character');
    await page.waitForTimeout(300);
    
    // Look for character 2 button or similar to click
    const char2Button = page.getByRole('button', { name: /character 2/i });
    await expect(char2Button).toBeVisible({ timeout: 5000 });
    await char2Button.click();
    await page.waitForTimeout(500);
    
    // Verify new member appears in UI
    const testCharButton = page.getByRole('button', { name: /test character/i });
    await expect(testCharButton).toBeVisible({ timeout: 2000 });
  });

  test('2.3 Party size cap (H)', async ({ page }) => {
    await page.goto('/game/new/character');
    await page.waitForTimeout(500);
    
    // Add members up to the cap
    const addButton = page.getByRole('button', { name: /add.*member/i });
    await expect(addButton).toBeVisible({ timeout: 2000 });
    
    // Add 4 members (hitting the cap)
    for (let i = 0; i < 4; i++) {
      await addButton.click();
      await page.waitForTimeout(500);
    }
    
    // Button should now be disabled
    await expect(addButton).toBeDisabled({ timeout: 2000 });
  });

  test('2.4 Delete & re-add (H)', async ({ page }) => {
    await page.goto('/game/new/character');
    await page.waitForTimeout(500);
    
    // Generate party first
    const generatePartyButton = page.getByRole('button', { name: /generate.*party/i });
    await expect(generatePartyButton).toBeVisible({ timeout: 5000 });
    await generatePartyButton.click();
    await page.waitForTimeout(2000);
    
    // Delete a member
    const deleteButton = page.getByRole('button', { name: /delete|remove/i }).first();
    await expect(deleteButton).toBeVisible({ timeout: 5000 });
    await deleteButton.click();
    await page.waitForTimeout(500);
    
    // Confirm deletion if modal appears
    const confirmButton = page.getByRole('button', { name: /confirm|yes/i });
    if (await confirmButton.isVisible({ timeout: 1000 })) {
      await confirmButton.click();
      await page.waitForTimeout(500);
    }
    
    // Add new member
    const addButton = page.getByRole('button', { name: /add.*member/i });
    await expect(addButton).toBeVisible({ timeout: 2000 });
    await addButton.click();
    await page.waitForTimeout(500);
    
    const nameInput = page.getByRole('textbox').first();
    await nameInput.fill('New Character');
    await page.waitForTimeout(300);
    
    // Verify "New Character" appears in UI
    const newCharElement = page.getByText('New Character');
    await expect(newCharElement).toBeVisible({ timeout: 2000 });
  });

  test('2.6 Active member switch (C)', async ({ page }) => {
    // Create party and start tale
    await quickstartWithParty(page);
    await page.waitForTimeout(2000);
    
    // Get initial active member from UI
    const initialActiveName = await getActivePartyMemberName(page);
    expect(initialActiveName).toBeTruthy();
    
    // Get total party count
    const partyCount = await getPartyMemberCount(page);
    expect(partyCount).toBeGreaterThan(1);
    
    // Click on a different party member button to switch
    const partyButtons = await page.locator('.party-switcher button').all();
    if (partyButtons.length > 1) {
      // Click the second party member
      await partyButtons[1].click();
      await page.waitForTimeout(1000);
      
      // Verify active member changed in UI
      const newActiveName = await getActivePartyMemberName(page);
      expect(newActiveName).not.toBe(initialActiveName);
      expect(newActiveName).toBeTruthy();
      
      // Click back to first member
      await partyButtons[0].click();
      await page.waitForTimeout(1000);
      
      // Verify we're back to initial member
      const backToFirstName = await getActivePartyMemberName(page);
      expect(backToFirstName).toBe(initialActiveName);
    }
  });
});
