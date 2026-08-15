import { expect, test } from '@playwright/test';

test.describe('router HTML docs features', () => {
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
