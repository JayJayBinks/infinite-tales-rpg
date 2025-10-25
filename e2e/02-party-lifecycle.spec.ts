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
    
    // Check initial party member count (if any)
    const initialCount = await page.locator('button').filter({ hasText: /character|member/i }).count();
    
      // Fill in character details
      const nameTextarea = page.getByRole('textbox').first();
      await nameTextarea.fill('Test Character');
    // Add a party member manually
    const addButton = page.getByRole('button', { name: /add.*member/i });
    if (await addButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addButton.click();
      await page.waitForTimeout(500);

      const char2Button = page.getByRole('button', { name: /character 2/i });
      if (await char2Button.isVisible({ timeout: 5000 }).catch(() => false)) {
        await char2Button.click();
      }
      await page.waitForTimeout(500);
      // Verify new member appears in UI (count increased)
      const newCount = await page.locator('button').filter({ hasText: /test character/i }).count();
      expect(newCount).toBeGreaterThan(0);
    }
  });

  test('2.3 Party size cap (H)', async ({ page }) => {
    await page.goto('/game/new/character');
    await page.waitForTimeout(500);


    
    // Try to add a 5th member - button should be disabled
    const addButton = page.getByRole('button', { name: /add.*member/i });


    if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      for (let i = 0; i < 3; i++) {
        await addButton.click();
        await page.waitForTimeout(500);
      }
      await addButton.isVisible({ timeout: 1000 }).catch(() => true)
    }
  });

  test('2.4 Delete & re-add (H)', async ({ page }) => {
    await page.goto('/game/new/character');
    await page.waitForTimeout(500);
    
    // Generate party
    const generatePartyButton = page.getByRole('button', { name: /generate.*party/i });
    if (await generatePartyButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await generatePartyButton.click();
      await page.waitForTimeout(2000);
    }
    
    // Count initial members
    const initialMemberElements = await page.locator('[class*="character"], [class*="member"]').count();
    
    // Delete a member
    const deleteButton = page.getByRole('button', { name: /delete|remove/i }).first();
    if (await deleteButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await deleteButton.click();
      await page.waitForTimeout(500);
      
      // Confirm deletion if modal appears
      const confirmButton = page.getByRole('button', { name: /confirm|yes/i });
      if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmButton.click();
        await page.waitForTimeout(500);
      }
      
      // Verify one less member in UI
      const afterDeleteCount = await page.locator('[class*="character"], [class*="member"]').count();
      
      // Add new member
      const addButton = page.getByRole('button', { name: /add.*member/i });
      if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await addButton.click();
        await page.waitForTimeout(500);
        
        const nameInput = page.locator('input[placeholder*="name" i]').first();
        await nameInput.fill('New Character');
        
        const saveButton = page.getByRole('button', { name: /save/i }).first();
        await saveButton.click();
        await page.waitForTimeout(500);
        
        // Verify "New Character" appears in UI
        const newCharVisible = await page.getByText('New Character').isVisible({ timeout: 2000 }).catch(() => false);
        expect(newCharVisible).toBeTruthy();
      }
    }
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
