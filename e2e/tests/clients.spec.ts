import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Client Management', () => {
  test('creates a new client', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Stateful test runs only on desktop-chrome');

    await page.goto('/clients');
    await expect(page.getByTestId('clients-page')).toBeVisible({ timeout: 10000 });

    // Click Add Client
    await page.getByRole('button', { name: 'Add Client' }).first().click();
    await expect(page.getByTestId('client-form')).toBeVisible();

    // Fill in client form
    await page.getByLabel('First Name').fill('E2E Test');
    await page.getByLabel('Last Name').fill('Client');
    await page.getByLabel('Email').fill('e2e-client@test.com');
    await page.getByLabel('Phone').fill('(555) 999-0001');
    await page.getByLabel('Company').fill('E2E Corp');
    await page.getByLabel('Tags').fill('test, e2e');

    // Submit
    await page.getByTestId('client-form').getByRole('button', { name: 'Add Client' }).click();

    // Verify client appears
    await expect(page.getByText('Client created')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('E2E Test Client')).toBeVisible();
  });

  test('searches for client', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Stateful test runs only on desktop-chrome');

    await page.goto('/clients');
    await expect(page.getByTestId('clients-page')).toBeVisible({ timeout: 10000 });

    // Search
    await page.getByTestId('client-search').fill('E2E Test');
    await expect(page.getByText('E2E Test Client')).toBeVisible({ timeout: 10000 });
  });

  test('navigates to client detail and adds property', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Stateful test runs only on desktop-chrome');

    await page.goto('/clients');
    await expect(page.getByText('E2E Test Client')).toBeVisible({ timeout: 10000 });

    // Click to navigate to detail
    await page.getByTestId('client-card').filter({ hasText: 'E2E Test Client' }).click();
    await expect(page.getByTestId('client-detail-page')).toBeVisible({ timeout: 10000 });

    // Verify client info
    await expect(page.getByText('e2e-client@test.com')).toBeVisible();
    await expect(page.getByText('(555) 999-0001')).toBeVisible();

    // Add property
    await page.getByRole('button', { name: 'Add Property' }).click();
    await expect(page.getByTestId('property-form')).toBeVisible();

    await page.getByLabel('Address Line 1').fill('999 E2E Street');
    await page.getByLabel('City').fill('Testville');
    await page.getByLabel('State').selectOption('IL');
    await page.getByLabel('ZIP').fill('60000');

    await page.getByTestId('property-form').getByRole('button', { name: 'Add Property' }).click();

    await expect(page.getByText('Property added')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('999 E2E Street')).toBeVisible();
  });

  test('edits client name', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Stateful test runs only on desktop-chrome');

    await page.goto('/clients');
    await expect(page.getByText('E2E Test Client')).toBeVisible({ timeout: 10000 });

    // Navigate to detail
    await page.getByTestId('client-card').filter({ hasText: 'E2E Test Client' }).click();
    await expect(page.getByTestId('client-detail-page')).toBeVisible({ timeout: 10000 });

    // Click Edit (exact match to avoid matching "Edit property" button)
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(page.getByTestId('client-form')).toBeVisible();

    // Update first name
    const firstNameInput = page.getByLabel('First Name');
    await firstNameInput.clear();
    await firstNameInput.fill('E2E Updated');

    await page.getByTestId('client-form').getByRole('button', { name: 'Update' }).click();
    await expect(page.getByText('Client updated')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('E2E Updated Client')).toBeVisible();
  });

  test('deactivates client', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Stateful test runs only on desktop-chrome');

    await page.goto('/clients');
    await expect(page.getByText('E2E Updated Client')).toBeVisible({ timeout: 10000 });

    // Navigate to detail
    await page.getByTestId('client-card').filter({ hasText: 'E2E Updated Client' }).click();
    await expect(page.getByTestId('client-detail-page')).toBeVisible({ timeout: 10000 });

    // Set up dialog handler before clicking delete
    page.on('dialog', (dialog) => dialog.accept());

    // Click Delete (exact match to avoid matching "Delete property" button)
    await page.getByRole('button', { name: 'Delete', exact: true }).click();

    // Should navigate back to clients list
    await expect(page.getByTestId('clients-page')).toBeVisible({ timeout: 10000 });

    // Client should no longer be visible
    await expect(page.getByText('E2E Updated Client')).not.toBeVisible({ timeout: 5000 });
  });
});

test.describe('Mobile viewport', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('clients page has no horizontal scroll', async ({ page }) => {
    await page.goto('/clients');
    await expect(page.getByTestId('clients-page')).toBeVisible({ timeout: 10000 });

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
});

test.describe('Accessibility', () => {
  test('clients page has no critical a11y violations', async ({ page }) => {
    await page.goto('/clients');
    await expect(page.getByTestId('clients-page')).toBeVisible({ timeout: 10000 });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations.filter((v) => v.impact === 'critical')).toHaveLength(0);
  });
});
