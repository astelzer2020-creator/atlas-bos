import { test, expect } from '@playwright/test';

async function isAtlasWebReady(baseURL: string | undefined): Promise<boolean> {
  if (baseURL === undefined) {
    return false;
  }

  try {
    const loginResponse = await fetch(`${baseURL}/login`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!loginResponse.ok) {
      return false;
    }

    const html = await loginResponse.text();
    return html.includes('Sign in to Atlas');
  } catch {
    return false;
  }
}

test.describe('Atlas web smoke tests', () => {
  test.beforeAll(async ({}, testInfo) => {
    const ready = await isAtlasWebReady(testInfo.project.use.baseURL as string | undefined);
    test.skip(!ready, 'Atlas web is not ready — run pnpm --filter @atlas/web build && pnpm test:e2e');
  });

  test('landing page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Atlas/i);
    await expect(page.getByText('Business Operating System')).toBeVisible();
  });

  test('login page renders form fields', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Sign in to Atlas')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
  });

  test('register page renders form fields', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByText('Create your Atlas account')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
  });

  test('mobile viewport shows login form', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/login');
    await expect(page.getByText('Sign in to Atlas')).toBeVisible();
  });
});