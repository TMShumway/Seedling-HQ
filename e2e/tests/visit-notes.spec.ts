import { test, expect } from '@playwright/test';

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

test.describe('Visit notes + completion flow', () => {
  // Uses dedicated DEMO_NOTES_VISIT_ID visit (Bob Wilson, 3:30 PM) — not mutated by other test files
  test('full notes and completion flow on Today page', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Notes E2E — desktop only');
    await setDemoMemberAuth(page);
    await page.goto('/today');

    // Find the Bob Wilson visit card (seeded as scheduled)
    const card = page.getByTestId('today-visit-card').filter({ hasText: 'Bob Wilson' });
    await expect(card).toBeVisible();

    // Should NOT have notes textarea in scheduled state
    await expect(card.getByTestId('visit-notes-input')).toHaveCount(0);

    // Transition to started (skip en_route for speed)
    await card.getByTestId('action-start').click();
    await expect(card).toContainText('Started');

    // Now notes textarea should be visible
    const textarea = card.getByTestId('visit-notes-input');
    await expect(textarea).toBeVisible();

    // Add notes
    await textarea.fill('Backyard looks great, trimmed edges');

    // Save notes
    const saveBtn = card.getByTestId('visit-notes-save');
    await saveBtn.click();

    // Wait for save to complete (button text returns to "Save Notes")
    await expect(saveBtn).toContainText('Save Notes');

    // Verify notes persist by reloading
    await page.reload();
    const cardAfterReload = page.getByTestId('today-visit-card').filter({ hasText: 'Bob Wilson' });
    await expect(cardAfterReload.getByTestId('visit-notes-input')).toHaveValue('Backyard looks great, trimmed edges');

    // Click Complete — should show confirmation
    await cardAfterReload.getByTestId('action-complete').click();
    await expect(cardAfterReload.getByTestId('confirm-complete')).toBeVisible();
    await expect(cardAfterReload).toContainText('Any notes or photos to add?');

    // Click Go Back — should dismiss confirmation
    await cardAfterReload.getByTestId('cancel-complete').click();
    await expect(cardAfterReload.getByTestId('confirm-complete')).toHaveCount(0);

    // Visit should still be started
    await expect(cardAfterReload).toContainText('Started');

    // Notes should still be there
    await expect(cardAfterReload.getByTestId('visit-notes-input')).toHaveValue('Backyard looks great, trimmed edges');

    // Complete the visit for real
    await cardAfterReload.getByTestId('action-complete').click();
    await cardAfterReload.getByTestId('complete-anyway').click();

    // Should now show completed state
    await expect(cardAfterReload).toContainText('Completed');
    await expect(cardAfterReload.getByTestId('completed-time')).toBeVisible();

    // Notes should be displayed read-only (no textarea)
    await expect(cardAfterReload.getByTestId('visit-notes-input')).toHaveCount(0);
    await expect(cardAfterReload.getByTestId('visit-notes-display')).toContainText('Backyard looks great, trimmed edges');
  });
});
