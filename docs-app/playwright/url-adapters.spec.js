import { expect, test } from '@playwright/test';

const modes = [
  {
    name: 'pathname',
    productsUrl: '/__adapter-test__/products',
    reviewsUrl: /\/__adapter-test__\/reviews$/,
    reviewsHref: '/__adapter-test__/reviews',
    legacyUrl: '/__adapter-test__/legacy',
    legacyHref: '/__adapter-test__/legacy',
    detailsUrl: /\/__adapter-test__\/details#details-section$/,
    detailsHref: '/__adapter-test__/details#details-section',
  },
  {
    name: 'hash-only',
    productsUrl: '/__adapter-test__#products',
    reviewsUrl: /\/__adapter-test__#reviews$/,
    reviewsHref: '#reviews',
    legacyUrl: '/__adapter-test__#legacy',
    legacyHref: '#legacy',
    detailsUrl: /\/__adapter-test__#details#details-section$/,
    detailsHref: '#details#details-section',
  },
  {
    name: 'query-key',
    productsUrl: '/__adapter-test__?route=products',
    reviewsUrl: /\/__adapter-test__\?route=reviews$/,
    reviewsHref: '?route=reviews',
    legacyUrl: '/__adapter-test__?route=legacy',
    legacyHref: '?route=legacy',
    detailsUrl: /\/__adapter-test__\?route=details#details-section$/,
    detailsHref: '?route=details#details-section',
  },
];

for (const mode of modes) {
  test(`${mode.name} adapter loads, intercepts links, and follows browser history`, async ({ page }) => {
    await page.goto(mode.legacyUrl);
    await expect(page).toHaveURL(mode.reviewsUrl);
    await expect(page.getByRole('heading', { name: 'Adapter reviews' })).toBeVisible();
    await expect(page).toHaveTitle('Adapter reviews');

    await page.goto(mode.productsUrl);

    await expect(page.getByRole('heading', { name: 'Adapter products' })).toBeVisible();
    await expect(page).toHaveTitle('Adapter products');
    const reviews = page.locator('[data-e2e="reviews-link"]');
    await expect(reviews).toHaveAttribute('href', mode.reviewsHref);
    const legacy = page.locator('[data-e2e="legacy-link"]');
    await expect(legacy).toHaveAttribute('href', mode.legacyHref);
    const details = page.locator('[data-e2e="details-link"]');
    await expect(details).toHaveAttribute('href', mode.detailsHref);

    await page.evaluate(() => { history.scrollRestoration = 'manual'; });
    await details.click();
    await expect(page).toHaveURL(mode.detailsUrl);
    await expect(page.locator('[data-e2e="details-section"]')).toHaveCount(1);
    await expect(page.locator('[data-e2e="details-status"]')).toHaveText('Anchored content ready');
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
    expect(await page.locator('[data-e2e="details-section"]').evaluate(element => element.getBoundingClientRect().top)).toBeLessThan(50);

    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Adapter products' })).toBeVisible();
    await expect(page).toHaveTitle('Adapter products');

    await page.goForward();
    await expect(page).toHaveURL(mode.detailsUrl);
    await expect(page.locator('[data-e2e="details-status"]')).toHaveText('Anchored content ready');
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
    expect(await page.locator('[data-e2e="details-section"]').evaluate(element => element.getBoundingClientRect().top)).toBeLessThan(50);

    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Adapter products' })).toBeVisible();

    await legacy.click();
    await expect(page).toHaveURL(mode.reviewsUrl);
    await expect(page.getByRole('heading', { name: 'Adapter reviews' })).toBeVisible();
    await expect(page).toHaveTitle('Adapter reviews');

    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Adapter products' })).toBeVisible();
    await expect(page).toHaveTitle('Adapter products');

    await page.goForward();
    await expect(page).toHaveURL(mode.reviewsUrl);
    await expect(page.getByRole('heading', { name: 'Adapter reviews' })).toBeVisible();
    await expect(page).toHaveTitle('Adapter reviews');
  });
}
