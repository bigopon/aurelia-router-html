import { expect, test } from '@playwright/test';

test.describe.serial('html-router example app', () => {
  test('A0 initial /products renders the catalog index branch', async ({ page }) => {
    await page.goto('/products');

    await expect(page.locator('[data-e2e="current-path"]')).toContainText('/products');
    await expect(page.locator('[data-e2e="route-products"]')).toBeVisible();
    await expect(page.locator('[data-e2e="products-index"]')).toBeVisible();
    await expect(page.locator('[data-e2e="products-shared-shell"]')).toBeVisible();
    await expect(page.locator('[data-e2e="product-shell"]')).toHaveCount(0);
  });

  test('A0 deep link to promo waits for async data and activates the conditional branch', async ({ page }) => {
    await page.goto('/products/aster-pack/promo');

    await expect(page.locator('[data-e2e="product-shell"]')).toBeVisible();
    await expect(page.locator('[data-e2e="product-loading"]')).toBeVisible();
    await expect(page.locator('[data-e2e="product-promo"]')).toContainText('Aster Travel Pack');
    await expect(page.locator('[data-e2e="product-promo-fallback"]')).toHaveCount(0);
  });

  test('A0 sibling tab navigation keeps the product shell mounted', async ({ page }) => {
    await page.goto('/products/aster-pack/overview');

    await expect(page.locator('[data-e2e="product-shell"]')).toBeVisible();
    await expect(page.locator('[data-e2e="product-overview"]')).toBeVisible();

    await page.getByRole('link', { name: 'Reviews' }).click();
    await expect(page).toHaveURL(/\/products\/aster-pack\/reviews$/);
    await expect(page.locator('[data-e2e="product-shell"]')).toBeVisible();
    await expect(page.locator('[data-e2e="product-reviews-stage"]')).toBeVisible();
    await expect(page.locator('[data-e2e="product-reviews"]')).toBeVisible();

    await page.getByRole('link', { name: 'Specs' }).click();
    await expect(page).toHaveURL(/\/products\/aster-pack\/specs$/);
    await expect(page.locator('[data-e2e="product-shell"]')).toBeVisible();
    await expect(page.locator('[data-e2e="product-specs-stage"]')).toBeVisible();
    await expect(page.locator('[data-e2e="product-specs"]')).toBeVisible();
  });

  test('S1 default swapping avoids an empty child-stage gap during sibling navigation', async ({ page }) => {
    await page.goto('/products/aster-pack/reviews');
    await expect(page.locator('[data-e2e="product-reviews"]')).toBeVisible();

    await page.evaluate(() => {
      const stage = document.querySelector('[data-e2e="product-child-stage"]');
      if (stage == null) {
        throw new Error('Missing product child stage');
      }

      const selectors = [
        '[data-e2e="product-default-overview"]',
        '[data-e2e="product-overview"]',
        '[data-e2e="product-reviews-stage"]',
        '[data-e2e="product-specs-stage"]',
        '[data-e2e="product-related"]',
        '[data-e2e="product-promo"]',
        '[data-e2e="product-flash"]',
      ];

      const countPanels = () => selectors.reduce((count, selector) => count + stage.querySelectorAll(selector).length, 0);
      (window as Window & { __swapProbe?: { sawEmpty: boolean; observer: MutationObserver } }).__swapProbe = {
        sawEmpty: countPanels() === 0,
        observer: new MutationObserver(() => {
          const probe = (window as Window & { __swapProbe?: { sawEmpty: boolean; observer: MutationObserver } }).__swapProbe;
          if (probe != null && countPanels() === 0) {
            probe.sawEmpty = true;
          }
        }),
      };

      (window as Window & { __swapProbe?: { sawEmpty: boolean; observer: MutationObserver } }).__swapProbe?.observer.observe(stage, {
        childList: true,
        subtree: true,
      });
    });

    await page.getByRole('link', { name: 'Specs' }).click();
    await expect(page.locator('[data-e2e="product-specs"]')).toBeVisible();

    const sawEmpty = await page.evaluate(() => {
      const probe = (window as Window & { __swapProbe?: { sawEmpty: boolean; observer: MutationObserver } }).__swapProbe;
      probe?.observer.disconnect();
      return probe?.sawEmpty ?? true;
    });

    expect(sawEmpty).toBe(false);
  });

  test('S2 route animation classes are applied during sibling navigation', async ({ page }) => {
    await page.goto('/products/aster-pack/reviews');
    await expect(page.locator('[data-e2e="product-reviews-stage"]')).toBeVisible();

    const animationSeen = page.waitForFunction(() => {
      const stage = document.querySelector('[data-e2e="product-child-stage"]');
      if (stage == null) {
        return false;
      }

      return stage.querySelector('.au-route-enter-active, .au-route-leave-active, .au-route-animating') != null;
    });

    await page.getByRole('link', { name: 'Specs' }).click();
    await animationSeen;
    await expect(page.locator('[data-e2e="product-specs"]')).toBeVisible();
  });

  test('A1 conditional au-route can be removed while it is active', async ({ page }) => {
    await page.goto('/products/aster-pack/promo');

    await expect(page.locator('[data-e2e="product-promo"]')).toBeVisible();
    await page.locator('[data-e2e="toggle-promo-route"]').click();
    await expect(page.locator('[data-e2e="product-promo"]')).toHaveCount(0);
    await expect(page.locator('[data-e2e="product-promo-fallback"]')).toBeVisible();
  });

  test('A1 repeated-template au-route added later becomes active for current residue', async ({ page }) => {
    await page.goto('/products/aster-pack/flash');

    await expect(page.locator('[data-e2e="product-shell"]')).toBeVisible();
    await expect(page.locator('[data-e2e="product-flash"]')).toHaveCount(0);

    await page.locator('[data-e2e="add-flash-route"]').click();
    await expect(page.locator('[data-e2e="product-flash"]')).toContainText('Flash route');
    await expect(page).toHaveURL(/\/products\/aster-pack\/flash$/);

    await page.locator('[data-e2e="remove-flash-route"]').click();
    await expect(page.locator('[data-e2e="product-flash"]')).toHaveCount(0);
  });

  test('A1 repeated-template route that does not match preserves the active detail', async ({ page }) => {
    await page.goto('/products/aster-pack/overview');

    await expect(page.locator('[data-e2e="product-overview"]')).toBeVisible();
    await page.locator('[data-e2e="add-flash-route"]').click();

    await expect(page.locator('[data-e2e="product-overview"]')).toBeVisible();
    await expect(page.locator('[data-e2e="product-flash"]')).toHaveCount(0);
    await expect(page).toHaveURL(/\/products\/aster-pack\/overview$/);
  });

  test('A1 dynamic path shorthand is captured and interpolation syntax warns in development', async ({ page }) => {
    const warnings: string[] = [];
    page.on('console', message => {
      if (message.type() === 'warning' && message.text().startsWith('[au-route]')) {
        warnings.push(message.text());
      }
    });
    await page.goto('/products');

    const metadata = await page.evaluate(async () => {
      const modulePath = '/router/au-route.ts';
      const { AuRoute } = await (0, eval)(`import(${JSON.stringify(modulePath)})`);
      const processContent = AuRoute.$au.processContent!;
      const read = (name: string, value: string) => {
        const element = document.createElement('au-route');
        element.setAttribute(name, value);
        const data: Record<string, unknown> = {};
        processContent(element, null!, data);
        return data;
      };
      return {
        shorthand: read(':path', 'item.path'),
        interpolation: read('path', '/items/${item.id}'),
      };
    });

    expect(metadata.shorthand.pathExpression).toBe('item.path');
    expect(metadata.shorthand.path).toBe('/__pending_route_path__');
    expect(metadata.interpolation.path).toBe('/items/${item.id}');
    expect(warnings).toContain('[au-route] The path value "/items/${item.id}" looks like an interpolation. Dynamic paths must use path.bind, path.to-view, or :path.');
  });

  test('A2 individual exact route requires a complete path match', async ({ page }) => {
    await page.goto('/about');

    await expect(page.locator('[data-e2e="route-about-exact"]')).toBeVisible();
    await expect(page.locator('[data-e2e="route-fallback"]')).toHaveCount(0);

    await page.goto('/about/team');

    await expect(page.locator('[data-e2e="route-about-exact"]')).toHaveCount(0);
    await expect(page.locator('[data-e2e="route-fallback"]')).toBeVisible();
  });

  test('A2 nested exact route requires a complete parent residue match', async ({ page }) => {
    await page.goto('/matching/exact');

    await expect(page.locator('[data-e2e="route-matching"]')).toBeVisible();
    await expect(page.locator('[data-e2e="nested-exact"]')).toBeVisible();
    await expect(page.locator('[data-e2e="nested-fallback"]')).toHaveCount(0);
    await expect(page.locator('[data-e2e="route-fallback"]')).toHaveCount(0);

    await page.goto('/matching/exact/child');

    await expect(page.locator('[data-e2e="route-matching"]')).toBeVisible();
    await expect(page.locator('[data-e2e="nested-exact"]')).toHaveCount(0);
    await expect(page.locator('[data-e2e="nested-fallback"]')).toBeVisible();
    await expect(page.locator('[data-e2e="route-fallback"]')).toHaveCount(0);
  });

  test('A2 individual fallback route activates only without a root sibling match', async ({ page }) => {
    await page.goto('/not-a-route');

    await expect(page.locator('[data-e2e="route-fallback"]')).toBeVisible();

    await page.goto('/products');
    await expect(page.locator('[data-e2e="route-products"]')).toBeVisible();
    await expect(page.locator('[data-e2e="route-fallback"]')).toHaveCount(0);
  });

  test('A2 nested fallback route uses matches from its parent context', async ({ page }) => {
    await page.goto('/matching/known/detail');

    await expect(page.locator('[data-e2e="route-matching"]')).toBeVisible();
    await expect(page.locator('[data-e2e="nested-known"]')).toBeVisible();
    await expect(page.locator('[data-e2e="nested-fallback"]')).toHaveCount(0);
    await expect(page.locator('[data-e2e="route-fallback"]')).toHaveCount(0);

    await page.goto('/matching/missing');

    await expect(page.locator('[data-e2e="route-matching"]')).toBeVisible();
    await expect(page.locator('[data-e2e="nested-known"]')).toHaveCount(0);
    await expect(page.locator('[data-e2e="nested-fallback"]')).toBeVisible();
    await expect(page.locator('[data-e2e="route-fallback"]')).toHaveCount(0);
  });

  test('A2 exact sibling yields to a wildcard fallback with an exact child', async ({ page }) => {
    await page.goto('/selection/products');

    await expect(page.locator('[data-e2e="selection-products-index"]')).toBeVisible();
    await expect(page.locator('[data-e2e="selection-products-fallback"]')).toHaveCount(0);
    await expect(page.locator('[data-e2e="selection-product-abc"]')).toHaveCount(0);

    await page.goto('/selection/products/abc');

    await expect(page.locator('[data-e2e="selection-products-index"]')).toHaveCount(0);
    await expect(page.locator('[data-e2e="selection-products-fallback"]')).toBeVisible();
    await expect(page.locator('[data-e2e="selection-product-abc"]')).toBeVisible();
    await expect(page.locator('[data-e2e="route-fallback"]')).toHaveCount(0);

    await page.goto('/selection/products/abc/details');

    await expect(page.locator('[data-e2e="selection-products-fallback"]')).toHaveCount(1);
    await expect(page.locator('[data-e2e="selection-product-abc"]')).toHaveCount(0);
    await expect(page.locator('[data-e2e="route-fallback"]')).toHaveCount(0);
  });

  test('A2 rest wildcard consumes the complete residue before matching children', async ({ page }) => {
    await page.goto('/consume/products/abc/details');

    await expect(page.locator('[data-e2e="rest-wildcard"]')).toBeVisible();
    await expect(page.locator('[data-e2e="rest-wildcard-index"]')).toBeVisible();
    await expect(page.locator('[data-e2e="rest-wildcard-consumed-child"]')).toHaveCount(0);
    await expect(page.locator('[data-e2e="route-fallback"]')).toHaveCount(0);
  });

  test('S1 parallel swap overlaps outgoing and incoming route transitions', async ({ page }) => {
    await page.goto('/parallel/alpha');
    await expect(page.locator('[data-e2e="parallel-alpha"]')).toBeVisible();

    const overlapSeen = page.waitForFunction(() => {
      const stage = document.querySelector('[data-e2e="parallel-stage"]');
      return stage?.querySelector('[data-au-route-transition="leave"]') != null
        && stage.querySelector('[data-au-route-transition="enter"]') != null;
    });

    await page.getByRole('link', { name: 'Parallel beta' }).click();
    await overlapSeen;
    await expect(page.locator('[data-e2e="parallel-beta"]')).toBeVisible();
  });

  test('A1 shared cart state updates across detail and cart routes', async ({ page }) => {
    await page.goto('/products/aster-pack/overview');

    await page.locator('[data-e2e="add-detail-to-cart"]').click();
    await expect(page.locator('[data-e2e="cart-count"]')).toContainText('Cart 2');

    await page.goto('/cart');
    await expect(page.locator('[data-e2e="route-cart"]')).toBeVisible();
    await expect(page.locator('[data-e2e="current-path"]')).toContainText('/cart');
    await expect(page.locator('[data-e2e="route-cart"] .summary-item')).toHaveCount(1);
  });

  test('A1 checkout payment branch unlocks after shipping state is complete', async ({ page }) => {
    await page.goto('/checkout/payment');

    await expect(page.locator('[data-e2e="checkout-payment-locked"]')).toBeVisible();

    await page.goto('/checkout/shipping');
    await page.locator('[data-e2e="checkout-email"]').fill('alex@northvale.co');
    await page.locator('[data-e2e="checkout-name"]').fill('Alex North');
    await page.locator('[data-e2e="checkout-address"]').fill('1 Harbour Way, Sydney');
    await page.locator('[data-e2e="checkout-speed"]').selectOption('express');
    await page.locator('[data-e2e="continue-payment"]').click();

    await expect(page).toHaveURL(/\/checkout\/payment$/);
    await expect(page.locator('[data-e2e="checkout-payment"]')).toBeVisible();
  });

  test('A1 lazy account area activates deep-linked order detail after sign-in', async ({ page }) => {
    await page.goto('/account/orders/ord-4102');

    await expect(page.locator('[data-e2e="account-area"]')).toBeVisible();
    await expect(page.locator('[data-e2e="account-signin-prompt"]')).toBeVisible();

    await page.locator('[data-e2e="toggle-account"]').click();
    await expect(page.locator('[data-e2e="account-order-detail"]')).toContainText('ord-4102');
  });
});
