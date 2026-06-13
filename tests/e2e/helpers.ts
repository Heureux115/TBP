import { expect, type Page } from '@playwright/test';

export const E2E_PASSWORD = 'Test@123456';

export const users = {
  admin: {
    email: process.env.E2E_ADMIN_EMAIL || 'admin@example.com',
    password: process.env.E2E_ADMIN_PASSWORD || 'Admin@123456',
  },
  student: {
    email: 'student@test.local',
    password: E2E_PASSWORD,
  },
  tutor: {
    email: 'tutor.math.approved@test.local',
    password: E2E_PASSWORD,
  },
};

export async function loginByApi(
  page: Page,
  user: { email: string; password: string },
) {
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  const response = await page.request.post(`${apiUrl}/auth/login`, {
    data: user,
  });

  expect(response.ok()).toBeTruthy();
}

export async function expectNoLoginLink(page: Page) {
  await expect(page.locator('a[href="/auth/login"]')).toHaveCount(0);
}

export async function firstTutorDetailHref(page: Page) {
  await page.goto('/tutors');
  const tutorLink = page.locator('a[href^="/tutors/"]').first();
  await expect(tutorLink).toBeVisible();
  const href = await tutorLink.getAttribute('href');

  if (!href) {
    throw new Error('Tutor detail link was not found.');
  }

  return href;
}
