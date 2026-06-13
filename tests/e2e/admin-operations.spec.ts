import { expect, test } from '@playwright/test';
import { loginByApi, users } from './helpers';

test.describe('admin operations smoke', () => {
  test('admin can open payments, disputes, tutors and notification surfaces', async ({
    page,
  }) => {
    await loginByApi(page, users.admin);

    await page.goto('/admin/dashboard');
    await expect(page.getByRole('heading', { name: /Admin dashboard/i })).toBeVisible();

    await page.goto('/admin/payments');
    await expect(page.locator('body')).toContainText(/Rút tiền|Thanh toán/i);

    await page.goto('/admin/disputes');
    await expect(page.locator('body')).toContainText(/Dispute/i);

    await page.goto('/admin/tutors');
    await expect(page.locator('body')).toContainText(/Gia sư|Duyệt/i);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await page.getByTestId('admin-notifications-button').click();
    await expect(page.getByTestId('admin-notifications-panel')).toBeVisible();
  });
});
