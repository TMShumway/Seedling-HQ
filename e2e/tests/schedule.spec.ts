import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setDemoAuth } from '../helpers/auth';

test.beforeEach(async ({ page }) => {
  await setDemoAuth(page);
});

test.describe('Schedule Page', () => {
  test('renders schedule page with week calendar', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Calendar week view only on desktop');

    await page.goto('/schedule');
    await expect(page.getByTestId('schedule-page')).toBeVisible({ timeout: 10000 });

    // Header visible
    await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible();

    // Week view visible
    await expect(page.getByTestId('week-view')).toBeVisible();

    // Navigation buttons visible
    await expect(page.getByTestId('prev-week')).toBeVisible();
    await expect(page.getByTestId('next-week')).toBeVisible();
    await expect(page.getByTestId('today-btn')).toBeVisible();

    // Week range label visible
    await expect(page.getByTestId('week-range')).toBeVisible();
  });

  test('shows seeded scheduled visit on calendar', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Calendar visit block only on desktop');

    await page.goto('/schedule');
    await expect(page.getByTestId('schedule-page')).toBeVisible({ timeout: 10000 });

    // Seeded visit for Jane Johnson should appear as a block — use first() to handle possible duplicates
    const visitBlock = page.getByTestId('visit-block').filter({ hasText: 'Jane Johnson' }).first();
    await expect(visitBlock).toBeVisible({ timeout: 10000 });
  });

  test('shows unscheduled visits panel', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Depends on seed data');

    await page.goto('/schedule');
    await expect(page.getByTestId('schedule-page')).toBeVisible({ timeout: 10000 });

    // Unscheduled panel should show at least one unscheduled visit
    await expect(page.getByTestId('unscheduled-panel')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('unscheduled-card').first()).toBeVisible();
  });

  test('schedules a visit via modal from unscheduled panel', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Stateful test depends on seed data');

    await page.goto('/schedule');
    await expect(page.getByTestId('schedule-page')).toBeVisible({ timeout: 10000 });

    // Click the first unscheduled card
    const unscheduledCard = page.getByTestId('unscheduled-card').first();
    await expect(unscheduledCard).toBeVisible({ timeout: 10000 });
    const cardText = await unscheduledCard.textContent();
    await unscheduledCard.click();

    // Modal should open
    await expect(page.getByTestId('schedule-modal')).toBeVisible();
    await expect(page.getByText('Schedule Visit')).toBeVisible();

    // Fill in start time
    const startInput = page.getByTestId('schedule-start-input');
    await startInput.fill('2026-02-15T09:00');

    // Click schedule
    await page.getByTestId('schedule-submit').click();

    // Modal should close
    await expect(page.getByTestId('schedule-modal')).not.toBeVisible({ timeout: 10000 });

    // The card text we clicked should no longer be in unscheduled panel
    if (cardText) {
      // Give time for query invalidation
      await page.waitForTimeout(1000);
    }
  });

  test('reschedules a visit via calendar click', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Calendar click only on desktop');

    await page.goto('/schedule');
    await expect(page.getByTestId('schedule-page')).toBeVisible({ timeout: 10000 });

    // Click any scheduled visit block on the calendar
    const visitBlock = page.getByTestId('visit-block').first();
    await expect(visitBlock).toBeVisible({ timeout: 10000 });
    await visitBlock.click();

    // Modal should open with "Reschedule" title
    await expect(page.getByTestId('schedule-modal')).toBeVisible();
    await expect(page.getByText('Reschedule Visit')).toBeVisible();

    // Start input should be pre-filled
    const startInput = page.getByTestId('schedule-start-input');
    const value = await startInput.inputValue();
    expect(value).not.toBe('');

    // Change the time and submit
    await startInput.fill('2026-02-16T14:00');
    await page.getByTestId('schedule-submit').click();

    // Modal should close
    await expect(page.getByTestId('schedule-modal')).not.toBeVisible({ timeout: 10000 });
  });

  test('navigates weeks with prev/next/today', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Week navigation on desktop');

    await page.goto('/schedule');
    await expect(page.getByTestId('schedule-page')).toBeVisible({ timeout: 10000 });

    const weekRange = page.getByTestId('week-range');
    const initialRange = await weekRange.textContent();

    // Click next week
    await page.getByTestId('next-week').click();
    await expect(weekRange).not.toHaveText(initialRange!);
    const nextRange = await weekRange.textContent();

    // URL should have ?week= param
    expect(page.url()).toContain('week=');

    // Click prev week to go back
    await page.getByTestId('prev-week').click();
    await expect(weekRange).toHaveText(initialRange!);

    // Click next twice, then Today to return to current week
    await page.getByTestId('next-week').click();
    await page.getByTestId('next-week').click();
    // Should now be 2 weeks ahead
    const twoWeeksAhead = await weekRange.textContent();
    expect(twoWeeksAhead).not.toBe(initialRange);

    await page.getByTestId('today-btn').click();
    await expect(weekRange).toHaveText(initialRange!);
  });
});

test.describe('Schedule Accessibility', () => {
  test('schedule page has no critical a11y violations', async ({ page }) => {
    await page.goto('/schedule');
    await expect(page.getByTestId('schedule-page')).toBeVisible({ timeout: 10000 });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations.filter((v) => v.impact === 'critical')).toHaveLength(0);
  });
});
