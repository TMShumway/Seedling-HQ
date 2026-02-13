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

    // The visit should now appear on the calendar for the scheduled date
    await expect(page.getByTestId('visit-block').first()).toBeVisible({ timeout: 10000 });

    // The unscheduled panel should no longer contain the card we scheduled
    if (cardText) {
      await expect(page.getByTestId('unscheduled-card').filter({ hasText: cardText })).not.toBeVisible({ timeout: 5000 });
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

test.describe('Assign Technician', () => {
  // Helper: find Jane Johnson's visit block, navigating weeks if needed
  // (prior Schedule Page tests may reschedule her to a different week)
  async function findJaneJohnsonBlock(page: import('@playwright/test').Page) {
    await page.goto('/schedule');
    await expect(page.getByTestId('schedule-page')).toBeVisible({ timeout: 10000 });

    const visitBlock = page.getByTestId('visit-block').filter({ hasText: 'Jane Johnson' }).first();
    const visible = await visitBlock.isVisible().catch(() => false);
    if (!visible) {
      // Reschedule test may have moved her to 2026-02-16 — navigate next week
      await page.getByTestId('next-week').click();
      await expect(visitBlock).toBeVisible({ timeout: 10000 });
    }
    return visitBlock;
  }

  test('shows assigned technician name on calendar visit block', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Calendar visit block only on desktop');

    const visitBlock = await findJaneJohnsonBlock(page);

    // Should show assignee name
    const assignee = visitBlock.getByTestId('visit-block-assignee');
    await expect(assignee).toBeVisible();
    await expect(assignee).toHaveText('Demo Member');
  });

  test('shows unassigned indicator on visit without assignee', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Depends on seed data');

    await page.goto('/schedule');
    await expect(page.getByTestId('schedule-page')).toBeVisible({ timeout: 10000 });

    // After prior Schedule Page tests, Bob Wilson's visit is scheduled (Feb 15).
    // Wait for any visit block to load, then check Bob's block has no assignee.
    await expect(page.getByTestId('visit-block').first()).toBeVisible({ timeout: 10000 });

    const bobBlock = page.getByTestId('visit-block').filter({ hasText: 'Bob Wilson' }).first();
    const bobVisible = await bobBlock.isVisible().catch(() => false);
    if (bobVisible) {
      // Bob's visit block should NOT have the assignee element (he's unassigned)
      await expect(bobBlock.getByTestId('visit-block-assignee')).not.toBeVisible();
    } else {
      // Bob may still be unscheduled (if run in isolation) — check unscheduled panel
      const unscheduledCard = page.getByTestId('unscheduled-card').first();
      await expect(unscheduledCard).toBeVisible({ timeout: 10000 });
      const assignee = unscheduledCard.getByTestId('unscheduled-assignee');
      await expect(assignee).toHaveText('Unassigned');
    }
  });

  test('schedule modal shows tech picker dropdown for owner', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Modal dropdown on desktop');

    await page.goto('/schedule');
    await expect(page.getByTestId('schedule-page')).toBeVisible({ timeout: 10000 });

    // Click a visit block to open modal
    const visitBlock = page.getByTestId('visit-block').first();
    await expect(visitBlock).toBeVisible({ timeout: 10000 });
    await visitBlock.click();

    // Modal should show assign dropdown
    await expect(page.getByTestId('schedule-modal')).toBeVisible();
    await expect(page.getByTestId('assign-user-select')).toBeVisible();

    // Should have "Unassigned" option and at least one user
    const select = page.getByTestId('assign-user-select');
    const options = select.locator('option');
    const count = await options.count();
    expect(count).toBeGreaterThanOrEqual(2); // "Unassigned" + at least one user
  });

  test('assigns technician via schedule modal', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Stateful test on desktop');

    const visitBlock = await findJaneJohnsonBlock(page);
    await visitBlock.click();

    // Modal open, pick Demo Owner from dropdown
    await expect(page.getByTestId('schedule-modal')).toBeVisible();
    const select = page.getByTestId('assign-user-select');
    await select.selectOption({ label: 'Demo Owner (owner)' });

    // Save
    await page.getByTestId('schedule-submit').click();
    await expect(page.getByTestId('schedule-modal')).not.toBeVisible({ timeout: 10000 });

    // Refresh and verify assignment changed
    await page.reload();
    await expect(page.getByTestId('schedule-page')).toBeVisible({ timeout: 10000 });

    // Jane may be on current or next week — check both
    const updatedBlock = page.getByTestId('visit-block').filter({ hasText: 'Jane Johnson' }).first();
    const visible = await updatedBlock.isVisible().catch(() => false);
    if (!visible) {
      await page.getByTestId('next-week').click();
    }
    await expect(updatedBlock).toBeVisible({ timeout: 10000 });
    const assignee = updatedBlock.getByTestId('visit-block-assignee');
    await expect(assignee).toHaveText('Demo Owner');
  });

  test('My Visits toggle filters calendar', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Toggle on desktop');

    await page.goto('/schedule');
    await expect(page.getByTestId('schedule-page')).toBeVisible({ timeout: 10000 });

    // Toggle "My Visits"
    const toggle = page.getByTestId('my-visits-toggle');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveText('All Visits');

    await toggle.click();
    await expect(toggle).toHaveText('My Visits');

    // URL should have ?mine=true
    expect(page.url()).toContain('mine=true');

    // Toggle back to All Visits
    await toggle.click();
    await expect(toggle).toHaveText('All Visits');
    expect(page.url()).not.toContain('mine=true');
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
