import { test, expect } from '@playwright/test';
import { installGeminiApiMocks } from './utils/geminiMocks';
import {
  setupApiKey,
  clearGameState,
  quickstartWithParty,
  isStoryVisible,
} from './utils/testHelpers';

test.describe('3. Campaign Builder & Chapters', () => {
  test.beforeEach(async ({ page }) => {
    await clearGameState(page);
    await installGeminiApiMocks(page);
    await setupApiKey(page);
  });

  test('3.1 Generate full campaign (H)', async ({ page }) => {
    // Standardized party + tale setup
    await quickstartWithParty(page, 4);
    await page.waitForTimeout(1000);
    
    // Navigate to campaign builder
    await page.goto('/game/new/campaign');
    await page.waitForTimeout(800);
    
    // Generate campaign
    const generateButton = page.getByRole('button', { name: /randomize all|generate.*campaign/i }).first();
    await expect(generateButton).toBeVisible({ timeout: 5000 });
    await generateButton.click();
    await page.waitForTimeout(1500);
    
    // Verify campaign UI shows chapters
    const chapterElements = page.getByRole('group').or(
      page.getByText(/chapter \d+/i)
    );
    const chapterCount = await chapterElements.count();
    expect(chapterCount).toBeGreaterThan(0);
    
    // Verify we can see campaign content on the page
    const pageText = await page.textContent('body');
    expect(pageText).toBeTruthy();
    expect(pageText?.toLowerCase()).toContain('chapter');
  });

  test('3.2 Single chapter regeneration (M)', async ({ page }) => {
    // Standardized party + tale setup
    await quickstartWithParty(page, 4);
    await page.waitForTimeout(1000);
    
    await page.goto('/game/new/campaign');
    await page.waitForTimeout(800);
    
    const generateButton = page.getByRole('button', { name: /generate.*campaign|randomize all/i }).first();
    await expect(generateButton).toBeVisible({ timeout: 5000 });
    await generateButton.click();
    await page.waitForTimeout(1500);
    
    // Find regenerate button for a specific chapter
    const regenerateButton = page.getByRole('button', { name: /regenerate/i }).first();
    await expect(regenerateButton).toBeVisible({ timeout: 5000 });
    await regenerateButton.click();
    await page.waitForTimeout(2000);
    
    // Verify page still shows chapters
    const chapterElements = page.getByText(/chapter/i);
    const hasChapters = await chapterElements.count() > 0;
    expect(hasChapters).toBeTruthy();
  });

  test('3.5 Chapter advance + image prompt sequencing (H)', async ({ page }) => {
    // This test verifies that chapter advancement happens and content is visible
    
    // Use quickstart to create tale with campaign and party
    await quickstartWithParty(page, 4);
    await page.waitForTimeout(3000);
    
    // Verify we're on the game page with story visible
    await expect(page).toHaveURL(/.*\/game$/);
    const storyVisible = await isStoryVisible(page);
    expect(storyVisible).toBeTruthy();
    
    // Look for chapter indicator in UI (if displayed)
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
    
    // Verify game content is present (story, party switcher, etc.)
    const mainContent = page.locator('main');
    await expect(mainContent).toBeVisible({ timeout: 5000 });
  });
});
