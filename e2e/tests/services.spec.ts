import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Service Catalog', () => {
  test('creates a service category', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Stateful test runs only on desktop-chrome');

    await page.goto('/services');
    await expect(page.getByTestId('services-page')).toBeVisible({ timeout: 10000 });

    // Click Add Category in the header (first occurrence, not inside empty state)
    await page.getByRole('button', { name: 'Add Category' }).first().click();
    await expect(page.getByTestId('category-form')).toBeVisible();

    // Fill in category form
    await page.getByLabel('Category Name').fill('E2E Test Category');
    await page.getByLabel('Description').fill('Created by E2E test');

    // Click the submit button inside the form
    await page.getByTestId('category-form').getByRole('button', { name: 'Add Category' }).click();

    // Verify category appears
    await expect(page.getByText('E2E Test Category')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Category created')).toBeVisible();
  });

  test('creates a service item in that category', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Stateful test runs only on desktop-chrome');

    await page.goto('/services');
    await expect(page.getByText('E2E Test Category')).toBeVisible({ timeout: 10000 });

    // Find the E2E category section and click Add Service within it
    const categorySection = page.getByTestId('category-section').filter({ hasText: 'E2E Test Category' });
    await categorySection.getByTestId('add-service-btn').click();
    await expect(categorySection.getByTestId('service-item-form')).toBeVisible();

    // Fill in service form
    await page.getByLabel('Service Name').fill('E2E Mowing');
    await page.getByLabel('Price ($)').fill('45.00');
    await page.getByLabel('Unit Type').selectOption('per_visit');
    await page.getByLabel('Est. Duration (minutes)').fill('45');
    await categorySection.getByRole('button', { name: 'Add Service' }).click();

    // Verify service appears in the category section
    await expect(categorySection.getByText('E2E Mowing')).toBeVisible({ timeout: 10000 });
    await expect(categorySection.getByText('$45.00')).toBeVisible();
    await expect(page.getByText('Service added')).toBeVisible();
  });

  test('edits a service item price', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Stateful test runs only on desktop-chrome');

    await page.goto('/services');
    await expect(page.getByText('E2E Mowing')).toBeVisible({ timeout: 10000 });

    // Find the E2E category section and the specific service row
    const categorySection = page.getByTestId('category-section').filter({ hasText: 'E2E Test Category' });
    const serviceRow = categorySection.getByTestId('service-item-row').filter({ hasText: 'E2E Mowing' });

    // Click edit on the service
    await serviceRow.getByRole('button', { name: 'Edit service' }).click();
    await expect(categorySection.getByTestId('service-item-form')).toBeVisible();

    // Update price
    const priceInput = page.getByLabel('Price ($)');
    await priceInput.clear();
    await priceInput.fill('55.00');
    await categorySection.getByRole('button', { name: 'Update' }).click();

    // Verify updated price
    await expect(categorySection.getByText('$55.00')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Service updated')).toBeVisible();
  });

  test('deactivates a service item', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Stateful test runs only on desktop-chrome');

    await page.goto('/services');
    await expect(page.getByText('E2E Mowing')).toBeVisible({ timeout: 10000 });

    // Find the specific service row
    const categorySection = page.getByTestId('category-section').filter({ hasText: 'E2E Test Category' });
    const serviceRow = categorySection.getByTestId('service-item-row').filter({ hasText: 'E2E Mowing' });

    // Set up dialog handler before clicking delete
    page.on('dialog', (dialog) => dialog.accept());

    // Click delete on the specific service
    await serviceRow.getByRole('button', { name: 'Delete service' }).click();

    // Verify service is removed from active list
    await expect(categorySection.getByText('E2E Mowing')).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Service removed')).toBeVisible();
  });
});

test.describe('Mobile viewport', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('services page has no horizontal scroll', async ({ page }) => {
    await page.goto('/services');
    await expect(page.getByTestId('services-page')).toBeVisible({ timeout: 10000 });

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
});

test.describe('Accessibility', () => {
  test('services page has no critical a11y violations', async ({ page }) => {
    await page.goto('/services');
    await expect(page.getByTestId('services-page')).toBeVisible({ timeout: 10000 });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations.filter((v) => v.impact === 'critical')).toHaveLength(0);
  });
});
