import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

function uniqueName(prefix: string) {
  return `${prefix} ${Date.now()}`;
}

test.describe('Signup Flow', () => {
  test('fills form with password, submits, and lands on dashboard', async ({ page }) => {
    const bizName = uniqueName('PW Biz');

    await page.goto('/signup');

    await page.getByLabel('Business Name').fill(bizName);
    await page.getByLabel('Your Email').fill(`pw${Date.now()}@test.com`);
    await page.getByLabel('Your Full Name').fill('PW Tester');
    await page.getByLabel('Password', { exact: true }).fill('test-password-123');
    await page.getByLabel('Confirm Password').fill('test-password-123');

    await page.getByRole('button', { name: 'Create Account' }).click();

    // Verify redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Verify dashboard loaded successfully with data visible.
    await expect(page.getByTestId('tenant-name')).toBeVisible();
    await expect(page.getByTestId('user-name')).toBeVisible();
    await expect(page.getByTestId('user-email')).toBeVisible();
  });
});

test.describe('Mobile viewport', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('signup form is usable with no horizontal scroll', async ({ page }) => {
    await page.goto('/signup');

    // Check no horizontal scroll
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

    // Form is visible and usable
    await expect(page.getByLabel('Business Name')).toBeVisible();
    await expect(page.getByLabel('Your Email')).toBeVisible();
    await expect(page.getByLabel('Your Full Name')).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Confirm Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
  });
});

test.describe('Accessibility', () => {
  test('signup page has no critical a11y violations', async ({ page }) => {
    await page.goto('/signup');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations.filter((v) => v.impact === 'critical')).toHaveLength(0);
  });

  test('dashboard page has no critical a11y violations', async ({ page }) => {
    const bizName = uniqueName('A11y Biz');

    await page.goto('/signup');
    await page.getByLabel('Business Name').fill(bizName);
    await page.getByLabel('Your Email').fill(`a11y${Date.now()}@test.com`);
    await page.getByLabel('Your Full Name').fill('A11y Tester');
    await page.getByLabel('Password', { exact: true }).fill('test-password-123');
    await page.getByLabel('Confirm Password').fill('test-password-123');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations.filter((v) => v.impact === 'critical')).toHaveLength(0);
  });
});
