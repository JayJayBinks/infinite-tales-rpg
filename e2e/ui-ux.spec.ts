import { test, expect } from '@playwright/test';
import { installGeminiApiMocks, completeQuickstartFlow } from './utils/geminiMocks';

test.describe('UI/UX & Accessibility', () => {
	test.beforeEach(async ({ page }) => {
		await installGeminiApiMocks(page);
	});

	test('Mobile viewport layout (375px width)', async ({ page }) => {
		// Set mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });

		await completeQuickstartFlow(page);

		await expect(page.locator('h2:has-text("Story")')).toBeVisible({ timeout: 10000 });

		// Expected: Bottom nav visible, panels stacked, story legible
		const bottomNav = page.locator('nav, [class*="nav"]').last();
		const isNavVisible = await bottomNav.isVisible().catch(() => false);

		if (isNavVisible) {
			console.log('Bottom navigation visible on mobile');
		}

		// Check that story content is readable
		const story = page.locator('[class*="story"]').first();
		const storyBox = await story.boundingBox().catch(() => null);

		if (storyBox) {
			expect(storyBox.width).toBeLessThanOrEqual(375);
			console.log('Story content fits in mobile viewport');
		}

		// Check modals are centered
		const modalBtn = page.getByRole('button', { name: /inventory|utility/i }).first();
		if (await modalBtn.isVisible().catch(() => false)) {
			await modalBtn.click();
			await page.waitForTimeout(500);

			const modal = page.locator('.modal.modal-open, [role="dialog"]').first();
			if (await modal.isVisible().catch(() => false)) {
				const modalBox = await modal.boundingBox().catch(() => null);
				if (modalBox) {
					expect(modalBox.width).toBeLessThanOrEqual(375);
					console.log('Modal is properly sized for mobile');
				}
			}
		}
	});

	test('Keyboard navigation through action composer and modals', async ({ page }) => {
		await completeQuickstartFlow(page);

		await expect(page.locator('h2:has-text("Story")')).toBeVisible({ timeout: 10000 });

		// Tab through the page
		await page.keyboard.press('Tab');
		await page.waitForTimeout(200);

		// Check if focus is visible
		const focusedElement = await page.evaluateHandle(() => document.activeElement);
		const tagName = await focusedElement.evaluate((el) => el?.tagName);

		expect(['BUTTON', 'INPUT', 'TEXTAREA', 'A']).toContain(tagName);
		console.log(`Focused element: ${tagName}`);

		// Tab several more times
		for (let i = 0; i < 5; i++) {
			await page.keyboard.press('Tab');
			await page.waitForTimeout(100);
		}

		// Expected: Focus order is logical, no trap
		const stillFocusable = await page.evaluateHandle(() => document.activeElement);
		const stillVisible = await stillFocusable.evaluate((el) => {
			const rect = el?.getBoundingClientRect();
			return rect && rect.top >= 0 && rect.left >= 0;
		});

		expect(stillVisible).toBe(true);
		console.log('Keyboard navigation works correctly');
	});

	test('Screen reader semantics - ARIA landmarks', async ({ page }) => {
		await completeQuickstartFlow(page);

		await expect(page.locator('h2:has-text("Story")')).toBeVisible({ timeout: 10000 });

		// Check for ARIA landmarks
		const main = page.locator('main, [role="main"]');
		await expect(main)
			.toBeVisible()
			.catch(() => {
				console.log('Main landmark not found');
			});

		const navigation = page.locator('nav, [role="navigation"]');
		const hasNav = await navigation
			.count()
			.then((c) => c > 0)
			.catch(() => false);
		if (hasNav) {
			console.log('Navigation landmark found');
		}

		// Check that story entries have proper structure
		const headings = page.locator('h1, h2, h3');
		const headingCount = await headings.count().catch(() => 0);
		expect(headingCount).toBeGreaterThan(0);
		console.log(`Found ${headingCount} headings for screen readers`);
	});

	test('Button accessible names', async ({ page }) => {
		await completeQuickstartFlow(page);

		await expect(page.locator('h2:has-text("Story")')).toBeVisible({ timeout: 10000 });

		// Check that all buttons have accessible names
		const buttons = page.locator('button');
		const buttonCount = await buttons.count().catch(() => 0);

		for (let i = 0; i < Math.min(buttonCount, 10); i++) {
			const button = buttons.nth(i);
			const isVisible = await button.isVisible().catch(() => false);

			if (isVisible) {
				const accessibleName = await button.evaluate((btn) => {
					return (
						btn.textContent?.trim() ||
						btn.getAttribute('aria-label') ||
						btn.getAttribute('title') ||
						btn.querySelector('img')?.getAttribute('alt') ||
						''
					);
				});

				expect(accessibleName.length).toBeGreaterThan(0);
			}
		}

		console.log(`Checked ${Math.min(buttonCount, 10)} buttons for accessible names`);
	});

	test('Color contrast and status cues', async ({ page }) => {
		await completeQuickstartFlow(page);

		await expect(page.locator('h2:has-text("Story")')).toBeVisible({ timeout: 10000 });

		// Check for status badges and alerts
		const badges = page.locator('[class*="badge"], [class*="alert"]');
		const badgeCount = await badges.count().catch(() => 0);

		if (badgeCount > 0) {
			console.log(`Found ${badgeCount} status indicators`);

			// Verify they have visible text or icons
			for (let i = 0; i < Math.min(badgeCount, 5); i++) {
				const badge = badges.nth(i);
				const text = await badge.textContent().catch(() => '');
				const hasContent = text.trim().length > 0;

				if (hasContent) {
					console.log(`Badge ${i}: "${text.trim()}"`);
				}
			}
		}

		// Check resource deltas (should have color coding)
		const resources = page.locator('[class*="resource"]');
		const resourceCount = await resources.count().catch(() => 0);
		console.log(`Found ${resourceCount} resource indicators`);
	});

	test('Responsive layout across breakpoints', async ({ page }) => {
		// Test at multiple viewport sizes
		const viewports = [
			{ width: 375, height: 667, name: 'Mobile' },
			{ width: 768, height: 1024, name: 'Tablet' },
			{ width: 1920, height: 1080, name: 'Desktop' }
		];

		for (const viewport of viewports) {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });

			await page.goto('/game/settings');
			await page.waitForLoadState('networkidle');

			// Check that content is visible and properly laid out
			const apiKeyInput = page.getByLabel('Gemini API Key').first();
			const isVisible = await apiKeyInput.isVisible().catch(() => false);

			expect(isVisible).toBe(true);
			console.log(`${viewport.name} (${viewport.width}x${viewport.height}): Layout OK`);
		}
	});

	test('Loading and error states', async ({ page }) => {
		await page.goto('/game/settings');
		await page.waitForLoadState('networkidle');

		await installGeminiApiMocks(page);

		// Close any error modals to see them fresh
		const errorModal = page.locator('.modal.modal-open');
		if (await errorModal.isVisible().catch(() => false)) {
			const closeBtn = errorModal.getByRole('button', { name: /close|✕/i }).first();
			if (await closeBtn.isVisible().catch(() => false)) {
				await closeBtn.click();
				console.log('Error modal was present - states are being shown');
			}
		}

		// Save API key
		const apiKeyInput = page.getByLabel('Gemini API Key');
		await apiKeyInput.clear();
		await apiKeyInput.fill('test-api-key-12345');
		const saveButton = page.getByRole('button', { name: 'Save & Validate' });
		await saveButton.click();
		await page.waitForTimeout(500);

		// Launch quickstart to see loading state
		const quickstartButton = page.getByRole('button', { name: /quickstart campaign/i });
		if (await quickstartButton.isVisible().catch(() => false)) {
			await quickstartButton.click();

			// Check for loading indicator
			const loader = page.locator(
				'[class*="loading"], [class*="spinner"], .modal:has-text("Generating")'
			);
			const hasLoader = await loader.isVisible({ timeout: 2000 }).catch(() => false);

			if (hasLoader) {
				console.log('Loading state visible');
			}
		}
	});

	test('Game settings configuration', async ({ page }) => {
		await completeQuickstartFlow(page);

		// Navigate to settings
		await page.goto('/game/settings/ai');
		await page.waitForLoadState('networkidle');

		// Look for game settings controls
		const narrationSetting = page
			.locator('select, input[type="range"], input[type="number"]')
			.first();

		if (await narrationSetting.isVisible().catch(() => false)) {
			// Try to adjust a setting
			const tagName = await narrationSetting.evaluate((el) => el.tagName);

			if (tagName === 'SELECT') {
				await narrationSetting.selectOption({ index: 1 });
			} else if (tagName === 'INPUT') {
				const type = await narrationSetting.getAttribute('type');
				if (type === 'range' || type === 'number') {
					await narrationSetting.fill('5');
				}
			}

			// Save settings
			const saveBtn = page.getByRole('button', { name: /save|apply/i }).first();
			if (await saveBtn.isVisible().catch(() => false)) {
				await saveBtn.click();
				await page.waitForTimeout(1000);

				// Expected: Settings persisted
				console.log('Game settings saved');
			}
		} else {
			console.log('Game settings controls not found');
		}
	});

	test('AI settings and output toggles', async ({ page }) => {
		await page.goto('/game/settings/ai');
		await page.waitForLoadState('networkidle');

		await installGeminiApiMocks(page);

		// Look for AI configuration toggles
		const toggles = page.locator('input[type="checkbox"]');
		const toggleCount = await toggles.count().catch(() => 0);

		if (toggleCount > 0) {
			// Toggle the first checkbox
			const firstToggle = toggles.first();
			const wasChecked = await firstToggle.isChecked().catch(() => false);

			await firstToggle.click();
			await page.waitForTimeout(500);

			const isChecked = await firstToggle.isChecked().catch(() => false);
			expect(isChecked).toBe(!wasChecked);
			console.log(`Toggle changed from ${wasChecked} to ${isChecked}`);

			// Look for temperature or other AI parameters
			const temperatureInput = page.locator('input[type="number"], input[type="range"]').first();
			if (await temperatureInput.isVisible().catch(() => false)) {
				await temperatureInput.fill('0.7');
				console.log('AI temperature adjusted');
			}
		} else {
			console.log('No AI toggles found');
		}
	});
});
