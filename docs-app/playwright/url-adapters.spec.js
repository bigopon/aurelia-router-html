import { expect, test } from '@playwright/test';

const modes = [
  {
    name: 'pathname',
    productsUrl: '/__adapter-test__/products',
    reviewsHref: '/__adapter-test__/reviews',
    detailsHref: '/__adapter-test__/details#details-section',
  },
  {
    name: 'hash-only',
    productsUrl: '/__adapter-test__#products',
    reviewsHref: '#reviews',
    detailsHref: '#details#details-section',
  },
  {
    name: 'query-key',
    productsUrl: '/__adapter-test__?route=products',
    reviewsHref: '?route=reviews',
    detailsHref: '?route=details#details-section',
  },
];

for (const mode of modes) {
  test(`${mode.name} adapter harness still loads route content and generated links`, async ({ page }) => {
    await page.goto(mode.productsUrl);

    await expect(page.getByRole('heading', { name: 'Adapter products' })).toBeVisible();
    await expect(page.locator('[data-e2e="reviews-link"]')).toHaveAttribute('href', mode.reviewsHref);
    await expect(page.locator('[data-e2e="details-link"]')).toHaveAttribute('href', mode.detailsHref);

    await page.locator('[data-e2e="reviews-link"]').click();
    await expect(page.getByRole('heading', { name: 'Adapter reviews' })).toBeVisible();
  });
}

test('adapter harness still renders async details content after navigation', async ({ page }) => {
  await page.goto('/__adapter-test__/products');

  await expect(page.getByRole('heading', { name: 'Adapter products' })).toBeVisible();
  await page.locator('[data-e2e="details-link"]').click();
  await expect(page.getByRole('heading', { name: 'Adapter details' })).toBeVisible();
  await expect(page.locator('[data-e2e="details-status"]')).toHaveText('Anchored content ready');
  await expect(page.locator('[data-e2e="details-section"]')).toBeVisible();
});

test('adapter harness still follows basic browser history between products and reviews', async ({ page }) => {
  await page.goto('/__adapter-test__/products');

  await page.locator('[data-e2e="reviews-link"]').click();
  await expect(page.getByRole('heading', { name: 'Adapter reviews' })).toBeVisible();

  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Adapter products' })).toBeVisible();
});
