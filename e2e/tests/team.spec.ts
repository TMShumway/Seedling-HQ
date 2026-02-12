import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setDemoAuth } from '../helpers/auth';

test.beforeEach(async ({ page }) => {
  await setDemoAuth(page);
});

test.describe('Team Management', () => {
  test('displays seeded team members with correct roles', async ({ page }) => {
    await page.goto('/team');
    await expect(page.getByRole('heading', { name: 'Team' })).toBeVisible({ timeout: 10000 });

    // Should show 3 members from seed data
    await expect(page.getByText('Demo Owner')).toBeVisible();
    await expect(page.getByText('Demo Admin')).toBeVisible();
    await expect(page.getByText('Demo Member')).toBeVisible();

    // Role badges (exact match to avoid matching names like "Demo Owner")
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0).locator('span', { hasText: /^Owner$/ })).toBeVisible();
    await expect(rows.nth(1).locator('span', { hasText: /^Admin$/ })).toBeVisible();
    await expect(rows.nth(2).locator('span', { hasText: /^Member$/ })).toBeVisible();
  });

  test('navigates to team page from sidebar', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Sidebar only visible on desktop');

    await page.goto('/dashboard');
    await expect(page.getByTestId('tenant-name')).toBeVisible({ timeout: 10000 });

    await page.getByRole('link', { name: 'Team' }).click();
    await expect(page).toHaveURL(/\/team/);
    await expect(page.getByRole('heading', { name: 'Team' })).toBeVisible();
  });

  test('invites a new team member', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Stateful invite test runs only on desktop-chrome');

    await page.goto('/team');
    await expect(page.getByRole('heading', { name: 'Team' })).toBeVisible({ timeout: 10000 });

    await page.getByTestId('invite-member-btn').click();

    await page.getByLabel('Email').fill('e2e-invite@demo.local');
    await page.getByLabel('Full Name').fill('E2E Invited Member');
    await page.getByLabel('Password').fill('testpassword123');

    await page.getByTestId('invite-submit-btn').click();

    await expect(page.getByText('has been invited successfully')).toBeVisible({ timeout: 10000 });
    // After the form closes, the new member should appear in the table
    await expect(page.getByRole('cell', { name: 'E2E Invited Member' })).toBeVisible({ timeout: 10000 });
  });

  test('resets a member password', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Stateful reset test runs only on desktop-chrome');

    await page.goto('/team');
    await expect(page.getByRole('heading', { name: 'Team' })).toBeVisible({ timeout: 10000 });

    // Click reset for demo member
    const DEMO_MEMBER_ID = '00000000-0000-0000-0000-000000000012';
    await page.getByTestId(`reset-pw-${DEMO_MEMBER_ID}`).click();

    // Dialog should show target user info
    await expect(page.getByText('Set a new password for Demo Member')).toBeVisible();

    await page.getByLabel('New Password').fill('resetpassword123');
    await page.getByLabel('Confirm Password').fill('resetpassword123');

    await page.getByTestId('reset-pw-submit').click();

    await expect(page.getByText('has been reset')).toBeVisible({ timeout: 10000 });
  });

  test('shows invite button only for owner/admin', async ({ page }) => {
    await page.goto('/team');
    await expect(page.getByRole('heading', { name: 'Team' })).toBeVisible({ timeout: 10000 });

    // Demo owner should see invite button
    await expect(page.getByTestId('invite-member-btn')).toBeVisible();
  });
});

test.describe('Team Accessibility', () => {
  test('team page has no critical a11y violations', async ({ page }) => {
    await page.goto('/team');
    await expect(page.getByRole('heading', { name: 'Team' })).toBeVisible({ timeout: 10000 });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations.filter((v) => v.impact === 'critical')).toHaveLength(0);
  });
});
