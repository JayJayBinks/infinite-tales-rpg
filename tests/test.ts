import { expect, test } from '@playwright/test';

test('home page has expected main', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('main')).toBeVisible();
});
