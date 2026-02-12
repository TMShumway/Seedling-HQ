import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setDemoAuth } from '../helpers/auth';

test.beforeEach(async ({ page }) => {
  await setDemoAuth(page);
});

test.describe('Jobs List', () => {
  test('navigates to jobs page and shows seeded job', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Asserts exact seed data; later projects see edits');

    await page.goto('/jobs');
    await expect(page.getByTestId('jobs-page')).toBeVisible({ timeout: 10000 });

    // Seeded job should be visible
    const card = page.getByTestId('job-card').filter({ hasText: 'Tree Trimming for Jane Johnson' });
    await expect(card).toBeVisible();
    await expect(card.getByText('Scheduled')).toBeVisible();
  });

  test('filters jobs by status', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Stateful test depends on seed data');

    await page.goto('/jobs');
    await expect(page.getByTestId('jobs-page')).toBeVisible({ timeout: 10000 });

    // Click Scheduled filter pill — scope to the filter bar to avoid matching job card's role="button"
    const filterBar = page.locator('.flex.flex-wrap.gap-2');
    await filterBar.getByRole('button', { name: 'Scheduled' }).click();
    await expect(page.getByTestId('job-card')).toHaveCount(2);

    // Click Completed filter — should show empty state
    await filterBar.getByRole('button', { name: 'Completed' }).click();
    await expect(page.getByTestId('empty-state')).toBeVisible();

    // Click All to reset
    await filterBar.getByRole('button', { name: 'All' }).click();
    await expect(page.getByTestId('job-card')).toHaveCount(2);
  });

  test('clicks through to job detail and shows visit', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Stateful test depends on seed data');

    await page.goto('/jobs');
    await expect(page.getByTestId('jobs-page')).toBeVisible({ timeout: 10000 });

    // Click the seeded job
    const card = page.getByTestId('job-card').filter({ hasText: 'Tree Trimming for Jane Johnson' });
    await card.click();

    // Verify job detail page
    await expect(page.getByTestId('job-detail-page')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Tree Trimming for Jane Johnson')).toBeVisible();

    // Visit card should be visible
    await expect(page.getByTestId('visit-card')).toHaveCount(1);
    await expect(page.getByTestId('visit-card').getByText('Scheduled', { exact: true })).toBeVisible();
    await expect(page.getByTestId('visit-card').getByText('120 min')).toBeVisible();
  });
});

test.describe('Create Job from Approved Quote', () => {
  test('creates a job from an approved quote', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Stateful test runs only on desktop-chrome');

    // Navigate to the approved quote
    await page.goto('/quotes');
    await expect(page.getByTestId('quotes-page')).toBeVisible({ timeout: 10000 });

    // Click the approved quote
    const card = page.getByTestId('quote-card').filter({ hasText: 'Monthly Lawn Package for John Smith' });
    await expect(card).toBeVisible();
    await card.click();

    // Verify quote detail page shows the "Create Job" button
    await expect(page.getByTestId('quote-detail-page')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('create-job-btn')).toBeVisible();

    // Click "Create Job"
    await page.getByTestId('create-job-btn').click();

    // Should navigate to job detail page
    await expect(page.getByTestId('job-detail-page')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Monthly Lawn Package for John Smith')).toBeVisible();

    // Visit should be shown
    await expect(page.getByTestId('visit-card')).toHaveCount(1);
    await expect(page.getByTestId('visit-card').getByText('Scheduled', { exact: true })).toBeVisible();
  });

  test('new job appears in jobs list after creation', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Stateful test runs only on desktop-chrome');

    // Self-contained: create the job first, then verify it appears in the list
    await page.goto('/quotes');
    await expect(page.getByTestId('quotes-page')).toBeVisible({ timeout: 10000 });

    const card = page.getByTestId('quote-card').filter({ hasText: 'Monthly Lawn Package for John Smith' });
    await expect(card).toBeVisible();
    await card.click();

    await expect(page.getByTestId('quote-detail-page')).toBeVisible({ timeout: 10000 });
    // Button may be gone if prior test already created the job — check for View Job link instead
    const createBtn = page.getByTestId('create-job-btn');
    if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createBtn.click();
      await expect(page.getByTestId('job-detail-page')).toBeVisible({ timeout: 10000 });
    }

    // Navigate to jobs list and verify
    await page.goto('/jobs');
    await expect(page.getByTestId('jobs-page')).toBeVisible({ timeout: 10000 });

    const jobCard = page.getByTestId('job-card').filter({ hasText: 'Monthly Lawn Package for John Smith' });
    await expect(jobCard).toBeVisible();
  });
});

test.describe('Jobs Accessibility', () => {
  test('jobs list page has no critical a11y violations', async ({ page }) => {
    await page.goto('/jobs');
    await expect(page.getByTestId('jobs-page')).toBeVisible({ timeout: 10000 });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations.filter((v) => v.impact === 'critical')).toHaveLength(0);
  });
});
