import type { Page } from '@playwright/test';

/**
 * Sets demo tenant/user localStorage values before any page loads.
 * Uses `addInitScript` so the values persist across navigations within the context.
 */
export async function setDemoAuth(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('dev_tenant_id', '00000000-0000-0000-0000-000000000001');
    localStorage.setItem('dev_user_id', '00000000-0000-0000-0000-000000000010');
  });
}
