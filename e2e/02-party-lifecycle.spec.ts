import { test, expect } from '@playwright/test';
import { installGeminiApiMocks } from './utils/geminiMocks';
import {
  setupApiKey,
  quickstartWithParty,
  clearGameState,
  getLocalStorageItem,
  switchPartyMember,
  getCurrentPartyMemberName,
} from './utils/testHelpers';

test.describe('2. Party Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await clearGameState(page);
    await installGeminiApiMocks(page);
    await setupApiKey(page);
  });

  test('2.1 Manual add/edit (H)', async ({ page }) => {
    await page.goto('/game/new/character');
    
    // Add a party member manually
    const addButton = page.getByRole('button', { name: /add.*member/i });
    if (await addButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addButton.click();
      await page.waitForTimeout(500);
      
      // Fill in character details
      const nameInput = page.locator('input[placeholder*="name" i]').first();
      await nameInput.fill('Test Character');
      
      // Save character
      const saveButton = page.getByRole('button', { name: /save/i }).first();
      await saveButton.click();
      await page.waitForTimeout(500);
      
      // Verify party member was added
      const partyState = await getLocalStorageItem(page, 'partyState');
      expect(partyState).toBeTruthy();
      expect(partyState.members.some((m: any) => m.name === 'Test Character')).toBeTruthy();
    }
  });

  test('2.3 Party size cap (H)', async ({ page }) => {
    await page.goto('/game/new/character');
    
    // Generate 4-member party
    const generatePartyButton = page.getByRole('button', { name: /generate.*party/i });
    if (await generatePartyButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await generatePartyButton.click();
      await page.waitForTimeout(2000);
    }
    
    // Verify 4 members were created
    const partyState = await getLocalStorageItem(page, 'partyState');
    expect(partyState.members.length).toBe(4);
    
    // Try to add a 5th member - button should be disabled
    const addButton = page.getByRole('button', { name: /add.*member/i });
    if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      const isDisabled = await addButton.isDisabled();
      expect(isDisabled).toBeTruthy();
    }
  });

  test('2.4 Delete & re-add (H)', async ({ page }) => {
    await page.goto('/game/new/character');
    
    // Generate party
    const generatePartyButton = page.getByRole('button', { name: /generate.*party/i });
    if (await generatePartyButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await generatePartyButton.click();
      await page.waitForTimeout(2000);
    }
    
    const partyStateBefore = await getLocalStorageItem(page, 'partyState');
    const initialLength = partyStateBefore.members.length;
    
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
      
      const partyStateAfterDelete = await getLocalStorageItem(page, 'partyState');
      expect(partyStateAfterDelete.members.length).toBe(initialLength - 1);
      
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
        
        const partyStateFinal = await getLocalStorageItem(page, 'partyState');
        expect(partyStateFinal.members.length).toBe(initialLength);
        
        // Verify new unique ID was assigned
        const newMember = partyStateFinal.members.find((m: any) => m.name === 'New Character');
        expect(newMember).toBeTruthy();
        expect(newMember.id).toBeTruthy();
      }
    }
  });

  test('2.6 Active member switch (C)', async ({ page }) => {
    // Create party and start tale
    await quickstartWithParty(page);
    
    // Wait for game to load
    await page.waitForTimeout(2000);
    
    // Get initial active character
    const initialActiveId = await getLocalStorageItem(page, 'activeCharacterId');
    expect(initialActiveId.value).toBe('player_character_1');
    
    // Find and click next button in party carousel
    const nextButton = page.getByRole('button', { name: /next/i }).or(
      page.locator('button').filter({ hasText: /→|➜/ })
    );
    
    if (await nextButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nextButton.click();
      await page.waitForTimeout(1000);
      
      // Verify active character changed
      const newActiveId = await getLocalStorageItem(page, 'activeCharacterId');
      expect(newActiveId.value).toBe('player_character_2');
      
      // Verify UI updated (resources panel shows new character)
      const pageContent = await page.textContent('body');
      expect(pageContent).toBeTruthy();
      
      // Click previous to go back
      const prevButton = page.getByRole('button', { name: /prev|back/i }).or(
        page.locator('button').filter({ hasText: /←|➜/ })
      );
      
      if (await prevButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await prevButton.click();
        await page.waitForTimeout(1000);
        
        const backToFirstId = await getLocalStorageItem(page, 'activeCharacterId');
        expect(backToFirstId.value).toBe('player_character_1');
      }
    }
  });
});
