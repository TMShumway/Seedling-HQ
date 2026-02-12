import { test, expect } from '@playwright/test';
import { setDemoAuth } from '../helpers/auth';

test.beforeEach(async ({ page }) => {
  await setDemoAuth(page);
});

test.describe('Change Password', () => {
  test('shows change password form on settings page', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Business Settings' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('change-pw-submit')).toBeVisible();
    await expect(page.getByLabel('Current Password')).toBeVisible();
    await expect(page.getByLabel('New Password', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Confirm New Password')).toBeVisible();
  });

  test('changes password successfully and reverts', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Stateful test runs only on desktop-chrome');

    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Business Settings' })).toBeVisible({ timeout: 10000 });

    // Change to a new password
    await page.getByLabel('Current Password').fill('password');
    await page.getByLabel('New Password', { exact: true }).fill('newpassword123');
    await page.getByLabel('Confirm New Password').fill('newpassword123');
    await page.getByTestId('change-pw-submit').click();

    await expect(page.getByText('Password changed successfully')).toBeVisible({ timeout: 10000 });

    // Revert back to the original password so other tests aren't affected
    await page.getByLabel('Current Password').fill('newpassword123');
    await page.getByLabel('New Password', { exact: true }).fill('password');
    await page.getByLabel('Confirm New Password').fill('password');
    await page.getByTestId('change-pw-submit').click();

    await expect(page.getByText('Password changed successfully')).toBeVisible({ timeout: 10000 });
  });

  test('shows error for wrong current password', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Stateful test runs only on desktop-chrome');

    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Business Settings' })).toBeVisible({ timeout: 10000 });

    await page.getByLabel('Current Password').fill('wrongpassword');
    await page.getByLabel('New Password', { exact: true }).fill('newpassword123');
    await page.getByLabel('Confirm New Password').fill('newpassword123');
    await page.getByTestId('change-pw-submit').click();

    await expect(page.getByText('Current password is incorrect')).toBeVisible({ timeout: 10000 });
  });
});
