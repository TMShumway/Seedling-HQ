import { test, expect } from '@playwright/test';
import { setDemoAuth } from '../helpers/auth';

test.beforeEach(async ({ page }) => {
  await setDemoAuth(page);
});

test.describe('Client Timeline', () => {
  test('shows timeline events on Activity tab', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Stateful test runs only on desktop-chrome');

    // Navigate to clients list
    await page.goto('/clients');
    await expect(page.getByTestId('clients-page')).toBeVisible({ timeout: 10000 });

    // Click on John Smith (seeded client)
    await page.getByTestId('client-card').filter({ hasText: 'John Smith' }).click();
    await expect(page.getByTestId('client-detail-page')).toBeVisible({ timeout: 10000 });

    // Click Activity tab
    await page.getByRole('tab', { name: 'Activity' }).click();
    await expect(page.getByTestId('tab-activity')).toBeVisible();

    // Wait for timeline to load
    await expect(page.getByTestId('timeline-list')).toBeVisible({ timeout: 10000 });

    // Verify seeded events are visible
    await expect(page.getByText('Client created')).toBeVisible();
    await expect(page.getByText('Property added')).toBeVisible();
  });

  test('switches between tabs correctly', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Stateful test runs only on desktop-chrome');

    await page.goto('/clients');
    await expect(page.getByTestId('clients-page')).toBeVisible({ timeout: 10000 });

    await page.getByTestId('client-card').filter({ hasText: 'John Smith' }).click();
    await expect(page.getByTestId('client-detail-page')).toBeVisible({ timeout: 10000 });

    // Default tab is Info
    await expect(page.getByTestId('tab-info')).toBeVisible();

    // Switch to Properties
    await page.getByRole('tab', { name: 'Properties' }).click();
    await expect(page.getByTestId('tab-properties')).toBeVisible();
    await expect(page.getByText('123 Main Street')).toBeVisible();

    // Switch to Activity
    await page.getByRole('tab', { name: 'Activity' }).click();
    await expect(page.getByTestId('tab-activity')).toBeVisible();
    await expect(page.getByTestId('timeline-list')).toBeVisible({ timeout: 10000 });

    // Switch back to Info
    await page.getByRole('tab', { name: 'Info' }).click();
    await expect(page.getByTestId('tab-info')).toBeVisible();
  });

  test('hide removals toggle filters events', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Stateful test runs only on desktop-chrome');

    await page.goto('/clients');
    await expect(page.getByTestId('clients-page')).toBeVisible({ timeout: 10000 });

    await page.getByTestId('client-card').filter({ hasText: 'John Smith' }).click();
    await expect(page.getByTestId('client-detail-page')).toBeVisible({ timeout: 10000 });

    await page.getByRole('tab', { name: 'Activity' }).click();
    await expect(page.getByTestId('timeline-list')).toBeVisible({ timeout: 10000 });

    // Toggle hide removals checkbox
    const checkbox = page.getByRole('checkbox');
    await checkbox.check();

    // Timeline should still be visible (seeded data has no deactivation events)
    await expect(page.getByTestId('timeline-list')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Client created')).toBeVisible();
  });
});
