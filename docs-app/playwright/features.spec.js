import { expect, test } from '@playwright/test';

test.describe('router HTML docs features', () => {
  test('analytics consent persists and can be reopened', async ({ page }) => {
    await page.goto('/');

    const notice = page.getByRole('dialog', { name: 'Analytics preference' });
    await expect(notice).toBeVisible();
    await expect(page.locator('#google-analytics')).toHaveCount(0);

    await notice.getByRole('button', { name: 'Reject' }).click();
    await expect(notice).toBeHidden();
    await page.reload();
    await expect(notice).toBeHidden();

    await page.goto('/privacy');
    await page.getByRole('button', { name: 'Change analytics choice' }).click();
    await expect(notice).toBeVisible();
  });

  test('docs shell navigation works on mobile and deep links highlight the active item', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const menu = page.getByRole('button', { name: 'Guide' });
    const sidebar = page.locator('#docs-navigation');
    await expect(menu).toHaveAttribute('aria-expanded', 'false');

    await menu.click();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await expect(sidebar).toHaveClass(/is-open/);

    await page.getByRole('link', { name: 'Kitchen Sink', exact: true }).click();
    await expect(menu).toHaveAttribute('aria-expanded', 'false');

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/features/kitchen-sink');
    const activeItem = page.locator('#docs-navigation .nav-list').getByRole('link', { name: 'Kitchen Sink', exact: true });
    await expect(activeItem).toHaveAttribute('aria-current', 'page');
    await expect(activeItem).toBeInViewport();
  });

  test('standalone playground runs routes and replaces the preview iframe on rerun', async ({ page }) => {
    await page.goto('/playground');

    const preview = page.locator('[data-e2e="playground-preview"]');
    await expect(preview).toHaveAttribute('sandbox', 'allow-scripts');
    await expect(page.getByRole('status')).toContainText('Running', { timeout: 60000 });

    const frame = page.frameLocator('[data-e2e="playground-preview"]');
    await frame.getByRole('link', { name: 'Camera' }).click();
    await expect(page.locator('.playground-preview-panel .preview-label code')).toHaveText('/products/camera');
    await expect(frame.getByRole('heading', { name: 'Product: camera' })).toBeVisible();

    const firstPreview = await preview.elementHandle();
    await page.getByRole('button', { name: 'Run' }).click();
    await expect(page.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const secondPreview = await preview.elementHandle();
    expect(await firstPreview?.evaluate((first, second) => first !== second, secondPreview)).toBe(true);
  });

  test('playground auto-run, compiler reset, and runtime error reporting still work', async ({ page }) => {
    test.setTimeout(90000);
    await page.goto('/playground');
    await expect(page.getByRole('status')).toContainText('Running', { timeout: 60000 });

    await page.getByRole('tab', { name: 'app.html' }).click();
    const appEditor = page.getByRole('textbox', { name: 'Editing /src/app.html' });
    await appEditor.fill('<au-route path="/"><h1>Automatic preview</h1></au-route>');
    await expect(page.locator('[data-e2e="auto-run-progress"]')).toHaveClass(/is-counting/);
    await expect(page.frameLocator('[data-e2e="playground-preview"]').getByRole('heading', { name: 'Automatic preview' })).toBeVisible();

    await page.getByRole('tab', { name: 'main.ts' }).click();
    const tsEditor = page.getByRole('textbox', { name: 'Editing /src/main.ts' });
    await tsEditor.fill("import missing from 'not-installed';\nconsole.log(missing);");
    await page.getByRole('button', { name: 'Run' }).click();
    await expect(page.getByRole('status')).toContainText('Compilation failed', { timeout: 60000 });

    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(page.getByRole('status')).toContainText('Running', { timeout: 60000 });

    await tsEditor.fill("setTimeout(() => { throw new Error('Playground boom'); }, 0);");
    await page.getByRole('button', { name: 'Run' }).click();
    await expect(page.locator('.playground-output-grid').getByText('Playground boom')).toBeVisible();
  });

  test('overview edit links open the matching runnable example', async ({ page }) => {
    await page.goto('/');
    const basic = page.locator('[data-e2e="overview-features"] .overview-feature').filter({ hasText: 'Basic Routes' });

    await basic.getByRole('link', { name: 'Edit in playground' }).click();

    await expect(page).toHaveURL(/\/playground\/basic-routes$/);
    await expect(page.getByLabel('Example')).toHaveValue('basic-routes');
    await expect(page.getByRole('status')).toContainText('Running', { timeout: 60000 });
  });

  test('embedded playgrounds can run edited source and survive page reattachment', async ({ page }) => {
    await page.goto('/features/repeated');

    let playground = page.locator('.playground-page.is-embedded');
    await expect(playground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    let frame = playground.frameLocator('[data-e2e="playground-preview"]');
    await frame.getByRole('link', { name: 'Activity' }).click();
    await expect(frame.getByRole('heading', { name: 'Activity' })).toBeVisible();

    await playground.getByRole('textbox', { name: 'Editing /src/app.html' }).fill(
      '<au-route path="overview"><h1>Edited embedded preview</h1></au-route>',
    );
    await playground.getByRole('button', { name: 'Run' }).click();
    await expect(frame.getByRole('heading', { name: 'Edited embedded preview' })).toBeVisible();

    await page.goto('/features/basic');
    playground = page.locator('.playground-page.is-embedded');
    await expect(playground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    frame = playground.frameLocator('[data-e2e="playground-preview"]');
    await expect(frame.getByRole('heading', { name: 'Welcome' })).toBeVisible();

    await page.getByRole('link', { name: 'Overview', exact: true }).click();
    await page.getByRole('link', { name: 'Basic Routes', exact: true }).click();
    playground = page.locator('.playground-page.is-embedded');
    await expect(playground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    await expect(playground.frameLocator('[data-e2e="playground-preview"]').getByRole('heading', { name: 'Welcome' })).toBeVisible();
  });

  test('multi-playground feature pages still wire independent previews correctly', async ({ page }) => {
    await page.goto('/features/url-state');

    const playgrounds = page.locator('.playground-page.is-embedded');

    const pathPlayground = playgrounds.nth(0);
    await expect(pathPlayground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const pathFrame = pathPlayground.frameLocator('[data-e2e="playground-preview"]');
    await pathFrame.getByRole('link', { name: 'Price details' }).click();
    await expect(pathPlayground.locator('.preview-label code')).toHaveText('/products/ice-cream?sort=price#details');

    const hashPlayground = playgrounds.nth(1);
    await expect(hashPlayground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const hashFrame = hashPlayground.frameLocator('[data-e2e="playground-preview"]');
    await hashFrame.getByRole('link', { name: 'Reviews' }).click();
    await expect(hashPlayground.locator('.preview-label code')).toHaveText('#products/ice-cream/reviews');

    const queryPlayground = playgrounds.nth(2);
    await expect(queryPlayground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const queryFrame = queryPlayground.frameLocator('[data-e2e="playground-preview"]');
    await queryFrame.getByRole('link', { name: 'Reviews' }).click();
    await expect(queryPlayground.locator('.preview-label code')).toHaveText('?app=products/ice-cream/reviews');
  });

  test('interactive feature examples still cover focus or scroll style browser integration', async ({ page }) => {
    await page.goto('/features/hash-scrolling');
    await expect(page.getByRole('status')).toContainText('Running', { timeout: 60000 });
    let frame = page.frameLocator('[data-e2e="playground-preview"]');
    await frame.getByRole('link', { name: 'Static API link' }).click();
    await expect(frame.getByRole('heading', { name: 'API reference' })).toBeVisible();

    await page.goto('/features/focus');
    const playground = page.locator('.playground-page.is-embedded');
    await expect(playground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    frame = playground.frameLocator('[data-e2e="playground-preview"]');
    await frame.getByRole('link', { name: 'Account' }).click();
    await expect(frame.getByRole('heading', { name: 'Account settings' })).toBeVisible();
    await frame.getByRole('link', { name: 'Show security settings' }).click();
    await expect(playground.locator('.preview-label code')).toContainText('panel=security');
  });

  test('guards and error recovery examples still handle blocked and recovered navigation', async ({ page }) => {
    await page.goto('/features/guards');

    let playground = page.locator('.playground-page.is-embedded').first();
    await expect(playground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    let frame = playground.frameLocator('[data-e2e="playground-preview"]');
    await frame.getByRole('link', { name: 'Account' }).click();
    await expect(frame.getByRole('status')).toHaveText('Access denied');
    await frame.getByRole('button', { name: 'Allow account' }).click();
    await frame.getByRole('link', { name: 'Account' }).click();
    await expect(frame.getByRole('heading', { name: 'Account' })).toBeVisible();

    await page.goto('/features/error-recovery');
    const sourceExample = page.locator('[data-e2e="source-error-example"] .playground-page');
    await expect(sourceExample.getByRole('status')).toContainText('Running', { timeout: 60000 });
    frame = sourceExample.frameLocator('[data-e2e="playground-preview"]');
    await frame.getByRole('link', { name: 'Reports' }).click();
    await expect(frame.getByRole('heading', { name: 'Reports could not load' })).toBeVisible();
    await frame.getByRole('button', { name: 'Allow reports retry' }).click();
    await frame.getByRole('link', { name: 'Home' }).click();
    await frame.getByRole('link', { name: 'Reports' }).click();
    await expect(frame.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible();
  });

  test('kitchen sink embedded app still supports sign-in and nested workspace navigation', async ({ page }) => {
    await page.goto('/features/kitchen-sink');

    const playground = page.locator('.playground-page.is-embedded');
    await expect(playground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const frame = playground.frameLocator('[data-e2e="playground-preview"]');

    await expect(frame.getByRole('heading', { name: 'Welcome' })).toBeVisible();
    await frame.getByRole('link', { name: 'Sign in' }).click();
    await expect(frame.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await frame.locator('select').selectOption({ index: 1 });
    await frame.getByRole('button', { name: 'Sign in' }).click();
    await expect(frame.getByText('Aurora Ops workspace')).toBeVisible();
    await frame.getByRole('link', { name: 'Ada Lovelace' }).click();
    await expect(frame.getByRole('heading', { name: 'Edit Ada Lovelace' })).toBeVisible();
    await expect(playground.locator('.console-entry.error')).toHaveCount(0);
  });
});
