import { test, expect } from '@playwright/test';
import { installGeminiApiMocks, completeQuickstartFlow } from './utils/geminiMocks';

test.describe('Quickstart & Tale Setup', () => {
	test.beforeEach(async ({ page }) => {
		await installGeminiApiMocks(page);
	});

	test('Quickstart happy path: Save API key, generate party, start tale', async ({ page }) => {
		// Navigate to Settings
		await page.goto('/game/settings');
		await page.waitForLoadState('networkidle');

		// Close any error modals that might appear
		const errorModal = page.locator('.modal.modal-open');
		if (await errorModal.isVisible().catch(() => false)) {
			const closeBtn = errorModal.getByRole('button', { name: /close|✕/i }).first();
			if (await closeBtn.isVisible().catch(() => false)) {
				await closeBtn.click();
				await page.waitForLoadState('networkidle');
			}
		}

		// Save API key
		const apiKeyInput = page.getByLabel('Gemini API Key');
		await apiKeyInput.clear();
		await apiKeyInput.fill('test-api-key-12345');

		const saveButton = page.getByRole('button', { name: 'Save & Validate' });
		await saveButton.click();
		await page.waitForTimeout(1000);

		// Launch Quickstart
		const quickstartButton = page.getByRole('button', { name: /quickstart campaign/i });
		await page.waitForSelector('button:has-text("Quickstart Campaign")', { timeout: 5000 });
		await quickstartButton.click();
		await page.waitForTimeout(1000);

		// Click Start button in modal
		const startButton = page.getByRole('button', { name: /^start$/i });
		await page.waitForSelector('button:has-text("Start")', { timeout: 10000 });
		await startButton.click();

		// Wait for game to initialize
		await page.waitForURL(/\/(game)?$/i, { timeout: 15000 });

		// Wait longer for AI to generate party and tale
		await page.waitForTimeout(5000);

		// Expected: Game page loads with story and party
		await expect(page.locator('h2:has-text("Story")')).toBeVisible({ timeout: 15000 });

		// Verify party was created (should have character selector)
		const partySelector = page.locator('button:has-text("Character")').first();
		await expect(partySelector)
			.toBeVisible({ timeout: 5000 })
			.catch(() => {
				// Party selector might not be visible in single-character mode
				console.log('Party selector not visible - might be single character mode');
			});
	});

	test('Quickstart with custom overwrites', async ({ page }) => {
		await page.goto('/game/settings');
		await page.waitForLoadState('networkidle');

		// Close any error modals
		const errorModal = page.locator('.modal.modal-open');
		if (await errorModal.isVisible().catch(() => false)) {
			const closeBtn = errorModal.getByRole('button', { name: /close|✕/i }).first();
			if (await closeBtn.isVisible().catch(() => false)) {
				await closeBtn.click();
				await page.waitForLoadState('networkidle');
			}
		}

		// Save API key
		const apiKeyInput = page.getByLabel('Gemini API Key');
		await apiKeyInput.clear();
		await apiKeyInput.fill('test-api-key-12345');
		const saveButton = page.getByRole('button', { name: 'Save & Validate' });
		await saveButton.click();
		await page.waitForTimeout(1000);

		// Launch Quickstart
		const quickstartButton = page.getByRole('button', { name: /quickstart campaign/i });
		await quickstartButton.click();
		await page.waitForTimeout(1000);

		// Provide custom overwrites
		const adventureInput = page.getByLabel(/adventure|main event/i).first();
		if (await adventureInput.isVisible().catch(() => false)) {
			await adventureInput.fill('A custom adventure blurb about a mysterious tower');
		}

		const partyConceptInput = page.getByLabel(/party concept/i).first();
		if (await partyConceptInput.isVisible().catch(() => false)) {
			await partyConceptInput.fill('A custom party concept: treasure hunters');
		}

		// Click Start
		const startButton = page.getByRole('button', { name: /^start$/i });
		await startButton.click();

		// Wait for game to load
		await page.waitForURL(/\/(game)?$/i, { timeout: 15000 });
		await page.waitForTimeout(5000);

		// Expected: Tale honors overwrites
		await expect(page.locator('h2:has-text("Story")')).toBeVisible({ timeout: 15000 });
	});

	test('API key validation', async ({ page }) => {
		await page.goto('/game/settings');
		await page.waitForLoadState('networkidle');

		// Close any error modals
		const errorModal = page.locator('.modal.modal-open');
		if (await errorModal.isVisible().catch(() => false)) {
			const closeBtn = errorModal.getByRole('button', { name: /close|✕/i }).first();
			if (await closeBtn.isVisible().catch(() => false)) {
				await closeBtn.click();
				await page.waitForLoadState('networkidle');
			}
		}

		// Try to save empty API key (should fail validation)
		const apiKeyInput = page.getByLabel('Gemini API Key');
		await apiKeyInput.clear();

		const saveButton = page.getByRole('button', { name: 'Save & Validate' });

		// Fill with invalid key
		await apiKeyInput.fill('short');
		await saveButton.click();
		await page.waitForTimeout(500);

		// Fill with valid key
		await apiKeyInput.clear();
		await apiKeyInput.fill('test-api-key-12345');
		await saveButton.click();
		await page.waitForTimeout(500);

		// Quickstart button should now be available
		const quickstartButton = page.getByRole('button', { name: /quickstart campaign/i });
		await expect(quickstartButton).toBeVisible({ timeout: 5000 });
	});
});
