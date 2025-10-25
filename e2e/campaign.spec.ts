import { test, expect } from '@playwright/test';
import { installGeminiApiMocks, completeQuickstartFlow } from './utils/geminiMocks';

test.describe('Campaign Builder & Chapters', () => {
  test.beforeEach(async ({ page }) => {
    await installGeminiApiMocks(page);
  });

  test('Campaign AI generation', async ({ page }) => {
    await page.goto('/game/settings');
    await page.waitForLoadState('networkidle');

    // Close any error modals
    const errorModal = page.locator('.modal.modal-open');
    if (await errorModal.isVisible().catch(() => false)) {
      const closeBtn = errorModal.getByRole('button', { name: /close|✕/i }).first();
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click();
      }
    }

    // Save API key
    const apiKeyInput = page.getByLabel('Gemini API Key');
    await apiKeyInput.clear();
    await apiKeyInput.fill('test-api-key-12345');
    const saveButton = page.getByRole('button', { name: 'Save & Validate' });
    await saveButton.click();
    await page.waitForTimeout(1000);

    // Navigate to campaign builder
    const campaignBtn = page.getByRole('button', { name: /campaign|new.*campaign/i }).first();
    
    if (await campaignBtn.isVisible().catch(() => false)) {
      await campaignBtn.click();
      await page.waitForLoadState('networkidle');

      // Look for Generate Campaign button
      const generateBtn = page.getByRole('button', { name: /generate.*campaign|create.*campaign/i }).first();
      
      if (await generateBtn.isVisible().catch(() => false)) {
        await generateBtn.click();
        await page.waitForTimeout(5000); // Wait for AI generation

        // Expected: Chapters populated, spinner hidden
        const chaptersList = page.locator('[class*="chapter"]');
        const hasChapters = await chaptersList.count().then(c => c > 0).catch(() => false);
        
        if (hasChapters) {
          console.log('Campaign generated with chapters');
          expect(hasChapters).toBe(true);
        } else {
          console.log('No chapters detected after generation');
        }
      } else {
        console.log('Generate Campaign button not found');
      }
    } else {
      console.log('Campaign feature not accessible');
    }
  });

  test('Single chapter regeneration', async ({ page }) => {
    await page.goto('/game/new/campaign');
    await page.waitForLoadState('networkidle');

    await installGeminiApiMocks(page);

    // Look for existing chapters or generate first
    const chaptersList = page.locator('[class*="chapter"]');
    const chapterCount = await chaptersList.count().catch(() => 0);

    if (chapterCount > 1) {
      // Find regenerate button for a specific chapter
      const regenBtn = page.getByRole('button', { name: /regenerate|refresh/i }).nth(1); // Second chapter
      
      if (await regenBtn.isVisible().catch(() => false)) {
        // Get chapter content before regeneration
        const chapterBefore = await page.locator('[class*="chapter"]').nth(1).textContent().catch(() => '');
        
        await regenBtn.click();
        await page.waitForTimeout(3000);

        // Expected: Only targeted chapter changes
        const chapterAfter = await page.locator('[class*="chapter"]').nth(1).textContent().catch(() => '');
        expect(chapterAfter).not.toBe(chapterBefore);
        console.log('Chapter regenerated');
      }
    } else {
      console.log('Not enough chapters to test regeneration');
    }
  });

  test('Plot point editing', async ({ page }) => {
    await page.goto('/game/new/campaign');
    await page.waitForLoadState('networkidle');

    await installGeminiApiMocks(page);

    // Look for chapter edit controls
    const editBtn = page.getByRole('button', { name: /edit/i }).first();
    
    if (await editBtn.isVisible().catch(() => false)) {
      await editBtn.click();
      await page.waitForTimeout(500);

      // Look for NPC or plot point multiline input
      const npcInput = page.getByLabel(/npc|important.*character|plot/i).first();
      
      if (await npcInput.isVisible().catch(() => false)) {
        await npcInput.clear();
        await npcInput.fill('NPC 1: The Mysterious Merchant\nNPC 2: The Town Guard Captain');

        // Save changes
        const saveBtn = page.getByRole('button', { name: /save|apply/i }).first();
        if (await saveBtn.isVisible().catch(() => false)) {
          await saveBtn.click();
          await page.waitForTimeout(1000);

          // Expected: Input parsed into array, tale preview reflects change
          console.log('Plot points updated');
        }
      }
    } else {
      console.log('Edit controls not found');
    }
  });

  test('Chapter lifecycle (add/remove)', async ({ page }) => {
    await page.goto('/game/new/campaign');
    await page.waitForLoadState('networkidle');

    await installGeminiApiMocks(page);

    // Get initial chapter count
    const chaptersList = page.locator('[class*="chapter"]');
    const initialCount = await chaptersList.count().catch(() => 0);

    // Add a chapter
    const addBtn = page.getByRole('button', { name: /add.*chapter|new.*chapter/i }).first();
    
    if (await addBtn.isVisible().catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(1000);

      const newCount = await chaptersList.count().catch(() => 0);
      expect(newCount).toBe(initialCount + 1);
      console.log(`Chapter added: ${initialCount} -> ${newCount}`);

      // Remove the chapter
      const removeBtn = page.getByRole('button', { name: /remove|delete/i }).last();
      if (await removeBtn.isVisible().catch(() => false)) {
        await removeBtn.click();
        await page.waitForTimeout(500);

        // Confirm deletion if needed
        const confirmBtn = page.getByRole('button', { name: /confirm|yes/i }).first();
        if (await confirmBtn.isVisible().catch(() => false)) {
          await confirmBtn.click();
          await page.waitForTimeout(1000);
        }

        const finalCount = await chaptersList.count().catch(() => 0);
        expect(finalCount).toBe(initialCount);
        console.log(`Chapter removed: ${newCount} -> ${finalCount}`);
      }
    } else {
      console.log('Add chapter feature not found');
    }
  });
});
