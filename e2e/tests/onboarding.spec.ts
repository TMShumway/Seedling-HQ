import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Stateful onboarding tests run only on desktop-chrome to avoid cross-project DB state conflicts.
// The wizard creates settings, subsequent tests depend on that state existing.

test.describe('Onboarding — Guided Setup', () => {
  test('completes all 4 wizard steps and lands on dashboard', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Stateful wizard test runs only on desktop-chrome');

    await page.goto('/onboarding');

    // Should see the choice cards (no settings exist for demo tenant)
    await expect(page.getByTestId('setup-choice')).toBeVisible({ timeout: 10000 });

    // Choose guided setup
    await page.getByTestId('guided-setup-card').click();
    await expect(page.getByTestId('onboarding-wizard')).toBeVisible();

    // Step 1: Business Info
    await page.getByLabel('Phone').fill('(555) 111-2222');
    await page.getByLabel('Address', { exact: true }).fill('456 Oak Ave');
    await page.getByLabel('City').fill('Denver');
    await page.getByLabel('State').fill('CO');
    await page.getByLabel('ZIP').fill('80202');
    await page.getByLabel('Time Zone').selectOption('America/Denver');
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 2: Hours (defaults are pre-filled, just proceed)
    await expect(page.getByLabel('Mon open time')).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 3: Service Defaults
    await expect(page.getByLabel('Service Area')).toBeVisible();
    await page.getByLabel('Service Area').fill('Denver metro area');
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 4: Review & Submit
    await expect(page.getByTestId('review-summary')).toBeVisible();
    await expect(page.getByTestId('review-summary')).toContainText('(555) 111-2222');
    await expect(page.getByTestId('review-summary')).toContainText('Denver');
    await page.getByRole('button', { name: 'Complete Setup' }).click();

    // Should land on dashboard with settings saved
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    await expect(page.getByTestId('settings-summary')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Settings Edit', () => {
  test('edits phone from settings page and persists on reload', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Stateful settings test runs only on desktop-chrome');

    // Settings were created by the wizard test above (tests run sequentially)
    await page.goto('/settings');
    await expect(page.getByTestId('settings-form')).toBeVisible({ timeout: 10000 });

    // Update phone
    const phoneInput = page.getByLabel('Phone');
    await phoneInput.clear();
    await phoneInput.fill('(555) 999-8888');

    await page.getByRole('button', { name: 'Save Settings' }).click();

    // Wait for success message
    await expect(page.getByText('Settings saved successfully')).toBeVisible({ timeout: 10000 });

    // Reload and verify persisted
    await page.reload();
    await expect(page.getByLabel('Phone')).toHaveValue('(555) 999-8888', { timeout: 10000 });
  });
});

test.describe('Onboarding — Already Configured', () => {
  test('shows already configured message when settings exist', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Stateful already-configured test runs only on desktop-chrome');

    // Settings exist from previous tests
    await page.goto('/onboarding');
    await expect(page.getByTestId('already-configured')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Mobile viewport', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('settings page has no horizontal scroll', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByTestId('settings-form')).toBeVisible({ timeout: 10000 });

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
});

test.describe('Accessibility', () => {
  test('settings page has no critical a11y violations', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByTestId('settings-form')).toBeVisible({ timeout: 10000 });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations.filter((v) => v.impact === 'critical')).toHaveLength(0);
  });
});
