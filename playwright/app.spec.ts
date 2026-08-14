import { expect, test } from '@playwright/test';

test.describe.serial('html-router', () => {
  test('A0 initial /store renders parent and index routes', async ({ page }) => {
    await page.goto('/store');

    await expect(page.locator('[data-e2e="current-path"]')).toContainText('/store');
    await expect(page.locator('[data-e2e="route-store"]')).toBeVisible();
    await expect(page.locator('[data-e2e="route-store-index"]')).toBeVisible();
    await expect(page.locator('[data-e2e="route-store-shared"]')).toBeVisible();
    await expect(page.locator('[data-e2e="route-store-id"]')).toHaveCount(0);
  });

  test('A0 initial deep link renders nested params and lazy content', async ({ page }) => {
    await page.goto('/store/123/order');

    await expect(page.locator('[data-e2e="current-path"]')).toContainText('/store/123/order');
    await expect(page.locator('[data-e2e="route-store"]')).toBeVisible();
    await expect(page.locator('[data-e2e="route-store-id"]')).toBeVisible();
    await expect(page.locator('[data-e2e="store-id-value"]')).toContainText('123');
    await expect(page.locator('[data-e2e="route-store-order"]')).toBeVisible();
    await expect(page.locator('[data-e2e="lazy-order"]')).toContainText('123');
    await expect(page.locator('[data-e2e="route-store-index"]')).toHaveCount(0);
  });

  test('A0 anchor navigation and browser history keep routes in sync', async ({ page }) => {
    await page.goto('/');

    await page.locator('[data-e2e="link-store"]').click();
    await expect(page).toHaveURL(/\/store$/);
    await expect(page.locator('[data-e2e="route-store-index"]')).toBeVisible();

    await page.locator('[data-e2e="link-store-123-order"]').click();
    await expect(page).toHaveURL(/\/store\/123\/order$/);
    await expect(page.locator('[data-e2e="lazy-order"]')).toContainText('123');

    await page.goBack();
    await expect(page).toHaveURL(/\/store$/);
    await expect(page.locator('[data-e2e="route-store-index"]')).toBeVisible();

    await page.goForward();
    await expect(page).toHaveURL(/\/store\/123\/order$/);
    await expect(page.locator('[data-e2e="lazy-order"]')).toContainText('123');
  });

  test('A1 conditional au-route added later becomes active for current residue', async ({ page }) => {
    await page.goto('/store/123/promo');

    await expect(page.locator('[data-e2e="route-store-id"]')).toBeVisible();
    await expect(page.locator('[data-e2e="promo-route-else"]')).toBeVisible();
    await expect(page.locator('[data-e2e="route-store-promo"]')).toHaveCount(0);

    await page.locator('[data-e2e="toggle-promo-route"]').click();
    await expect(page.locator('[data-e2e="route-store-promo"]')).toContainText('123');
    await expect(page.locator('[data-e2e="promo-route-else"]')).toHaveCount(0);

    await page.locator('[data-e2e="toggle-promo-route"]').click();
    await expect(page.locator('[data-e2e="route-store-promo"]')).toHaveCount(0);
    await expect(page.locator('[data-e2e="promo-route-else"]')).toBeVisible();
  });

  test('A1 repeated-template au-route added later becomes active for current residue', async ({ page }) => {
    await page.goto('/store/123/flash');

    await expect(page.locator('[data-e2e="route-store-id"]')).toBeVisible();
    await expect(page.locator('[data-e2e="route-store-flash"]')).toHaveCount(0);

    await page.locator('[data-e2e="add-flash-route"]').click();
    await expect(page.locator('[data-e2e="route-store-flash"]')).toContainText('Flash route from repeat');
    await expect(page).toHaveURL(/\/store\/123\/flash$/);

    await page.locator('[data-e2e="remove-flash-route"]').click();
    await expect(page.locator('[data-e2e="route-store-flash"]')).toHaveCount(0);
  });
});
