import { expect, test } from '@playwright/test';

test.describe('router HTML docs features', () => {
  test('overview presents static feature syntax with links to focused examples', async ({ page }) => {
    await page.goto('/');

    const features = page.locator('[data-e2e="overview-features"] .overview-feature');
    await expect(features).toHaveCount(10);
    await expect(features.filter({ hasText: 'Exact & Fallback' }).locator('pre')).toContainText('<au-route path="/products" exact>');
    const swapSyntax = features.filter({ hasText: 'Swap Order' }).locator('pre');
    await expect(swapSyntax).toContainText('swap-order="parallel"');
    await expect(swapSyntax).toContainText('<au-route path="/specs">Specs</au-route>');
    await expect(swapSyntax).toContainText('<au-route path="/reviews">Reviews</au-route>');
    await expect(page.getByRole('link', { name: 'Jump to example' })).toHaveCount(10);
    await expect(page.getByText('Runnable demo')).toHaveCount(0);
    await expect(page.locator('button')).toHaveCount(0);
  });

  test('syntax highlighting gives valued and valueless attributes the same color', async ({ page }) => {
    await page.goto('/');

    const matchingSyntax = page.locator('.overview-feature', { hasText: 'Exact & Fallback' }).locator('pre');
    const pathAttribute = matchingSyntax.locator('.syntax-attribute').filter({ hasText: /^path$/ }).first();
    const exactAttribute = matchingSyntax.locator('.syntax-attribute').filter({ hasText: /^exact$/ });
    const fallbackAttribute = matchingSyntax.locator('.syntax-attribute').filter({ hasText: /^fallback$/ });

    await expect(pathAttribute).toBeVisible();
    await expect(exactAttribute).toBeVisible();
    await expect(fallbackAttribute).toBeVisible();

    const [pathColor, exactColor, fallbackColor] = await Promise.all([
      pathAttribute.evaluate(element => getComputedStyle(element).color),
      exactAttribute.evaluate(element => getComputedStyle(element).color),
      fallbackAttribute.evaluate(element => getComputedStyle(element).color),
    ]);
    expect(exactColor).toBe(pathColor);
    expect(fallbackColor).toBe(pathColor);
  });

  test('dynamic route docs show every supported binding syntax and the shorthand drives repeated routes', async ({ page }) => {
    await page.goto('/features/repeated/demo/list');

    const syntax = page.locator('.feature-details pre');
    await expect(syntax).toContainText('<au-route path.bind="item.path">');
    await expect(syntax).toContainText('<au-route path.to-view="item.path">');
    await expect(syntax).toContainText('<au-route :path="item.path">');
    await expect(page.getByText('Dynamic paths must use')).toContainText('path.bind');
    await expect(page.getByText('Dynamic paths must use')).toContainText('path.to-view');
    await expect(page.getByText('Dynamic paths must use')).toContainText(':path');

    await page.getByRole('button', { name: 'Add repeated route' }).click();
    await expect(page).toHaveURL(/\/features\/repeated\/demo\/generated-1$/);
    await expect(page.locator('.mini-stage')).toContainText('Generated route 1');
  });

  test('nested routes generate relative hrefs and list their registered subtree', async ({ page }) => {
    await page.goto('/features/nested/demo/dashboard');

    const apiExamples = page.locator('[data-e2e="route-api-examples"]');
    await expect(apiExamples).toContainText("$route.href('.')");
    await expect(apiExamples).toContainText('$route.root.href(');
    await expect(apiExamples).toContainText('$route.fullPath');
    await expect(apiExamples).toContainText('$route.$path');
    await expect(apiExamples).toContainText('$route.residue');
    await expect(apiExamples).toContainText('$route.$params.productId');
    await expect(apiExamples).toContainText("$route.parent.href('/specs')");
    await expect(apiExamples).toContainText('$route.root.getPaths()');

    const stage = page.locator('.mini-stage');
    await expect(stage.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/features/nested/demo/dashboard');
    await expect(stage.getByRole('link', { name: 'Logs' })).toHaveAttribute('href', '/features/nested/demo/logs');
    await expect(page.locator('[data-e2e="nested-paths"]')).toContainText('/features/nested/demo/dashboard');
    await expect(page.locator('[data-e2e="nested-paths"]')).toContainText('/features/nested/demo/logs');

    await stage.getByRole('link', { name: 'Logs' }).click();
    await expect(page).toHaveURL(/\/features\/nested\/demo\/logs$/);
    await expect(stage).toContainText('Logs child route is active');
  });

  test('exact and fallback demo responds to parent residue', async ({ page }) => {
    await page.goto('/features/matching/demo/exact');

    await expect(page.locator('[data-e2e="matching-exact"]')).toBeVisible();
    await expect(page.locator('[data-e2e="matching-fallback"]')).toHaveCount(0);

    await page.getByRole('link', { name: 'Extra residue' }).click();
    await expect(page).toHaveURL(/\/features\/matching\/demo\/exact\/details$/);
    await expect(page.locator('[data-e2e="matching-exact"]')).toHaveCount(0);
    await expect(page.locator('[data-e2e="matching-fallback"]')).toBeVisible();

    await page.getByRole('link', { name: 'Prefix match' }).click();
    await expect(page.locator('[data-e2e="matching-prefix"]')).toBeVisible();
    await expect(page.locator('[data-e2e="matching-fallback"]')).toHaveCount(0);

    await page.getByRole('link', { name: 'Missing child' }).click();
    await expect(page.locator('[data-e2e="matching-fallback"]')).toBeVisible();
  });

  test('matching source contains its complete parent route and appears above the stage', async ({ page }) => {
    await page.goto('/features/matching/demo/exact');
    await page.getByRole('button', { name: 'Show source' }).click();

    const source = page.locator('[data-e2e="matching-source"]');
    const stage = page.locator('[data-e2e="matching-stage"]');
    await expect(source).toContainText('<au-route path="/demo">');
    await expect(source).toContainText('<au-route path="*" fallback>');

    const sourceBox = await source.boundingBox();
    const stageBox = await stage.boundingBox();
    expect(sourceBox).not.toBeNull();
    expect(stageBox).not.toBeNull();
    expect(sourceBox.y).toBeLessThan(stageBox.y);
  });

  test('parallel swap demo navigates between its nested sibling routes', async ({ page }) => {
    await page.goto('/features/swap/demo/alpha');

    await expect(page.locator('[data-e2e="parallel-alpha"]')).toBeVisible();
    const overlapSeen = page.waitForFunction(() => {
      const stage = document.querySelector('[data-e2e="parallel-stage"]');
      return stage?.querySelector('[data-au-route-transition="leave"]') != null
        && stage.querySelector('[data-au-route-transition="enter"]') != null;
    });

    await page.getByRole('link', { name: 'Beta', exact: true }).click();
    await overlapSeen;
    await expect(page).toHaveURL(/\/features\/swap\/demo\/beta$/);
    await expect(page.locator('[data-e2e="parallel-beta"]')).toBeVisible();
  });

  test('kitchen sink composes VM scope, let bindings, slots, and nested repeated routes', async ({ page }) => {
    await page.goto('/features/kitchen-sink/demo/sunny/toys');

    await expect(page.locator('[data-e2e="kitchen-heading"]:visible')).toContainText('Sunny Room uses Router HTML');
    await expect(page.locator('[data-e2e="kitchen-section"]')).toContainText('Sunny Room / Toys');
    await expect(page.getByLabel('Sunny Room pages').getByRole('link', { name: 'Toys', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('[data-e2e="kitchen-footer"]')).toContainText('2 pages - No room note yet');

    await page.locator('[data-e2e="kitchen-note"]').fill('Nap after snacks');
    await expect(page.locator('[data-e2e="kitchen-footer"]')).toContainText('2 pages - Nap after snacks');

    await page.getByLabel('Sunny Room pages').getByRole('link', { name: 'Snacks', exact: true }).click();
    await expect(page).toHaveURL(/\/features\/kitchen-sink\/demo\/sunny\/snacks$/);
    await expect(page.locator('[data-e2e="kitchen-section"]')).toContainText('Sunny Room / Snacks');
    await expect(page.getByLabel('Sunny Room pages').getByRole('link', { name: 'Snacks', exact: true })).toHaveAttribute('aria-current', 'page');

    await page.getByRole('link', { name: 'Moon Room', exact: true }).last().click();
    await expect(page).toHaveURL(/\/features\/kitchen-sink\/demo\/moon\/stories$/);
    await expect(page.locator('[data-e2e="kitchen-heading"]')).toContainText('Moon Room uses Router HTML');
    await expect(page.locator('[data-e2e="kitchen-section"]')).toContainText('Moon Room / Stories');

    await expect(page.locator('[data-e2e="kitchen-source-toggle"]')).toHaveCount(1);
    await page.locator('[data-e2e="kitchen-source-toggle"]').click();
    const source = page.locator('[data-e2e="kitchen-source"]');
    await expect(source).toContainText('<let base.bind="\'/features/kitchen-sink/demo/\' + room.id">');
    await expect(source).toContainText('<strong au-slot="heading">');
    await expect(source).toContainText('<template repeat.for="page of room.pages">');
    await expect(source).toContainText('<au-route :path="\'/\' + page.id" exact>');
  });

  test('rapid playroom swaps serialize routed view attachment and removal', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => {
      pageErrors.push(error.message);
    });
    await page.goto('/features/kitchen-sink/demo/sunny/toys');
    await expect(page.locator('[data-e2e="kitchen-heading"]')).toContainText('Sunny Room uses Router HTML');
    const demo = page.locator('[data-e2e="kitchen-demo"]');
    const initialLayout = await demo.evaluate(element => ({
      childElements: element.children.length,
      height: element.getBoundingClientRect().height,
      shells: element.querySelectorAll('kitchen-shell').length,
    }));

    for (let index = 0; index < 6; index++) {
      await page.getByRole('link', { name: 'Moon Room', exact: true }).last().click();
      await expect(page).toHaveURL(/\/features\/kitchen-sink\/demo\/moon\/stories$/);
      await page.waitForTimeout(50);
      expect(pageErrors).toEqual([]);
      await expect(page.locator('[data-e2e="kitchen-heading"]:visible')).toContainText('Moon Room uses Router HTML');
      await page.getByRole('link', { name: 'Sunny Room', exact: true }).last().click();
      await expect(page).toHaveURL(/\/features\/kitchen-sink\/demo\/sunny\/toys$/);
    }

    await expect(page).toHaveURL(/\/features\/kitchen-sink\/demo\/sunny\/toys$/);
    await expect(page.locator('[data-e2e="kitchen-section"]:visible')).toContainText('Sunny Room / Toys');
    await page.waitForTimeout(100);
    await expect(page.locator('[data-e2e="kitchen-source-toggle"]')).toHaveCount(1);
    await expect(page.locator('[data-e2e="kitchen-source-toggle"]')).toBeVisible();
    await expect.poll(() => demo.evaluate(element => ({
      childElements: element.children.length,
      height: element.getBoundingClientRect().height,
      shells: element.querySelectorAll('kitchen-shell').length,
    }))).toEqual(initialLayout);
    expect(pageErrors).toEqual([]);
  });
});
