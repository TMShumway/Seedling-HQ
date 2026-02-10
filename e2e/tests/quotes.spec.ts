import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Quotes List', () => {
  test('navigates to quotes page and shows seeded quote', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Asserts exact seed data; later projects see edits');

    await page.goto('/quotes');
    await expect(page.getByTestId('quotes-page')).toBeVisible({ timeout: 10000 });

    // Seeded quote should be visible
    const card = page.getByTestId('quote-card').filter({ hasText: 'Lawn Service for John Smith' });
    await expect(card).toBeVisible();
    await expect(card.getByText('Draft')).toBeVisible();
    await expect(card.getByText('$70.00')).toBeVisible();
  });

  test('clicks through to quote detail and shows line items', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Stateful test depends on seed data before edits');

    await page.goto('/quotes');
    await expect(page.getByTestId('quotes-page')).toBeVisible({ timeout: 10000 });

    // Click the seeded quote
    const card = page.getByTestId('quote-card').filter({ hasText: 'Lawn Service for John Smith' });
    await card.click();

    // Verify quote detail page
    await expect(page.getByTestId('quote-detail-page')).toBeVisible({ timeout: 10000 });

    // Line items should be visible in the line item rows (not in the hidden select options)
    const lineItemRows = page.getByTestId('line-item-row');
    await expect(lineItemRows).toHaveCount(2);
    await expect(lineItemRows.nth(0).getByTestId('line-item-description')).toHaveValue('Weekly Mowing');
    await expect(lineItemRows.nth(1).getByTestId('line-item-description')).toHaveValue('Edging & Trimming');

    // Client info should be visible
    await expect(page.getByText('John Smith')).toBeVisible();
  });

  test('edits line items and saves quote', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Stateful test runs only on desktop-chrome');

    await page.goto('/quotes');
    await expect(page.getByTestId('quotes-page')).toBeVisible({ timeout: 10000 });

    // Click the seeded quote
    const card = page.getByTestId('quote-card').filter({ hasText: 'Lawn Service for John Smith' });
    await card.click();
    await expect(page.getByTestId('quote-detail-page')).toBeVisible({ timeout: 10000 });

    // Add a new line item
    await page.getByTestId('add-line-item').click();

    // Fill in the new line item (it's the last row)
    const rows = page.getByTestId('line-item-row');
    const lastRow = rows.last();
    await lastRow.getByTestId('line-item-description').fill('Aeration Service');
    await lastRow.getByTestId('line-item-quantity').fill('1');
    await lastRow.getByTestId('line-item-unitprice').fill('75');

    // Save
    await page.getByTestId('save-quote').click();
    await expect(page.getByTestId('success-message')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Quotes Accessibility', () => {
  test('quotes list page has no critical a11y violations', async ({ page }) => {
    await page.goto('/quotes');
    await expect(page.getByTestId('quotes-page')).toBeVisible({ timeout: 10000 });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations.filter((v) => v.impact === 'critical')).toHaveLength(0);
  });
});
