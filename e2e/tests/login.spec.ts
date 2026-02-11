import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setDemoAuth } from '../helpers/auth';

test.describe('Login Flow', () => {
  test('redirects unauthenticated user from /dashboard to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText('Sign in to your account')).toBeVisible({ timeout: 10000 });
  });

  test('logs in with demo email + password and reaches dashboard', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Stateful login test runs only on desktop-chrome');

    await page.goto('/login');
    await expect(page.getByText('Sign in to your account')).toBeVisible({ timeout: 10000 });

    // Enter demo email
    await page.getByLabel('Email').fill('owner@demo.local');
    await page.getByRole('button', { name: 'Continue' }).click();

    // Single account → auto-select → password step
    await expect(page.getByLabel('Password')).toBeVisible({ timeout: 10000 });
    await page.getByLabel('Password').fill('password');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Dashboard loaded
    await expect(page.getByTestId('tenant-name')).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('shows error for unknown email', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Sign in to your account')).toBeVisible({ timeout: 10000 });

    await page.getByLabel('Email').fill('nobody@nonexistent.com');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByText('No account found for that email')).toBeVisible({ timeout: 10000 });
  });

  test('logout clears auth and redirects to login', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Stateful logout test runs only on desktop-chrome');

    // Manually set localStorage (don't use addInitScript which persists across navigations)
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.setItem('dev_tenant_id', '00000000-0000-0000-0000-000000000001');
      localStorage.setItem('dev_user_id', '00000000-0000-0000-0000-000000000010');
    });
    await page.goto('/dashboard');
    await expect(page.getByTestId('tenant-name')).toBeVisible({ timeout: 10000 });

    // Click logout in sidebar
    await page.getByRole('button', { name: 'Log out' }).click();

    // Should be on login page
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText('Sign in to your account')).toBeVisible({ timeout: 10000 });

    // Verify localStorage was cleared
    const tenantId = await page.evaluate(() => localStorage.getItem('dev_tenant_id'));
    const userId = await page.evaluate(() => localStorage.getItem('dev_user_id'));
    expect(tenantId).toBeNull();
    expect(userId).toBeNull();
  });

  test('shows hint text for demo credentials', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Hint: owner@demo.local / password')).toBeVisible({ timeout: 10000 });
  });

  test('has cross-link to signup', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText("Don't have an account?")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible();
  });
});

test.describe('Login Accessibility', () => {
  test('login page has no critical a11y violations', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Sign in to your account')).toBeVisible({ timeout: 10000 });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations.filter((v) => v.impact === 'critical')).toHaveLength(0);
  });
});
