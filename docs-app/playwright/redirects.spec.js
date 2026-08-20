import { expect, test } from '@playwright/test';

test.describe('redirect harness smoke tests', () => {
  test('root and nested index redirects still boot the harness into visible content', async ({ page }) => {
    await page.goto('/__redirect-test__');
    await expect(page.getByRole('heading', { name: 'Redirect home' })).toBeVisible();

    await page.goto('/__redirect-test__/catalog');
    await expect(page.getByRole('heading', { name: 'Catalog overview' })).toBeVisible();
  });

  test('redirect links still navigate to rendered destinations', async ({ page }) => {
    await page.goto('/__redirect-test__/home');

    await page.locator('[data-e2e="absolute-redirect-link"]').click();
    await expect(page.getByRole('heading', { name: 'Product camera' })).toBeVisible();

    await page.locator('[data-e2e="home-link"]').click();
    await expect(page.getByRole('heading', { name: 'Redirect home' })).toBeVisible();
  });

  test('dynamic redirects and fallback redirects still land on visible destinations', async ({ page }) => {
    await page.goto('/__redirect-test__/home');

    await page.locator('[data-e2e="dynamic-redirect-link"]').click();
    await expect(page.getByRole('heading', { name: 'Product keyboard' })).toBeVisible();

    await page.locator('[data-e2e="home-link"]').click();
    await page.locator('[data-e2e="use-archive-target"]').click();
    await page.locator('[data-e2e="dynamic-redirect-link"]').click();
    await expect(page.getByRole('heading', { name: 'Archived product keyboard' })).toBeVisible();

    await page.goto('/__redirect-test__/missing');
    await expect(page.getByRole('heading', { name: 'Route not found' })).toBeVisible();
  });

  test('redirect loop errors still surface in the harness', async ({ page }) => {
    await page.goto('/__redirect-test__/home');
    await page.locator('[data-e2e="trigger-loop"]').click();
    await expect(page.locator('[data-e2e="redirect-error"]')).toContainText('Redirect loop detected:');
  });
});
