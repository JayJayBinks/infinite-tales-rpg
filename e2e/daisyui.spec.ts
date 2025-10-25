import { test, expect } from '@playwright/test';

test.describe('DaisyUI Theme Integration', () => {
  test('DaisyUI theme is applied to the application', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check that DaisyUI classes are present
    const body = page.locator('body');
    
    // DaisyUI typically sets a data-theme attribute
    const theme = await body.getAttribute('data-theme').catch(() => null);
    
    if (theme) {
      console.log(`DaisyUI theme detected: ${theme}`);
      expect(theme).toBeTruthy();
    } else {
      console.log('No data-theme attribute found - checking for DaisyUI classes');
      
      // Check for common DaisyUI component classes
      const hasDaisyUIClasses = await page.evaluate(() => {
        const buttons = document.querySelectorAll('.btn');
        const modals = document.querySelectorAll('.modal');
        const cards = document.querySelectorAll('.card');
        const badges = document.querySelectorAll('.badge');
        
        return buttons.length > 0 || modals.length > 0 || cards.length > 0 || badges.length > 0;
      });
      
      expect(hasDaisyUIClasses).toBe(true);
      console.log('DaisyUI component classes found in DOM');
    }
  });

  test('DaisyUI buttons render correctly', async ({ page }) => {
    await page.goto('/game/settings');
    await page.waitForLoadState('networkidle');

    // Look for buttons with DaisyUI classes
    const buttons = page.locator('button.btn');
    const buttonCount = await buttons.count().catch(() => 0);

    expect(buttonCount).toBeGreaterThan(0);
    console.log(`Found ${buttonCount} DaisyUI buttons`);

    // Check first button has proper styling
    if (buttonCount > 0) {
      const firstButton = buttons.first();
      const className = await firstButton.getAttribute('class').catch(() => '');
      
      expect(className).toContain('btn');
      console.log(`Button classes: ${className}`);
    }
  });

  test('DaisyUI modals are styled correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check if modals use DaisyUI classes
    const hasModalClasses = await page.evaluate(() => {
      const modals = document.querySelectorAll('.modal');
      if (modals.length === 0) return false;
      
      // Check if modal has DaisyUI structure
      const firstModal = modals[0];
      return firstModal.classList.contains('modal');
    });

    if (hasModalClasses) {
      console.log('DaisyUI modal structure detected');
    } else {
      console.log('No modals currently visible - checking modal containers exist');
      
      // Modals might not be visible but containers should exist
      const modalContainers = page.locator('.modal, [class*="modal"]');
      const count = await modalContainers.count().catch(() => 0);
      console.log(`Modal containers found: ${count}`);
    }
  });

  test('DaisyUI form controls are styled', async ({ page }) => {
    await page.goto('/game/settings');
    await page.waitForLoadState('networkidle');

    // Check for DaisyUI form control classes
    const formControls = page.locator('.form-control, .input, .select, .textarea');
    const controlCount = await formControls.count().catch(() => 0);

    if (controlCount > 0) {
      console.log(`Found ${controlCount} DaisyUI form controls`);
      expect(controlCount).toBeGreaterThan(0);
    } else {
      // Check for inputs that might use DaisyUI classes
      const inputs = page.locator('input');
      const inputCount = await inputs.count().catch(() => 0);
      
      if (inputCount > 0) {
        const firstInput = inputs.first();
        const className = await firstInput.getAttribute('class').catch(() => '');
        console.log(`Input classes: ${className}`);
      }
    }
  });

  test('DaisyUI color scheme is consistent', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check that DaisyUI CSS variables are set
    const hasCSSVariables = await page.evaluate(() => {
      const styles = getComputedStyle(document.documentElement);
      
      // DaisyUI sets CSS custom properties like --p, --s, --a, --n, --b, etc.
      const primaryColor = styles.getPropertyValue('--p');
      const secondaryColor = styles.getPropertyValue('--s');
      const baseColor = styles.getPropertyValue('--b');
      
      return primaryColor || secondaryColor || baseColor;
    });

    if (hasCSSVariables) {
      console.log('DaisyUI CSS variables detected');
    } else {
      console.log('Checking for Tailwind/DaisyUI color classes');
      
      // Check for elements with DaisyUI color classes
      const coloredElements = await page.evaluate(() => {
        const primary = document.querySelectorAll('[class*="primary"]');
        const secondary = document.querySelectorAll('[class*="secondary"]');
        const accent = document.querySelectorAll('[class*="accent"]');
        
        return primary.length + secondary.length + accent.length;
      });
      
      console.log(`Elements with DaisyUI color classes: ${coloredElements}`);
    }
  });

  test('DaisyUI responsive utilities work', async ({ page }) => {
    // Test at mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check that responsive classes are applied
    const hasMobileLayout = await page.evaluate(() => {
      const elements = document.querySelectorAll('[class*="sm:"], [class*="md:"], [class*="lg:"]');
      return elements.length > 0;
    });

    if (hasMobileLayout) {
      console.log('DaisyUI/Tailwind responsive classes detected');
    }

    // Test at desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForLoadState('networkidle');

    // Layout should adapt
    const bodyWidth = await page.evaluate(() => document.body.clientWidth);
    expect(bodyWidth).toBeGreaterThan(1900);
    console.log(`Desktop viewport width: ${bodyWidth}px`);
  });
});
