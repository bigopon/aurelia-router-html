import { expect, test } from '@playwright/test';

test.describe('router HTML docs features', () => {
  test('overview presents static feature syntax with links to focused examples', async ({ page }) => {
    await page.goto('/');

    const features = page.locator('[data-e2e="overview-features"] .overview-feature');
    await expect(features).toHaveCount(9);
    await expect(features.filter({ hasText: 'Exact & Fallback' }).locator('pre')).toContainText('<au-route path="/products" exact>');
    const swapSyntax = features.filter({ hasText: 'Swap Order' }).locator('pre');
    await expect(swapSyntax).toContainText('swap-order="parallel"');
    await expect(swapSyntax).toContainText('<au-route path="/specs">Specs</au-route>');
    await expect(swapSyntax).toContainText('<au-route path="/reviews">Reviews</au-route>');
    await expect(page.getByRole('link', { name: 'Jump to example' })).toHaveCount(9);
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
});
