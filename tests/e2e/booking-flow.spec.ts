import { expect, test } from '@playwright/test';
import { firstTutorDetailHref, loginByApi, users } from './helpers';

test.describe('student booking flow', () => {
  test('student can confirm details before sending a booking request', async ({
    page,
  }) => {
    await loginByApi(page, users.student);
    const href = await firstTutorDetailHref(page);

    await page.goto(href);

    await expect(page.locator('body')).toContainText(/TutorConnect/);
    await page.locator('a[href="#availability"]').click();

    const availableSlot = page
      .locator('button:not([disabled])')
      .filter({ hasText: /\d{2}:\d{2}/ })
      .first();
    await expect(availableSlot).toBeVisible();
    await availableSlot.click();

    await page
      .getByRole('button', { name: /Dat lich hoc|Đặt lịch học/i })
      .click();

    await expect(
      page.getByRole('heading', { name: /Xác nhận đặt lịch/i }),
    ).toBeVisible();
    await expect(page.locator('body')).toContainText(/Gia sư sẽ xác nhận/i);
    await expect(page.locator('body')).toContainText(/Tổng giữ chỗ/i);

    await page.getByRole('button', { name: /Gửi yêu cầu/i }).click();

    await expect(page.locator('a[href^="/bookings/"]')).toBeVisible({
      timeout: 15_000,
    });
  });
});
