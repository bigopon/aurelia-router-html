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

    await expect.poll(() => page.evaluate(() => history.scrollRestoration)).toBe('manual');
    await page.evaluate(() => window.scrollTo(0, 700));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(700);
    await details.evaluate(element => element.click());
    await expect(page).toHaveURL(mode.detailsUrl);
    await expect(page.locator('[data-e2e="details-section"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Adapter details' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
    expect(await page.locator('[data-e2e="details-section"]').evaluate(element => element.getBoundingClientRect().top)).toBeLessThan(50);

    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Adapter products' })).toBeVisible();
    await expect(page).toHaveTitle('Adapter products');
    await expect.poll(() => page.evaluate(() => Math.abs(window.scrollY - 700))).toBeLessThan(5);

    await page.goForward();
    await expect(page).toHaveURL(mode.detailsUrl);
    await expect(page.locator('[data-e2e="details-status"]')).toHaveText('Anchored content ready');
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
    expect(await page.locator('[data-e2e="details-section"]').evaluate(element => element.getBoundingClientRect().top)).toBeLessThan(50);

    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Adapter products' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => Math.abs(window.scrollY - 700))).toBeLessThan(5);

    await legacy.evaluate(element => element.click());
    await expect(page).toHaveURL(mode.reviewsUrl);
    await expect(page.getByRole('heading', { name: 'Adapter reviews' })).toBeVisible();
    await expect(page).toHaveTitle('Adapter reviews');
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Adapter products' })).toBeVisible();
    await expect(page).toHaveTitle('Adapter products');
    await expect.poll(() => page.evaluate(() => Math.abs(window.scrollY - 700))).toBeLessThan(5);

    await page.goForward();
    await expect(page).toHaveURL(mode.reviewsUrl);
    await expect(page.getByRole('heading', { name: 'Adapter reviews' })).toBeVisible();
    await expect(page).toHaveTitle('Adapter reviews');
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });
}

test.describe('pathname scroll-restoration policies', () => {
  test('top starts new navigation and browser traversal at the top', async ({ page }) => {
    await page.goto('/__adapter-test__/products?restoration=top');
    await expect(page.getByRole('heading', { name: 'Adapter products' })).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, 700));
    await page.locator('[data-e2e="reviews-link"]').evaluate(element => element.click());
    await expect(page.getByRole('heading', { name: 'Adapter reviews' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

    await page.evaluate(() => window.scrollTo(0, 600));
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Adapter products' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('preserve keeps the current viewport across navigation and traversal', async ({ page }) => {
    await page.goto('/__adapter-test__/products?restoration=preserve');
    await expect(page.getByRole('heading', { name: 'Adapter products' })).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, 700));
    await page.locator('[data-e2e="reviews-link"]').evaluate(element => element.click());
    await expect(page.getByRole('heading', { name: 'Adapter reviews' })).toBeVisible();
    await expect.poll(async () => Math.abs(await page.evaluate(() => window.scrollY) - 700)).toBeLessThan(5);

    await page.evaluate(() => window.scrollTo(0, 900));
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Adapter products' })).toBeVisible();
    await expect.poll(async () => Math.abs(await page.evaluate(() => window.scrollY) - 900)).toBeLessThan(5);
  });

  test('manual leaves regular, hash, and traversal scrolling to application code', async ({ page }) => {
    await page.goto('/__adapter-test__/products?restoration=manual');
    await expect(page.getByRole('heading', { name: 'Adapter products' })).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, 700));
    await page.locator('[data-e2e="details-link"]').evaluate(element => element.click());
    await expect(page.locator('[data-e2e="details-status"]')).toHaveText('Anchored content ready');
    await expect.poll(async () => Math.abs(await page.evaluate(() => window.scrollY) - 700)).toBeLessThan(5);

    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Adapter products' })).toBeVisible();
    await expect.poll(async () => Math.abs(await page.evaluate(() => window.scrollY) - 700)).toBeLessThan(5);
  });

  test('hash false disables target scrolling without disabling restoration', async ({ page }) => {
    await page.goto('/__adapter-test__/products?restoration=restore&hash=false');
    await expect(page.getByRole('heading', { name: 'Adapter products' })).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, 700));
    await page.locator('[data-e2e="details-link"]').evaluate(element => element.click());
    await expect(page.locator('[data-e2e="details-status"]')).toHaveText('Anchored content ready');
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    expect(await page.locator('[data-e2e="details-section"]').evaluate(element => element.getBoundingClientRect().top)).toBeGreaterThan(500);

    await page.evaluate(() => window.scrollTo(0, 450));
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Adapter products' })).toBeVisible();
    await expect.poll(async () => Math.abs(await page.evaluate(() => window.scrollY) - 700)).toBeLessThan(5);
  });

  test('restore gives a saved traversal position precedence over its hash target', async ({ page }) => {
    await page.goto('/__adapter-test__/products');
    await expect(page.getByRole('heading', { name: 'Adapter products' })).toBeVisible();

    await page.locator('[data-e2e="details-link"]').evaluate(element => element.click());
    await expect(page.locator('[data-e2e="details-status"]')).toHaveText('Anchored content ready');
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);

    await page.evaluate(() => window.scrollTo(0, 400));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(400);
    await page.locator('[data-e2e="details-reviews-link"]').evaluate(element => element.click());
    await expect(page.getByRole('heading', { name: 'Adapter reviews' })).toBeVisible();

    await page.goBack();
    await expect(page.locator('[data-e2e="details-status"]')).toHaveText('Anchored content ready');
    await expect.poll(async () => Math.abs(await page.evaluate(() => window.scrollY) - 400)).toBeLessThan(5);
  });
});

test('opt-in focus follows route changes but ignores initial and query-only updates', async ({ page }) => {
  await page.goto('/__adapter-test__/products?focus=true');
  const productsHeading = page.locator('[data-e2e="products-heading"]');
  await expect(productsHeading).toBeVisible();
  await expect(productsHeading).not.toBeFocused();

  await page.locator('[data-e2e="reviews-link"]').evaluate(element => element.click());
  const reviewsHeading = page.locator('[data-e2e="reviews-heading"]');
  await expect(reviewsHeading).toBeFocused();
  await expect(reviewsHeading).toHaveAttribute('tabindex', '-1');

  const reviewAction = page.locator('[data-e2e="review-action"]');
  await reviewAction.focus();
  await page.locator('[data-e2e="review-query-link"]').evaluate(element => element.click());
  await expect(page).toHaveURL(/\/__adapter-test__\/reviews\?sort=new$/);
  await expect(reviewAction).toBeFocused();

  await page.goBack();
  await expect(page).toHaveURL(/\/__adapter-test__\/reviews$/);
  await expect(reviewAction).toBeFocused();

  await page.goBack();
  await expect(productsHeading).toBeFocused();
});
