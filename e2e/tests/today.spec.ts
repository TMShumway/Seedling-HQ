import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Auth as Demo Member (who has visits assigned today)
async function setDemoMemberAuth(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('dev_tenant_id', '00000000-0000-0000-0000-000000000001');
    localStorage.setItem('dev_user_id', '00000000-0000-0000-0000-000000000012');
    localStorage.setItem('dev_user_role', 'member');
    localStorage.setItem('dev_user_name', 'Demo Member');
    localStorage.setItem('dev_tenant_name', 'Demo Business');
  });
}

// Auth as Demo Owner (for nav test)
async function setDemoOwnerAuth(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('dev_tenant_id', '00000000-0000-0000-0000-000000000001');
    localStorage.setItem('dev_user_id', '00000000-0000-0000-0000-000000000010');
    localStorage.setItem('dev_user_role', 'owner');
    localStorage.setItem('dev_user_name', 'Demo Owner');
    localStorage.setItem('dev_tenant_name', 'Demo Business');
  });
}

test.describe('Today page', () => {
  test('renders page with heading and date', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Today page E2E — desktop only');
    await setDemoMemberAuth(page);
    await page.goto('/today');

    await expect(page.getByTestId('today-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  });

  // Uses John Smith's visit (seeded at 2 PM, not mutated by schedule.spec.ts)
  test('shows seeded visit card for Demo Member', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Today page E2E — desktop only');
    await setDemoMemberAuth(page);
    await page.goto('/today');

    const card = page.getByTestId('today-visit-card').filter({ hasText: 'John Smith' });
    await expect(card).toBeVisible();

    await expect(card.getByTestId('today-visit-title')).toContainText('Lawn Mowing');
    await expect(card).toContainText('John Smith');
    await expect(card).toContainText('75 min');
  });

  test('shows address link with maps.google.com', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Today page E2E — desktop only');
    await setDemoMemberAuth(page);
    await page.goto('/today');

    const card = page.getByTestId('today-visit-card').filter({ hasText: 'John Smith' });
    const addressLink = card.getByTestId('today-visit-address');
    await expect(addressLink).toBeVisible();
    await expect(addressLink).toHaveAttribute('href', /maps\.google\.com/);
  });

  test('shows status action buttons', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Today page E2E — desktop only');
    await setDemoMemberAuth(page);
    await page.goto('/today');

    const card = page.getByTestId('today-visit-card').filter({ hasText: 'John Smith' });
    await expect(card).toBeVisible();

    // Visit starts as 'scheduled' — should see En Route and Start buttons
    await expect(card.getByTestId('action-en-route')).toBeVisible();
    await expect(card.getByTestId('action-start')).toBeVisible();
  });

  test('full status transition flow: En Route → Start → Complete', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Stateful test — desktop only');
    await setDemoMemberAuth(page);
    await page.goto('/today');

    // Target John Smith's card specifically (not mutated by schedule.spec.ts)
    const card = page.getByTestId('today-visit-card').filter({ hasText: 'John Smith' });
    await expect(card).toBeVisible();

    // Step 1: En Route
    await card.getByTestId('action-en-route').click();
    await expect(card).toContainText('En Route');
    await expect(card.getByTestId('action-start')).toBeVisible();

    // Step 2: Start
    await card.getByTestId('action-start').click();
    await expect(card).toContainText('Started');
    await expect(card.getByTestId('action-complete')).toBeVisible();

    // Step 3: Complete (now has confirmation step)
    await card.getByTestId('action-complete').click();
    await expect(card.getByTestId('confirm-complete')).toBeVisible();
    await card.getByTestId('complete-anyway').click();
    await expect(card).toContainText('Completed');
    await expect(card.getByTestId('completed-time')).toBeVisible();

    // No more action buttons on this card
    await expect(card.getByTestId('action-en-route')).toHaveCount(0);
    await expect(card.getByTestId('action-start')).toHaveCount(0);
    await expect(card.getByTestId('action-complete')).toHaveCount(0);
  });

  test('Today nav link visible and navigates', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Nav test — desktop only');
    await setDemoOwnerAuth(page);
    await page.goto('/dashboard');

    const todayLink = page.locator('a', { hasText: 'Today' });
    await expect(todayLink).toBeVisible();
    await todayLink.click();

    await expect(page).toHaveURL(/\/today/);
    await expect(page.getByTestId('today-page')).toBeVisible();
  });

  test('no critical accessibility violations', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'A11y test — desktop only');
    await setDemoMemberAuth(page);
    await page.goto('/today');
    await page.waitForSelector('[data-testid="today-page"]');

    const results = await new AxeBuilder({ page })
      .exclude('.lucide')
      .analyze();

    const critical = results.violations.filter(
      (v) => v.impact === 'critical',
    );
    expect(critical).toHaveLength(0);
  });
});
