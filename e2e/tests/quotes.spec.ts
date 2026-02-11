import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setDemoAuth } from '../helpers/auth';

test.beforeEach(async ({ page }) => {
  await setDemoAuth(page);
});

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

test.describe('Create Standalone Quote', () => {
  test('creates a standalone quote via New Quote button', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Stateful test runs only on desktop-chrome');

    // Navigate to quotes page
    await page.goto('/quotes');
    await expect(page.getByTestId('quotes-page')).toBeVisible({ timeout: 10000 });

    // Click "New Quote" button
    await page.getByTestId('new-quote-btn').click();
    await expect(page.getByTestId('create-quote-page')).toBeVisible({ timeout: 10000 });

    // Search for a seeded client
    await page.getByTestId('client-search-input').fill('Bob');

    // Wait for search results and select Bob Wilson
    const clientOption = page.locator('[data-testid^="client-option-"]').filter({ hasText: 'Bob Wilson' });
    await expect(clientOption).toBeVisible({ timeout: 10000 });
    await clientOption.locator('input[type="radio"]').click();

    // Property dropdown should appear with Bob's property
    await expect(page.getByTestId('property-select')).toBeVisible({ timeout: 5000 });
    const propertySelect = page.getByTestId('property-select');
    await propertySelect.selectOption({ index: 1 }); // Select first property (789 Oak Avenue)

    // Title should be auto-suggested
    const titleInput = page.getByTestId('quote-title-input');
    await expect(titleInput).toHaveValue('Quote for Bob Wilson');

    // Customize the title
    await titleInput.fill('Landscaping Quote for Bob Wilson');

    // Submit the form
    await page.getByTestId('create-quote-submit').click();

    // Should redirect to QuoteDetailPage
    await expect(page.getByTestId('quote-detail-page')).toBeVisible({ timeout: 10000 });

    // Verify the quote title is in the title input (draft quotes show an editable input)
    await expect(page.getByTestId('quote-title-input')).toHaveValue('Landscaping Quote for Bob Wilson');
  });

  test('new standalone quote appears in the quotes list', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Depends on previous test creating data');

    await page.goto('/quotes');
    await expect(page.getByTestId('quotes-page')).toBeVisible({ timeout: 10000 });

    // The standalone quote created above should be in the list
    const card = page.getByTestId('quote-card').filter({ hasText: 'Landscaping Quote for Bob Wilson' });
    await expect(card).toBeVisible();
    await expect(card.getByText('Draft')).toBeVisible();
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

  test('create quote page has no critical a11y violations', async ({ page }) => {
    await page.goto('/quotes/new');
    await expect(page.getByTestId('create-quote-page')).toBeVisible({ timeout: 10000 });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations.filter((v) => v.impact === 'critical')).toHaveLength(0);
  });
});
