import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const KNOWN_RAW_TOKEN = 'e2e-test-quote-token';

test.describe('Send Quote', () => {
  test('sends draft quote and shows link card', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Stateful test runs only on desktop-chrome');

    await page.goto('/quotes');
    await expect(page.getByTestId('quotes-page')).toBeVisible({ timeout: 10000 });

    // Click the seeded draft quote
    const card = page.getByTestId('quote-card').filter({ hasText: 'Lawn Service for John Smith' });
    await card.click();
    await expect(page.getByTestId('quote-detail-page')).toBeVisible({ timeout: 10000 });

    // Send button should be visible (draft + has line items)
    await expect(page.getByTestId('send-quote-btn')).toBeVisible();

    // Click send
    await page.getByTestId('send-quote-btn').click();

    // Confirmation card should appear
    await expect(page.getByText('Send this quote to the client?')).toBeVisible();

    // Confirm send
    await page.getByRole('button', { name: 'Yes, Send Quote' }).click();

    // Wait for success message and link card
    await expect(page.getByTestId('success-message')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('quote-link-card')).toBeVisible();
    await expect(page.getByTestId('copy-link-btn')).toBeVisible();

    // Quote status should now be "Sent"
    await expect(page.getByText('Sent', { exact: true })).toBeVisible();

    // Edit controls should be gone (no Save button, no Send button)
    await expect(page.getByTestId('save-quote')).not.toBeVisible();
    await expect(page.getByTestId('send-quote-btn')).not.toBeVisible();
  });

  test('sent quote card shows Sent status in list', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Depends on previous send test');

    await page.goto('/quotes');
    await expect(page.getByTestId('quotes-page')).toBeVisible({ timeout: 10000 });

    // The seeded sent quote should show as Sent
    const sentCard = page.getByTestId('quote-card').filter({ hasText: 'Tree Service for Jane Johnson' });
    await expect(sentCard).toBeVisible();
    await expect(sentCard.getByText('Sent')).toBeVisible();
  });
});

test.describe('Public Quote View', () => {
  test('displays quote data for valid token', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Uses seeded token data');

    await page.goto(`/quote/${KNOWN_RAW_TOKEN}`);
    await expect(page.getByTestId('public-quote-view')).toBeVisible({ timeout: 10000 });

    // Business name
    await expect(page.getByText('Demo Business')).toBeVisible();

    // Client name
    await expect(page.getByText('Prepared for: Jane Johnson')).toBeVisible();

    // Line items
    await expect(page.getByText('Tree Trimming')).toBeVisible();
    await expect(page.getByText('Tree Removal')).toBeVisible();

    // Total
    await expect(page.getByText('$720.00')).toBeVisible();
  });

  test('shows error for invalid token', async ({ page }) => {
    await page.goto('/quote/invalid-token-that-does-not-exist');
    await expect(page.getByTestId('public-quote-view')).toBeVisible({ timeout: 10000 });

    // Should show error message
    await expect(page.getByText('This link is no longer valid.')).toBeVisible();
    await expect(page.getByText('Please contact the business for an updated link.')).toBeVisible();
  });
});

test.describe('Public Quote View Accessibility', () => {
  test('public quote view has no critical a11y violations', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Uses seeded token data');

    await page.goto(`/quote/${KNOWN_RAW_TOKEN}`);
    await expect(page.getByTestId('public-quote-view')).toBeVisible({ timeout: 10000 });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations.filter((v) => v.impact === 'critical')).toHaveLength(0);
  });
});
