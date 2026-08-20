import { expect, test } from '@playwright/test';

test.describe('router HTML docs features', () => {
  test('analytics waits for consent and preserves a rejection', async ({ page }) => {
    await page.goto('/');

    const notice = page.getByRole('dialog', { name: 'Analytics preference' });
    await expect(notice).toBeVisible();
    await expect(page.locator('#google-analytics')).toHaveCount(0);

    await notice.getByRole('button', { name: 'Reject' }).click();
    await expect(notice).toBeHidden();
    await page.reload();
    await expect(notice).toBeHidden();
    await expect(page.locator('#google-analytics')).toHaveCount(0);

    await page.goto('/privacy');
    await page.getByRole('button', { name: 'Change analytics choice' }).click();
    await expect(notice).toBeVisible();
  });

  test('mobile navigation opens from a burger button and closes after navigation', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const menu = page.getByRole('button', { name: 'Guide' });
    const sidebar = page.locator('#docs-navigation');
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await expect(sidebar).not.toHaveClass(/is-open/);

    await menu.click();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await expect(sidebar).toHaveClass(/is-open/);

    await page.getByRole('link', { name: 'API Cheat Sheet', exact: true }).click();
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await expect(sidebar).not.toHaveClass(/is-open/);
  });

  test('sidebar reveals the active item for an initial deep link', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/features/kitchen-sink');

    const navList = page.locator('#docs-navigation .nav-list');
    const activeItem = navList.getByRole('link', { name: 'Kitchen Sink', exact: true });
    await expect(activeItem).toHaveAttribute('aria-current', 'page');
    await expect.poll(() => navList.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    await expect(activeItem).toBeInViewport();
  });

  test('playground compiles conventions and runs routes in an isolated replaceable preview', async ({ page }) => {
    await page.goto('/playground');

    const preview = page.locator('[data-e2e="playground-preview"]');
    await expect(preview).toHaveAttribute('sandbox', 'allow-scripts');
    await expect(page.getByRole('status')).toContainText('Running', { timeout: 60000 });

    const frame = page.frameLocator('[data-e2e="playground-preview"]');
    await expect(frame.getByRole('heading', { name: 'Build routes where the view lives.' })).toBeVisible();
    await frame.getByRole('link', { name: 'Camera' }).click();
    await expect(page.locator('.playground-preview-panel .preview-label code')).toHaveText('/products/camera');
    await expect(frame.getByRole('heading', { name: 'Product: camera' })).toBeVisible();

    const firstPreview = await preview.elementHandle();
    await page.getByRole('button', { name: 'Run' }).click();
    await expect(page.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const secondPreview = await preview.elementHandle();
    expect(await firstPreview?.evaluate((first, second) => first !== second, secondPreview)).toBe(true);
  });

  test('playground auto-runs edits and switches views without discarding editor state', async ({ page }) => {
    test.setTimeout(90000);
    await page.goto('/playground');
    await expect(page.getByRole('status')).toContainText('Running', { timeout: 60000 });

    await page.getByRole('tab', { name: 'app.html' }).click();
    const editor = page.getByRole('textbox', { name: 'Editing /src/app.html' });
    await editor.fill('<au-route path="/"><h1>Automatic preview</h1></au-route>');
    await expect(page.locator('[data-e2e="auto-run-progress"]')).toHaveClass(/is-counting/);
    await expect(page.getByRole('status')).toContainText('Running', { timeout: 60000 });
    await expect(page.frameLocator('[data-e2e="playground-preview"]').getByRole('heading', { name: 'Automatic preview' })).toBeVisible();

    await page.getByRole('button', { name: 'Code', exact: true }).click();
    await expect(page.locator('.playground-preview-panel')).toBeHidden();

    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(page.locator('.playground-preview-panel')).toBeVisible();

    await page.getByRole('button', { name: 'Split', exact: true }).click();
    await expect(editor).toContainText('Automatic preview');
    await expect(page.locator('.playground-preview-panel')).toBeVisible();
  });

  test('playground reports compiler errors and reset restores the example', async ({ page }) => {
    await page.goto('/playground');
    await expect(page.getByRole('status')).toContainText('Running', { timeout: 60000 });

    await page.getByRole('tab', { name: 'main.ts' }).click();
    const editor = page.getByRole('textbox', { name: 'Editing /src/main.ts' });
    await editor.fill("import missing from 'not-installed';\nconsole.log(missing);");
    await page.getByRole('button', { name: 'Run' }).click();

    await expect(page.getByRole('status')).toContainText('Compilation failed', { timeout: 60000 });
    await expect(page.getByText('Package "not-installed" is not available in this playground.')).toBeVisible();

    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(page.getByRole('status')).toContainText('Running', { timeout: 60000 });
    await expect(editor).toContainText("import Aurelia from 'aurelia';");
  });

  test('playground composes nested, HTML-only, and value-converter conventions', async ({ page }) => {
    await page.goto('/playground/nested-conventions');
    await expect(page.getByRole('status')).toContainText('Running', { timeout: 60000 });

    const frame = page.frameLocator('[data-e2e="playground-preview"]');
    await expect(frame.getByText('HTML-only element')).toBeVisible();

    await page.getByRole('tab', { name: 'status-card.html' }).click();
    const editor = page.getByRole('textbox', { name: 'Editing /src/status-card.html' });
    await editor.fill('<template bindable="name"><article><strong>${name}</strong><span>Healthy</span></article></template>');
    await page.getByRole('button', { name: 'Run' }).click();
    await expect(page.getByRole('status')).toContainText('Running', { timeout: 60000 });
    await expect(frame.getByText('Healthy').first()).toBeVisible();
  });

  test('playground relays runtime errors from the isolated preview', async ({ page }) => {
    await page.goto('/playground');
    await expect(page.getByRole('status')).toContainText('Running', { timeout: 60000 });

    await page.getByRole('tab', { name: 'main.ts' }).click();
    const editor = page.getByRole('textbox', { name: 'Editing /src/main.ts' });
    await editor.fill("setTimeout(() => { throw new Error('Playground boom'); }, 0);");
    await page.getByRole('button', { name: 'Run' }).click();

    await expect(page.locator('.playground-output-grid').getByText('Playground boom')).toBeVisible();
  });

  test('an overview edit link opens its matching runnable source', async ({ page }) => {
    await page.goto('/');
    const basic = page.locator('[data-e2e="overview-features"] .overview-feature').filter({ hasText: 'Basic Routes' });

    await basic.getByRole('link', { name: 'Edit in playground' }).click();

    await expect(page).toHaveURL(/\/playground\/basic-routes$/);
    await expect(page.getByLabel('Example')).toHaveValue('basic-routes');
    await expect(page.getByRole('status')).toContainText('Running', { timeout: 60000 });
  });

  test('feature pages embed the matching editable source and preview', async ({ page }) => {
    await page.goto('/features/repeated');

    const playground = page.locator('.playground-page.is-embedded');
    await expect(playground.getByRole('status')).toContainText('Running', { timeout: 60000 });

    const frame = playground.frameLocator('[data-e2e="playground-preview"]');
    await frame.getByRole('link', { name: 'Activity' }).click();
    await expect(playground.locator('.preview-label code')).toHaveText('/activity');
    await expect(frame.getByRole('heading', { name: 'Activity' })).toBeVisible();

    await playground.getByRole('textbox', { name: 'Editing /src/app.html' }).fill(
      '<au-route path="overview"><h1>Edited embedded preview</h1></au-route>',
    );
    await playground.getByRole('button', { name: 'Run' }).click();
    await expect(playground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    await expect(frame.getByRole('heading', { name: 'Edited embedded preview' })).toBeVisible();
  });

  test('hash-scrolling guide runs its delayed target example', async ({ page }) => {
    await page.goto('/features/hash-scrolling');
    await expect(page.getByRole('status')).toContainText('Running', { timeout: 60000 });

    const frame = page.frameLocator('[data-e2e="playground-preview"]');
    await expect(frame.getByRole('heading', { name: 'Documentation home' })).toBeVisible();
    await frame.getByRole('link', { name: 'Static API link' }).click();

    await expect(page.locator('.playground-preview-panel .preview-label code')).toHaveText('/guide#api-reference');
    await expect(frame.getByRole('heading', { name: 'API reference' })).toBeVisible();
  });

  test('focus-management guide moves focus only when a new route view attaches', async ({ page }) => {
    await page.goto('/features/focus');

    const playground = page.locator('.playground-page.is-embedded');
    await expect(playground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const frame = playground.frameLocator('[data-e2e="playground-preview"]');
    const welcome = frame.getByRole('heading', { name: 'Welcome' });
    await expect(welcome).not.toBeFocused();

    await frame.getByRole('link', { name: 'Account' }).click();
    const account = frame.getByRole('heading', { name: 'Account settings' });
    await expect(account).toBeVisible();

    const security = frame.getByRole('link', { name: 'Show security settings' });
    await security.focus();
    await security.evaluate(element => element.click());
    await expect(playground.locator('.preview-label code')).toContainText('panel=security');
  });

  test('an embedded playground recreates its compiler and preview after reattachment', async ({ page }) => {
    await page.goto('/features/basic');

    let playground = page.locator('.playground-page.is-embedded');
    await expect(playground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    await expect(playground.frameLocator('[data-e2e="playground-preview"]').getByRole('heading', { name: 'Welcome' })).toBeVisible();

    await page.getByRole('link', { name: 'Overview', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole('link', { name: 'Basic Routes', exact: true }).click();
    await expect(page).toHaveURL(/\/features\/basic$/);

    playground = page.locator('.playground-page.is-embedded');
    await expect(playground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    await expect(playground.frameLocator('[data-e2e="playground-preview"]').getByRole('heading', { name: 'Welcome' })).toBeVisible();
  });

  test('nested routes embedded project navigates between child views', async ({ page }) => {
    await page.goto('/features/nested');

    const playground = page.locator('.playground-page.is-embedded');
    await expect(playground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const frame = playground.frameLocator('[data-e2e="playground-preview"]');
    await expect(frame.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await frame.getByRole('link', { name: 'Security' }).click();
    await expect(frame.getByRole('heading', { name: 'Security' })).toBeVisible();
  });

  test('nested parameter views keep local params scoped to their own route', async ({ page }) => {
    await page.goto('/features/params');

    const playground = page.locator('.playground-page.is-embedded');
    await expect(playground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const frame = playground.frameLocator('[data-e2e="playground-preview"]');
    await expect(frame.getByRole('heading', { name: 'Parent user: ada' })).toBeVisible();
    await expect(frame.getByRole('heading', { name: 'Child post: routing-basics' })).toBeVisible();

    await frame.getByRole('link', { name: 'Grace / Compilers' }).click();
    await expect(frame.getByRole('heading', { name: 'Parent user: grace' })).toBeVisible();
    await expect(frame.getByRole('heading', { name: 'Child post: compiler-design' })).toBeVisible();
  });

  test('segment constraints select required, optional, and middle parameter routes', async ({ page }) => {
    await page.goto('/features/segment-constraints');

    const playground = page.locator('.playground-page.is-embedded');
    await expect(playground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const frame = playground.frameLocator('[data-e2e="playground-preview"]');
    await expect(frame.getByRole('heading', { name: 'Numeric product 42' })).toBeVisible();

    await frame.getByRole('link', { name: 'Named product' }).click();
    await expect(frame.getByRole('heading', { name: 'Named product ice-cream' })).toBeVisible();

    await frame.getByRole('link', { name: 'No matching constraint' }).click();
    await expect(frame.getByRole('heading', { name: 'No constrained route matched' })).toBeVisible();

    await frame.getByRole('link', { name: 'All archive years' }).click();
    await expect(frame.getByRole('heading', { name: 'Archive all years' })).toBeVisible();
    await frame.getByRole('link', { name: 'Archive 2026' }).click();
    await expect(frame.getByRole('heading', { name: 'Archive 2026' })).toBeVisible();

    await frame.getByRole('link', { name: 'Daily summary' }).click();
    await expect(frame.getByRole('heading', { name: 'Summary for 2026-08-17' })).toBeVisible();
  });

  test('query and hash state change without changing the matched route', async ({ page }) => {
    await page.goto('/features/url-state');

    const playgrounds = page.locator('.playground-page.is-embedded');
    const playground = playgrounds.nth(0);
    await expect(playground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const frame = playground.frameLocator('[data-e2e="playground-preview"]');
    await expect(frame.getByRole('heading', { name: 'Product: ice-cream' })).toBeVisible();

    await frame.getByRole('link', { name: 'Price details' }).click();
    await expect(playground.locator('.preview-label code')).toHaveText('/products/ice-cream?sort=price#details');

    const hashPlayground = playgrounds.nth(1);
    await expect(hashPlayground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const hashFrame = hashPlayground.frameLocator('[data-e2e="playground-preview"]');
    await hashFrame.getByRole('link', { name: 'Reviews' }).click();
    await expect(hashPlayground.locator('.preview-label code')).toHaveText('#products/ice-cream/reviews');
    await expect(hashFrame.getByText('Ice cream reviews')).toBeVisible();

    const queryPlayground = playgrounds.nth(2);
    await expect(queryPlayground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const queryFrame = queryPlayground.frameLocator('[data-e2e="playground-preview"]');
    await queryFrame.getByRole('link', { name: 'Reviews' }).click();
    await expect(queryPlayground.locator('.preview-label code')).toHaveText('?app=products/ice-cream/reviews');
    await expect(queryFrame.getByText('Ice cream reviews')).toBeVisible();
  });

  test('active links update pathname, query, hash, and docs navigation state', async ({ page }) => {
    await page.goto('/features/active-links');

    const activeDocsLink = page.getByRole('link', { name: 'Active Links', exact: true });
    await expect(activeDocsLink).toHaveAttribute('aria-current', 'page');

    const playground = page.locator('.playground-page.is-embedded');
    await expect(playground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const frame = playground.frameLocator('[data-e2e="playground-preview"]');
    const overview = frame.getByRole('link', { name: 'Overview' });
    const lowLevel = frame.getByRole('link', { name: 'Low-level reviews' });

    await overview.click();
    await expect(playground.locator('.preview-label code')).toHaveText('/products/ice-cream/overview');

    await lowLevel.click();
    await expect(playground.locator('.preview-label code')).toHaveText('/products/ice-cream/reviews');

    await page.getByRole('link', { name: 'Basic Routes', exact: true }).click();
    await expect(page).toHaveURL(/\/features\/basic$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/features\/active-links$/);
  });

  test('exact, fallback, and parallel swap fixtures run inside their pages', async ({ page }) => {
    await page.goto('/features/matching');
    let playground = page.locator('.playground-page.is-embedded');
    await expect(playground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    let frame = playground.frameLocator('[data-e2e="playground-preview"]');
    await expect(frame.getByRole('heading', { name: 'Product catalog' })).toBeVisible();
    await frame.getByRole('link', { name: 'Offers', exact: true }).click();
    await expect(frame.getByRole('heading', { name: 'Offer: all offers' })).toBeVisible();
    await frame.getByRole('link', { name: 'Summer offer' }).click();
    await expect(frame.getByRole('heading', { name: 'Offer: summer' })).toBeVisible();
    await frame.getByRole('link', { name: 'Missing' }).click();
    await expect(frame.getByRole('heading', { name: 'Nothing matched this URL' })).toBeVisible();

    await page.goto('/features/swap');
    playground = page.locator('.playground-page.is-embedded');
    await expect(playground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    frame = playground.frameLocator('[data-e2e="playground-preview"]');
    await expect(frame.getByRole('heading', { name: 'Specs' })).toBeVisible();
    await frame.getByRole('link', { name: 'Reviews' }).click();
    await expect(frame.getByRole('heading', { name: 'Reviews' })).toBeVisible();
  });

  test('single and terminal wildcard fixtures capture their own path values', async ({ page }) => {
    await page.goto('/features/wildcards');
    const playground = page.locator('.playground-page.is-embedded');
    await expect(playground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const frame = playground.frameLocator('[data-e2e="playground-preview"]');

    await expect(frame.getByRole('heading', { name: 'Daily summary' })).toBeVisible();
    await frame.getByRole('link', { name: 'Folder guide' }).click();
    await expect(frame.getByRole('heading', { name: 'Single folder route' })).toBeVisible();
    await frame.getByRole('link', { name: 'Terminal file path' }).click();
    await expect(frame.getByRole('heading', { name: 'Terminal file route' })).toBeVisible();
  });

  test('memory adapter fixture navigates and restores history without browser URLs', async ({ page }) => {
    await page.goto('/features/adapters');

    const playground = page.locator('.playground-page.is-embedded');
    await expect(playground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const frame = playground.frameLocator('[data-e2e="playground-preview"]');

    await expect(frame.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await frame.getByRole('link', { name: 'Reports' }).click();
    await expect(frame.getByRole('heading', { name: 'Reports' })).toBeVisible();
    await frame.getByRole('button', { name: 'Back' }).click();
    await expect(frame.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('programmatic navigation uses the contextual route API', async ({ page }) => {
    await page.goto('/features/programmatic');

    const playground = page.locator('.playground-page.is-embedded');
    await expect(playground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const frame = playground.frameLocator('[data-e2e="playground-preview"]');
    await frame.getByRole('button', { name: 'Open camera reviews' }).click();
    await expect(frame.getByRole('heading', { name: 'camera reviews' })).toBeVisible();
    await expect(frame.getByText('Sort: recent')).toBeVisible();
    await expect(frame.getByText('Section: comments')).toBeVisible();
  });

  test('page titles compose nested static and bound metadata in the real browser', async ({ page }) => {
    await page.goto('/features/titles');
    await expect(page).toHaveTitle('Page Titles | Aurelia Router HTML');

    const playground = page.locator('.playground-page.is-embedded');
    await expect(playground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const preview = page.frames().find(frame => frame !== page.mainFrame());
    expect(preview).toBeDefined();
    const visibleTitle = playground.locator('[data-e2e="preview-title"]');
    await expect(visibleTitle).toHaveText('Products · Camera details');
    await preview.getByRole('button', { name: 'Change title' }).click();
    await expect(visibleTitle).toHaveText('Products · Mirrorless camera');
    await preview.getByRole('link', { name: 'Lens' }).click();
    await expect(visibleTitle).toHaveText('Products · Lens details');
  });

  test('route lifecycle guide demonstrates entry, rerun, and replacement', async ({ page }) => {
    await page.goto('/features/lifecycle');

    const playground = page.locator('.playground-page.is-embedded');
    await expect(playground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const frame = playground.frameLocator('[data-e2e="playground-preview"]');
    await frame.getByRole('link', { name: 'Alpha board' }).click();
    await expect(frame.getByRole('heading', { name: 'Project board alpha' })).toBeVisible();

    const draft = frame.getByRole('textbox', { name: 'Local draft' });
    await draft.fill('Preserve this draft');
    await frame.getByRole('link', { name: 'Beta board' }).click();
    await expect(frame.getByRole('heading', { name: 'Project board beta' })).toBeVisible();
    await expect(draft).toHaveValue('Preserve this draft');

    await frame.getByRole('link', { name: 'Alpha card' }).click();
    await expect(frame.getByRole('heading', { name: 'Project card alpha' })).toBeVisible();
    const note = frame.getByRole('textbox', { name: 'Local note' });
    await note.fill('Discard this note');
    await frame.getByRole('link', { name: 'Beta card' }).click();
    await expect(frame.getByRole('heading', { name: 'Project card beta' })).toBeVisible();
    await expect(note).toHaveValue('This resets when the view is replaced');
  });

  test('navigation guard guide cancels, approves, and redirects in its embedded playground', async ({ page }) => {
    await page.goto('/features/guards');

    const playground = page.locator('.playground-page.is-embedded').first();
    await expect(playground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const frame = playground.frameLocator('[data-e2e="playground-preview"]');

    await frame.getByRole('link', { name: 'Account' }).click();
    await expect(frame.getByRole('heading', { name: 'Home' })).toBeVisible();
    await expect(frame.getByRole('status')).toHaveText('Access denied');

    await frame.getByRole('button', { name: 'Allow account' }).click();
    await frame.getByRole('link', { name: 'Account' }).click();
    await expect(frame.getByRole('heading', { name: 'Account' })).toBeVisible();

    await frame.getByRole('link', { name: 'Admin' }).click();
    await expect(frame.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('guard failure modes compare atomic cancellation with nested local recovery', async ({ page }) => {
    await page.goto('/features/guard-failure');

    const layeredPlayground = page.locator('.playground-page.is-embedded');
    await expect(layeredPlayground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const layeredFrame = layeredPlayground.frameLocator('[data-e2e="playground-preview"]');

    await layeredFrame.getByRole('link', { name: 'Member portal' }).click();
    await expect(layeredFrame.getByRole('heading', { name: 'Sign in' })).toBeVisible();

    await layeredFrame.getByRole('button', { name: 'Use member' }).click();
    await layeredFrame.getByRole('link', { name: 'Member portal' }).click();
    await expect(layeredFrame.getByRole('heading', { name: 'Member profile' })).toBeVisible();
    await layeredFrame.getByRole('link', { name: 'Open staff area' }).click();
    await expect(layeredFrame.getByRole('heading', { name: 'Staff access denied' })).toBeVisible();

    await layeredFrame.getByRole('button', { name: 'Use staff' }).click();
    await layeredFrame.getByRole('link', { name: 'Home' }).click();
    await layeredFrame.getByRole('link', { name: 'Member portal' }).click();
    await layeredFrame.getByRole('link', { name: 'Open staff area' }).click();
    await expect(layeredFrame.getByRole('heading', { name: 'Staff reports' })).toBeVisible();

    await layeredFrame.getByRole('link', { name: 'Administration' }).click();
    await expect(layeredFrame.getByRole('heading', { name: 'Administration access denied' })).toBeVisible();

    await layeredFrame.getByRole('button', { name: 'Use admin' }).click();
    await layeredFrame.getByRole('link', { name: 'Home' }).click();
    await layeredFrame.getByRole('link', { name: 'Member portal' }).click();
    await layeredFrame.getByRole('link', { name: 'Open staff area' }).click();
    await layeredFrame.getByRole('link', { name: 'Administration' }).click();
    await expect(layeredFrame.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });

  test('error recovery guide retains its parent, exposes failure details, and retries cleanly', async ({ page }) => {
    await page.goto('/features/error-recovery');

    const sourceExample = page.locator('[data-e2e="source-error-example"]');
    const sourcePlayground = sourceExample.locator('.playground-page');
    await expect(sourcePlayground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const sourceFrame = sourcePlayground.frameLocator('[data-e2e="playground-preview"]');
    await sourceFrame.getByRole('link', { name: 'Reports' }).click();
    await expect(sourceFrame.getByRole('heading', { name: 'Reports could not load' })).toBeVisible();
    await expect(sourceFrame.getByRole('status')).toHaveText('Reports handled its own loading failure');

    const parentExample = page.locator('[data-e2e="parent-error-example"]');
    const parentPlayground = parentExample.locator('.playground-page');
    await expect(parentPlayground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const parentFrame = parentPlayground.frameLocator('[data-e2e="playground-preview"]');
    await parentFrame.getByRole('link', { name: 'Reports' }).click();
    await expect(parentFrame.getByRole('heading', { name: 'Workspace recovery' })).toBeVisible();
    await expect(parentFrame.getByRole('status')).toHaveText('Workspace handled /reports');

    const grandparentExample = page.locator('[data-e2e="grandparent-error-example"]');
    const grandparentPlayground = grandparentExample.locator('.playground-page');
    await expect(grandparentPlayground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const grandparentFrame = grandparentPlayground.frameLocator('[data-e2e="playground-preview"]');
    await grandparentFrame.getByRole('link', { name: 'Reports' }).click();
    await expect(grandparentFrame.getByRole('heading', { name: 'Portal recovery' })).toBeVisible();
    await expect(grandparentFrame.getByRole('status')).toHaveText('Portal handled /reports');

    await sourceFrame.getByRole('button', { name: 'Allow reports retry' }).click();
    await sourceFrame.getByRole('link', { name: 'Home' }).click();
    await sourceFrame.getByRole('link', { name: 'Reports' }).click();
    await expect(sourceFrame.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible();
  });

  test('kitchen sink uses one editable source for scopes, slots, and repeated routes', async ({ page }) => {
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
