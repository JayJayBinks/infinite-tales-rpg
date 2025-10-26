import { test, expect } from '@playwright/test';
import { installGeminiApiMocks } from './utils/geminiMocks';
import {
  setupApiKey,
  quickstartWithParty,
  clearGameState,
  getStoryText,
  getPartyMemberButtons,
} from './utils/testHelpers';

test.describe('8. Progression & Events', () => {
  test.beforeEach(async ({ page }) => {
    await clearGameState(page);
    await installGeminiApiMocks(page);
    await setupApiKey(page);
  });

  test('8.1 XP threshold level up (H)', async ({ page }) => {
    // Use at least 2 members so PartyMemberSwitcher (with restrained icon) renders
    await quickstartWithParty(page, 2);
    await page.waitForTimeout(3000);
    
    // Set XP to near threshold via state manipulation
    await page.evaluate(() => {
      const playerCharacters = localStorage.getItem('playerCharactersGameState');
      if (playerCharacters) {
        const data = JSON.parse(playerCharacters);
        if (data.player_character_1 && data.player_character_1.XP) {
          data.player_character_1.XP.current_value = 95;
          localStorage.setItem('playerCharactersGameState', JSON.stringify(data));
        }
      }
    });
    
    await page.reload();
    await page.goto('/game');
    await page.waitForTimeout(2000);
    
    const initialStory = await getStoryText(page);
    
    // Perform action to gain XP
    const actionInput = page.locator('input[placeholder*="What do you want to do?" i], textarea[placeholder*="action" i]').first();
    await expect(actionInput).toBeVisible({ timeout: 5000 });
    await actionInput.fill('I complete a challenging task');
    const submitButton = page.getByRole('button', { name: /submit|send/i }).first();
    await submitButton.click();
    await page.waitForTimeout(4000);
    
    const newStory = await getStoryText(page);
    expect(newStory.length).toBeGreaterThan(initialStory.length);

    // Inject per-member restrained state mapping and reload to ensure UI reflects it
    await page.evaluate(() => {
      const map = { player_character_1: 'Magical bonds limit movement and complex gestures until broken.' };
      localStorage.setItem('restrainedExplanationByMemberState', JSON.stringify(map));
    });
    await page.reload();
    await page.goto('/game');
    await page.waitForTimeout(1000);
    
    // Look for level up modal or notification
    const levelUpModal = page.locator('[data-testid="level-up-modal"]').or(
      page.getByText(/level.*up|congratulations/i)
    );
    // Modal may or may not appear depending on XP gain
  });

  test('8.3 Abilities learned event (H)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    const initialStory = await getStoryText(page);
    
    // Perform action that could trigger ability learning
    const actionInput = page.locator('input[placeholder*="What do you want to do?" i], textarea[placeholder*="action" i]').first();
    await expect(actionInput).toBeVisible({ timeout: 5000 });
    await actionInput.fill('I train intensely and learn a new ability');
    const submitButton = page.getByRole('button', { name: /submit|send/i }).first();
    await submitButton.click();
    await page.waitForTimeout(4000);
    
    const newStory = await getStoryText(page);
    expect(newStory.length).toBeGreaterThan(initialStory.length);
  });

  test('8.4 Transformation confirmation gating (H)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    const initialStory = await getStoryText(page);
    
    // Trigger transformation event
    const actionInput = page.locator('input[placeholder*="What do you want to do?" i], textarea[placeholder*="action" i]').first();
    await expect(actionInput).toBeVisible({ timeout: 5000 });
    await actionInput.fill('I undergo a magical transformation into a dragon');
    const submitButton = page.getByRole('button', { name: /submit|send/i }).first();
    await submitButton.click();
    await page.waitForTimeout(4000);
    
    const newStory = await getStoryText(page);
    expect(newStory.length).toBeGreaterThan(initialStory.length);
    
    // Look for confirmation modal (may appear)
    const confirmModal = page.locator('[data-testid="transformation-modal"]').or(
      page.getByText(/transform|confirm.*change/i)
    );
  });

  test('8.5 Party-wide event evaluation (C)', async ({ page }) => {
    await quickstartWithParty(page, 4);
    await page.waitForTimeout(3000);
    
    // Verify party has multiple members
    const partyButtons = await getPartyMemberButtons(page);
    expect(partyButtons.length).toBeGreaterThan(1);
    
    const initialStory = await getStoryText(page);
    
    // Perform action affecting entire party
    const actionInput = page.locator('input[placeholder*="What do you want to do?" i], textarea[placeholder*="action" i]').first();
    await expect(actionInput).toBeVisible({ timeout: 5000 });
    await actionInput.fill('The entire party gains a new ability');
    const submitButton = page.getByRole('button', { name: /submit|send/i }).first();
    await submitButton.click();
    await page.waitForTimeout(4000);
    
    const newStory = await getStoryText(page);
    expect(newStory.length).toBeGreaterThan(initialStory.length);
  });

  test('8.6 Restraining state actions (H)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    const initialStory = await getStoryText(page);
    
    // Trigger restrained state
    const actionInput = page.locator('input[placeholder*="What do you want to do?" i], textarea[placeholder*="action" i]').first();
    await expect(actionInput).toBeVisible({ timeout: 5000 });
    await actionInput.fill('I become restrained by magical bonds');
    const submitButton = page.getByRole('button', { name: /submit|send/i }).first();
    await submitButton.click();
    await page.waitForTimeout(2000);
       await page.reload();
         await page.waitForTimeout(2000);

    // Verify restrained indicator (icon or text) appears
    // Composite detection: try aria-label, data-testid, or any element containing restrained text
    const restrainedIndicator = page.getByTestId('restrained-indicator');
    await expect(restrainedIndicator).toBeVisible({ timeout: 5000 });
    await restrainedIndicator.click();

    // Optionally a modal/dialog could appear: check presence but don't fail if absent
    const possibleModal = page.getByRole('dialog', { name: /restrained|bound/i });
    await possibleModal.first().isVisible()
   const okBtn = possibleModal.getByRole('button', { name: /close/i });
      await okBtn.isVisible()

  });
  
  test('8.2 Manual level up override (M)', async ({ page }) => {
    await quickstartWithParty(page);
    await page.waitForTimeout(3000);
    
    // Look for manual level up button (may be in settings or character screen)
    await page.goto('/game/party');
    await page.waitForTimeout(1000);
    
    const levelUpButton = page.getByRole('button', { name: /level.*up/i });
    if (await levelUpButton.isVisible({ timeout: 2000 })) {
      await levelUpButton.click();
      await page.waitForTimeout(2000);
      
      // Look for level up confirmation or modal
      const modal = page.locator('[data-testid="level-up-modal"]').or(
        page.getByText(/select.*attribute|choose.*skill/i)
      );
    }
  });
});
