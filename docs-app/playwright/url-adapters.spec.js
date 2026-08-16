import { expect, test } from '@playwright/test';

const modes = [
  {
    name: 'pathname',
    productsUrl: '/__adapter-test__/products',
    reviewsUrl: /\/__adapter-test__\/reviews$/,
    reviewsHref: '/__adapter-test__/reviews',
  },
  {
    name: 'hash-only',
    productsUrl: '/__adapter-test__#products',
    reviewsUrl: /\/__adapter-test__#reviews$/,
    reviewsHref: '#reviews',
  },
  {
    name: 'query-key',
    productsUrl: '/__adapter-test__?route=products',
    reviewsUrl: /\/__adapter-test__\?route=reviews$/,
    reviewsHref: '?route=reviews',
  },
];

for (const mode of modes) {
  test(`${mode.name} adapter loads, intercepts links, and follows browser history`, async ({ page }) => {
    await page.goto(mode.productsUrl);

    await expect(page.getByRole('heading', { name: 'Adapter products' })).toBeVisible();
    const reviews = page.locator('[data-e2e="reviews-link"]');
    await expect(reviews).toHaveAttribute('href', mode.reviewsHref);

    await reviews.click();
    await expect(page).toHaveURL(mode.reviewsUrl);
    await expect(page.getByRole('heading', { name: 'Adapter reviews' })).toBeVisible();

    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Adapter products' })).toBeVisible();

    await page.goForward();
    await expect(page).toHaveURL(mode.reviewsUrl);
    await expect(page.getByRole('heading', { name: 'Adapter reviews' })).toBeVisible();
  });
}
