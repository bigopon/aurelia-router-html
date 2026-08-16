import { expect, test } from '@playwright/test';

test.describe('declarative redirects with browser history', () => {
  test('nested index redirects resolve contextually on a direct browser load', async ({ page }) => {
    await page.goto('/__redirect-test__');

    await expect(page).toHaveURL(/\/__redirect-test__\/home$/);
    await expect(page.locator('[data-e2e="home-view"]')).toBeVisible();

    await page.goto('/__redirect-test__/catalog');

    await expect(page).toHaveURL(/\/__redirect-test__\/catalog\/overview$/);
    await expect(page.locator('[data-e2e="catalog-overview"]')).toBeVisible();
  });

  test('root-absolute parameter redirects render only the destination', async ({ page }) => {
    await page.goto('/__redirect-test__/legacy/camera');

    await expect(page).toHaveURL(/\/__redirect-test__\/products\/camera$/);
    await expect(page.locator('[data-e2e="product-view"]')).toHaveText('Product camera');
    await expect(page.locator('[data-e2e="redirect-content"]')).toHaveCount(0);
  });

  test('relative parameter redirects stay inside their parent context', async ({ page }) => {
    await page.goto('/__redirect-test__/catalog/legacy/speaker');

    await expect(page).toHaveURL(/\/__redirect-test__\/catalog\/products\/speaker$/);
    await expect(page.locator('[data-e2e="catalog-product-view"]')).toHaveText('Catalog product speaker');
  });

  test('three-hop redirect chains preserve parameters and render only the destination', async ({ page }) => {
    await page.goto('/__redirect-test__/chain/headphones');

    await expect(page).toHaveURL(/\/__redirect-test__\/products\/headphones$/);
    await expect(page.locator('[data-e2e="product-view"]')).toHaveText('Product headphones');
    await expect(page.locator('[data-e2e="chain-source-content"]')).toHaveCount(0);
    await expect(page.locator('[data-e2e="chain-renamed-content"]')).toHaveCount(0);
  });

  test('three-hop replace chains keep every intermediate URL out of browser history', async ({ page }) => {
    await page.goto('/__redirect-test__/home');
    await page.locator('[data-e2e="chain-redirect-link"]').click();

    await expect(page).toHaveURL(/\/__redirect-test__\/products\/headphones$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/__redirect-test__\/home$/);
    await expect(page.locator('[data-e2e="home-view"]')).toBeVisible();

    await page.goForward();
    await expect(page).toHaveURL(/\/__redirect-test__\/products\/headphones$/);
    await expect(page.locator('[data-e2e="product-view"]')).toHaveText('Product headphones');
  });

  test('root and nested fallbacks redirect within the context that matched them', async ({ page }) => {
    await page.goto('/__redirect-test__/missing');

    await expect(page).toHaveURL(/\/__redirect-test__\/not-found$/);
    await expect(page.locator('[data-e2e="root-not-found"]')).toBeVisible();

    await page.goto('/__redirect-test__/catalog/missing');

    await expect(page).toHaveURL(/\/__redirect-test__\/catalog\/not-found$/);
    await expect(page.locator('[data-e2e="catalog-not-found"]')).toBeVisible();
    await expect(page.locator('[data-e2e="root-not-found"]')).toHaveCount(0);
  });

  test('dynamic redirect bindings use their latest target', async ({ page }) => {
    await page.goto('/__redirect-test__/home');
    await page.locator('[data-e2e="dynamic-redirect-link"]').click();
    await expect(page).toHaveURL(/\/__redirect-test__\/products\/keyboard$/);

    await page.goto('/__redirect-test__/home');
    await page.locator('[data-e2e="use-archive-target"]').click();
    await expect(page.locator('[data-e2e="dynamic-target"]')).toHaveText('/__redirect-test__/archive/:productId');
    await page.locator('[data-e2e="dynamic-redirect-link"]').click();
    await expect(page).toHaveURL(/\/__redirect-test__\/archive\/keyboard$/);
    await expect(page.locator('[data-e2e="archive-view"]')).toHaveText('Archived product keyboard');
  });

  test('replace redirects keep the redirecting URL out of browser history', async ({ page }) => {
    await page.goto('/__redirect-test__/home');
    await page.locator('[data-e2e="absolute-redirect-link"]').click();

    await expect(page).toHaveURL(/\/__redirect-test__\/products\/camera$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/__redirect-test__\/home$/);
    await expect(page.locator('[data-e2e="home-view"]')).toBeVisible();

    await page.goForward();
    await expect(page).toHaveURL(/\/__redirect-test__\/products\/camera$/);
    await expect(page.locator('[data-e2e="product-view"]')).toHaveText('Product camera');
  });

  test('push redirects add both the source and destination browser entries', async ({ page }) => {
    await page.goto('/__redirect-test__/home');
    const initialLength = await page.evaluate(() => history.length);
    await page.locator('[data-e2e="push-redirect-link"]').click();

    await expect(page).toHaveURL(/\/__redirect-test__\/products\/projector$/);
    await expect(page.locator('[data-e2e="product-view"]')).toHaveText('Product projector');
    await expect.poll(() => page.evaluate(() => history.length)).toBe(initialLength + 2);
  });

  test('redirect loops reject with the complete normalized chain', async ({ page }) => {
    await page.goto('/__redirect-test__/home');
    await page.locator('[data-e2e="trigger-loop"]').click();

    await expect(page.locator('[data-e2e="redirect-error"]')).toHaveText(
      'Redirect loop detected: /__redirect-test__/loop-a -> /__redirect-test__/loop-b -> /__redirect-test__/loop-a',
    );
  });
});
