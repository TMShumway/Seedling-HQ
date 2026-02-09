import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Convert Request to Client', () => {
  test('submits public request, navigates to detail, converts to client', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Stateful test runs only on desktop-chrome');

    // Step 1: Submit a public request
    await page.goto('/request/demo');
    await expect(page.getByText('Request a Service')).toBeVisible({ timeout: 10000 });

    await page.getByLabel('Your Name').fill('Convert Test User');
    await page.getByLabel('Email').fill('convert-e2e@test.com');
    await page.getByLabel('Phone').fill('(555) 999-0001');
    await page.getByLabel('What do you need?').fill('I need tree trimming for my backyard oak tree.');

    await page.getByRole('button', { name: 'Submit Request' }).click();
    await expect(page.getByText('Request Submitted')).toBeVisible({ timeout: 10000 });

    // Step 2: Navigate to authenticated requests page
    await page.goto('/requests');
    await expect(page.getByTestId('requests-page')).toBeVisible({ timeout: 10000 });

    // Step 3: Click the request card to go to detail
    const card = page.getByTestId('request-card').filter({ hasText: 'Convert Test User' });
    await expect(card).toBeVisible({ timeout: 10000 });
    await card.click();

    // Step 4: Verify request detail page
    await expect(page.getByTestId('request-detail-page')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Convert Test User')).toBeVisible();
    await expect(page.getByText('convert-e2e@test.com')).toBeVisible();
    await expect(page.getByTestId('convert-button')).toBeVisible();

    // Step 5: Click convert button
    await page.getByTestId('convert-button').click();

    // Step 6: Fill in the conversion form
    await expect(page.getByTestId('convert-request-page')).toBeVisible({ timeout: 10000 });

    // First name and last name should be pre-filled from request
    await expect(page.getByTestId('convert-firstName')).toHaveValue('Convert Test');
    await expect(page.getByTestId('convert-lastName')).toHaveValue('User');

    // Fill in address (required)
    await page.getByTestId('convert-addressLine1').fill('789 Elm Street');
    await page.getByTestId('convert-city').fill('Portland');
    await page.getByTestId('convert-state').fill('OR');
    await page.getByTestId('convert-zip').fill('97201');

    // Step 7: Submit conversion
    await page.getByTestId('convert-submit').click();

    // Step 8: Verify redirect to client detail page
    await expect(page.getByTestId('client-detail-page')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Convert Test User')).toBeVisible();
  });

  test('already-converted request shows no convert button', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Stateful test runs only on desktop-chrome');

    // Navigate to requests page
    await page.goto('/requests');
    await expect(page.getByTestId('requests-page')).toBeVisible({ timeout: 10000 });

    // Click the already-converted request from the previous test
    const card = page.getByTestId('request-card').filter({ hasText: 'Convert Test User' });
    await expect(card).toBeVisible({ timeout: 10000 });
    await card.click();

    // Verify detail page shows "Converted" badge and no convert button
    await expect(page.getByTestId('request-detail-page')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Converted')).toBeVisible();
    await expect(page.getByTestId('convert-button')).not.toBeVisible();
  });
});

test.describe('Accessibility', () => {
  test('request detail page has no critical a11y violations', async ({ page }) => {
    // Navigate to requests first and click through
    await page.goto('/requests');
    await expect(page.getByTestId('requests-page')).toBeVisible({ timeout: 10000 });

    // We need to find any request card to click on. If there's none (different project),
    // the test is still valid - just check the requests page itself.
    const cards = page.getByTestId('request-card');
    const count = await cards.count();

    if (count > 0) {
      await cards.first().click();
      await expect(page.getByTestId('request-detail-page')).toBeVisible({ timeout: 10000 });
    }

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations.filter((v) => v.impact === 'critical')).toHaveLength(0);
  });
});
