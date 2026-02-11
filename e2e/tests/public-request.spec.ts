import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setDemoAuth } from '../helpers/auth';

test.beforeEach(async ({ page }) => {
  await setDemoAuth(page);
});

test.describe('Public Request Form', () => {
  test('submits a request and shows confirmation', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Stateful test runs only on desktop-chrome');

    // Navigate to public form for demo tenant
    await page.goto('/request/demo');
    await expect(page.getByText('Request a Service')).toBeVisible({ timeout: 10000 });

    // Fill in the form
    await page.getByLabel('Your Name').fill('E2E Request User');
    await page.getByLabel('Email').fill('e2e-request@test.com');
    await page.getByLabel('Phone').fill('(555) 888-0001');
    await page.getByLabel('What do you need?').fill('I need weekly lawn mowing for my front and back yard.');

    // Submit
    await page.getByRole('button', { name: 'Submit Request' }).click();

    // Verify confirmation page
    await expect(page.getByText('Request Submitted')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Your service request has been received')).toBeVisible();
  });

  test('request appears in authenticated owner list', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Stateful test runs only on desktop-chrome');

    // Navigate to authenticated requests page
    await page.goto('/requests');
    await expect(page.getByTestId('requests-page')).toBeVisible({ timeout: 10000 });

    // Verify the E2E-submitted request appears (from previous test + seed data)
    await expect(page.getByText('E2E Request User')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('e2e-request@test.com')).toBeVisible();
  });
});

test.describe('Accessibility', () => {
  test('public request form has no critical a11y violations', async ({ page }) => {
    await page.goto('/request/demo');
    await expect(page.getByText('Request a Service')).toBeVisible({ timeout: 10000 });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations.filter((v) => v.impact === 'critical')).toHaveLength(0);
  });
});
