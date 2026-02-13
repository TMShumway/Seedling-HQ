import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';

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

async function isLocalStackAvailable(): Promise<boolean> {
  try {
    const res = await fetch('http://localhost:4566/_localstack/health', { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

test.describe('Visit photos', () => {
  // Uses dedicated DEMO_PHOTO_VISIT_ID visit (Jane Johnson, 4:30 PM) — not mutated by other test files
  test('upload and delete photo flow', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Photo E2E — desktop only');

    const localStackUp = await isLocalStackAvailable();
    test.skip(!localStackUp, 'LocalStack not running — skipping photo E2E');

    await setDemoMemberAuth(page);
    await page.goto('/today');

    // Find the Jane Johnson visit card (seeded as scheduled)
    const card = page.getByTestId('today-visit-card').filter({ hasText: 'Jane Johnson' });
    await expect(card).toBeVisible();

    // Transition to started (photos only available for en_route/started/completed)
    await card.getByTestId('action-start').click();
    await expect(card).toContainText('Started');

    // Photo upload button should be visible
    const uploadBtn = card.getByTestId('photo-upload-btn');
    await expect(uploadBtn).toBeVisible();

    // Create a small test image (1x1 red pixel JPEG)
    const testImagePath = resolve(__dirname, '../fixtures/test-photo.jpg');

    // Upload a photo via file input
    const fileInput = card.getByTestId('photo-upload-input');
    await fileInput.setInputFiles(testImagePath);

    // Wait for upload to complete — photo should appear in gallery
    await expect(card.getByTestId('photo-gallery')).toBeVisible({ timeout: 10000 });
    await expect(card.getByTestId('photo-thumbnail')).toBeVisible();

    // Delete the photo
    await card.getByTestId('delete-photo-btn').click();
    await card.getByTestId('confirm-delete-photo').click();

    // Gallery should be gone (no photos)
    await expect(card.getByTestId('photo-thumbnail')).toHaveCount(0);
  });
});
