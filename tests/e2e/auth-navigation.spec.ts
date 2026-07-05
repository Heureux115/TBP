import { expect, test } from '@playwright/test';
import { expectNoLoginLink, loginByApi, users } from './helpers';

test.describe('role navigation and session', () => {
  test('student direct navigation keeps the session on public tutor search', async ({
    page,
  }) => {
    await loginByApi(page, users.student);

    await page.goto('/tutors');

    await expect(page).toHaveURL(/\/tutors/);
    await expectNoLoginLink(page);
    await expect(page.locator('a[href="/dashboard"]').first()).toBeVisible();
    await expect(page.locator('a[href^="/tutors/"]').first()).toBeVisible();
  });

  test('student dashboard is reachable with cookie session', async ({ page }) => {
    await loginByApi(page, users.student);

    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('body')).toContainText(/TutorConnect|dashboard/i);
  });

  test('legacy student disputes route redirects to the dashboard', async ({
    page,
  }) => {
    await loginByApi(page, users.student);

    await page.goto('/disputes');

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('tutor dashboard is reachable with cookie session', async ({ page }) => {
    await loginByApi(page, users.tutor);

    await page.goto('/tutor/dashboard');

    await expect(page).toHaveURL(/\/tutor\/dashboard/);
    await expect(page.locator('body')).toContainText(/TutorConnect|Gia sư|gia sư/i);
  });

  test('admin dashboard is reachable with cookie session', async ({ page }) => {
    await loginByApi(page, users.admin);

    await page.goto('/admin/dashboard');

    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await expect(page.locator('body')).toContainText(/Admin dashboard/i);
  });
});
