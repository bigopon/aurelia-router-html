import { expect, test } from '@playwright/test';

test.describe('router HTML docs features', () => {
  test('playground compiles conventions and runs routes in an isolated replaceable preview', async ({ page }) => {
    await page.goto('/playground');

    const preview = page.locator('[data-e2e="playground-preview"]');
    await expect(preview).toHaveAttribute('sandbox', 'allow-scripts');
    await expect(page.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const highlightedTokens = page.locator('.code-editor .cm-content span');
    await expect(highlightedTokens.first()).toBeVisible();
    const tokenColors = await highlightedTokens.evaluateAll(tokens => [
      ...new Set(tokens.map(token => getComputedStyle(token).color)),
    ]);
    expect(tokenColors.length).toBeGreaterThan(1);
    const firstLineTop = await page.locator('.code-editor .cm-line').first().evaluate(element => element.getBoundingClientRect().top);
    const firstLineNumberTop = await page.locator('.code-editor .cm-lineNumbers .cm-gutterElement')
      .nth(1)
      .evaluate(element => element.getBoundingClientRect().top);
    expect(Math.abs(firstLineTop - firstLineNumberTop)).toBeLessThan(2);
    const firstLineNumberMargin = await page.locator('.code-editor .cm-lineNumbers .cm-gutterElement')
      .nth(1)
      .evaluate(element => element.style.marginTop);
    expect(firstLineNumberMargin).not.toBe('16px');

    const frame = page.frameLocator('[data-e2e="playground-preview"]');
    await expect(frame.getByRole('heading', { name: 'Build routes where the view lives.' })).toBeVisible();
    await frame.getByRole('link', { name: 'Camera' }).click();
    await expect(page.locator('.playground-preview-panel .preview-label code')).toHaveText('/products/camera');
    await expect(page.getByRole('status')).not.toContainText('/products/camera');
    await expect(frame.getByRole('heading', { name: 'Product: camera' })).toBeVisible();

    const firstPreview = await preview.elementHandle();
    await page.getByRole('button', { name: 'Run' }).click();
    await expect(page.getByRole('status')).toContainText('Running', { timeout: 60000 });
    await expect(preview).toHaveCount(1);
    const secondPreview = await preview.elementHandle();
    expect(await firstPreview?.evaluate((first, second) => first !== second, secondPreview)).toBe(true);
  });

  test('playground auto-runs edits and switches views without discarding editor state', async ({ page }) => {
    test.setTimeout(90000);
    await page.goto('/playground');
    await expect(page.getByRole('status')).toContainText('Running', { timeout: 60000 });

    await expect(page.locator('.playground-workspace')).toHaveClass(/view-split/);
    await page.getByRole('tab', { name: 'app.html' }).click();
    const editor = page.getByRole('textbox', { name: 'Editing /src/app.html' });
    await expect(editor).toBeVisible();
    await editor.fill('<au-route path="/"><h1>Automatic preview</h1></au-route>');
    await expect(page.locator('[data-e2e="auto-run-progress"]')).toHaveClass(/is-counting/);
    await expect(page.getByRole('status')).toContainText('Changes pending');
    await expect(page.getByRole('status')).toContainText('Running', { timeout: 60000 });
    await expect(page.frameLocator('[data-e2e="playground-preview"]').getByRole('heading', { name: 'Automatic preview' })).toBeVisible();

    await page.getByRole('button', { name: 'Code', exact: true }).click();
    await expect(page.locator('.playground-editor-panel')).toBeVisible();
    await expect(page.locator('.playground-preview-panel')).toBeHidden();

    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(page.locator('.playground-editor-panel')).toBeHidden();
    await expect(page.locator('.playground-preview-panel')).toBeVisible();

    await page.getByRole('button', { name: 'Split', exact: true }).click();
    await expect(editor).toBeVisible();
    await expect(editor).toContainText('Automatic preview');
    await expect(page.locator('.playground-preview-panel')).toBeVisible();
  });

  test('playground reports compiler errors and reset restores the example', async ({ page }) => {
    await page.goto('/playground');
    await expect(page.getByRole('status')).toContainText('Running', { timeout: 60000 });

    await page.getByRole('tab', { name: 'main.ts' }).click();
    const editor = page.getByRole('textbox', { name: 'Editing /src/main.ts' });
    await editor.fill("import missing from 'not-installed';\nconsole.log(missing);");
    await page.getByRole('tab', { name: 'app.html' }).click();
    await expect(page.getByRole('textbox', { name: 'Editing /src/app.html' })).toBeVisible();
    await page.getByRole('tab', { name: 'main.ts' }).click();
    await expect(editor).toContainText("import missing from 'not-installed';");
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
    await expect(frame.getByText('COMPILER')).toBeVisible();
    await expect(frame.getByText('ROUTER')).toBeVisible();
    await expect(frame.getByText('PREVIEW')).toBeVisible();
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

    await expect(page.getByRole('status')).toContainText('Running', { timeout: 60000 });
    await expect(page.locator('.playground-output-grid').getByText('Playground boom')).toBeVisible();
  });

  test('overview presents static feature syntax with links to focused examples', async ({ page }) => {
    await page.goto('/');

    const features = page.locator('[data-e2e="overview-features"] .overview-feature');
    await expect(features).toHaveCount(12);
    const basicSyntax = features.filter({ hasText: 'Basic Routes' }).locator('pre');
    await expect(basicSyntax).toContainText('<au-route path="products">');
    await expect(basicSyntax).toContainText("$route.isActive('/products', {}, { exact: true })");
    await expect(basicSyntax).toContainText('au-link="products"');
    await expect(basicSyntax).toContainText('au-link="/products"');
    const matchingSyntax = features.filter({ hasText: 'Exact, Fallback & Terminal Paths' }).locator('pre');
    await expect(matchingSyntax).toContainText('<au-route path="products/:id" exact>');
    await expect(matchingSyntax).toContainText('<au-route path="offers/:id?" exact>');
    await expect(matchingSyntax).toContainText('<au-route path="files/**">');
    const paramsSyntax = features
      .filter({ has: page.getByRole('heading', { name: 'Params', exact: true }) })
      .locator('pre');
    await expect(paramsSyntax).toContainText('<au-route path="posts/:postId">');
    await expect(paramsSyntax).toContainText('$route.parent.$params.userId');
    const swapSyntax = features.filter({ hasText: 'Swap Order' }).locator('pre');
    await expect(swapSyntax).toContainText('swap-order="parallel"');
    await expect(swapSyntax).toContainText('<au-route path="specs">Specs</au-route>');
    await expect(swapSyntax).toContainText('<au-route path="reviews">Reviews</au-route>');
    const urlSyntax = features.filter({ hasText: 'Query, Hash & URL Modes' }).locator('pre');
    await expect(urlSyntax).toContainText("Sort: ${$query.get('sort')}");
    await expect(page.getByRole('link', { name: 'Jump to example' })).toHaveCount(12);
    const editLinks = features.getByRole('link', { name: 'Edit in playground' });
    await expect(editLinks).toHaveCount(12);
    expect(await editLinks.evaluateAll(links => links.map(link => link.getAttribute('href')))).toEqual([
      '/playground/basic-routes',
      '/playground/nested-routes',
      '/playground/route-params',
      '/playground/url-state',
      '/playground/active-links',
      '/playground/conditional-routes',
      '/playground/repeated-routes',
      '/playground/exact-fallback',
      '/playground/swap-order',
      '/playground/route-animations',
      '/playground/shared-state',
      '/playground/kitchen-sink',
    ]);
    await expect(page.getByText('Runnable demo')).toHaveCount(0);
    await expect(page.locator('button')).toHaveCount(0);
  });

  test('an overview edit link opens its matching runnable source', async ({ page }) => {
    await page.goto('/');
    const basic = page.locator('[data-e2e="overview-features"] .overview-feature').filter({ hasText: 'Basic Routes' });

    await basic.getByRole('link', { name: 'Edit in playground' }).click();

    await expect(page).toHaveURL(/\/playground\/basic-routes$/);
    await expect(page.getByLabel('Example')).toHaveValue('basic-routes');
    const editor = page.getByRole('textbox', { name: 'Editing /src/app.html' });
    const sourceLines = await editor.locator('.cm-line').allTextContents();
    expect(sourceLines.slice(0, 4)).toEqual([
      '<nav>',
      '  <a au-link="/welcome">Welcome</a>',
      '  <a au-link="/about">About</a>',
      '</nav>',
    ]);
    const welcomeRoute = sourceLines.indexOf('  <au-route path="welcome">');
    expect(sourceLines.slice(welcomeRoute, welcomeRoute + 5)).toEqual([
      '  <au-route path="welcome">',
      '    <h1>Welcome</h1>',
      '    <p>Your first declarative route is running.</p>',
      '  </au-route>',
      '  <au-route path="about">',
    ]);
    await expect(page.getByRole('status')).toContainText('Running', { timeout: 60000 });
  });

  test('syntax highlighting gives valued and valueless attributes the same color', async ({ page }) => {
    await page.goto('/');

    const matchingSyntax = page.locator('.overview-feature', { hasText: 'Exact, Fallback & Terminal Paths' }).locator('pre');
    const pathAttribute = matchingSyntax.locator('.syntax-attribute').filter({ hasText: /^path$/ }).first();
    const exactAttribute = matchingSyntax.locator('.syntax-attribute').filter({ hasText: /^exact$/ }).first();
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

  test('feature pages embed the matching editable source and preview', async ({ page }) => {
    await page.goto('/features/repeated');

    const syntax = page.locator('.feature-details pre');
    await expect(syntax).toContainText('<au-route path.bind="item.path">');
    await expect(syntax).toContainText('<au-route path.to-view="item.path">');
    await expect(syntax).toContainText('<au-route :path="item.path">');

    const playground = page.locator('.playground-page.is-embedded');
    await expect(playground.getByRole('textbox', { name: 'Editing /src/app.html' })).toContainText('repeat.for="tab of tabs"');
    await expect(playground.getByRole('button', { name: /show source/i })).toHaveCount(0);
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

  test('basic routes makes relative declarations and root-absolute links explicit', async ({ page }) => {
    await page.goto('/features/basic');

    const guide = page.locator('[data-e2e="path-syntax-guide"]');
    await expect(guide).toContainText('products and ./products mean the same contextual route');
    await expect(guide).toContainText('A leading slash does not make an au-route declaration root-absolute');
    await expect(guide.locator('pre').nth(1)).toContainText("$route.isActive('/help', {}, { exact: true })");
    await expect(guide.locator('pre').nth(1)).toContainText('au-link="reviews"');
    await expect(guide.locator('pre').nth(1)).toContainText('au-link="/help"');
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
    await expect(playground.locator('[data-e2e="playground-preview"]')).toHaveCount(1);
    await expect(playground.frameLocator('[data-e2e="playground-preview"]').getByRole('heading', { name: 'Welcome' })).toBeVisible();
  });

  test('every focused feature uses its matching embedded project without a source toggle', async ({ page }) => {
    const features = [
      ['basic', 'path="welcome"'],
      ['nested', 'path="account"'],
      ['params', ':userId'],
      ['url-state', "$query.get('sort')"],
      ['active-links', 'au-link.bind'],
      ['conditional', 'if.bind="canEdit"'],
      ['repeated', 'repeat.for="tab of tabs"'],
      ['matching', 'path="files/**"'],
      ['swap', 'swap-order="parallel"'],
      ['animation', 'animate'],
      ['shared-state', 'state.totalQty'],
      ['kitchen-sink', 'au-slot="title"'],
    ];

    for (const [path, source] of features) {
      await page.goto(`/features/${path}`);
      const playground = page.locator('.playground-page.is-embedded');
      await expect(playground).toHaveCount(path === 'url-state' ? 3 : 1);
      await expect(playground.first().getByRole('textbox', { name: 'Editing /src/app.html' })).toContainText(source);
      await expect(page.getByRole('button', { name: /show source/i })).toHaveCount(0);
    }
  });

  test('nested route APIs sit beside their matching embedded project', async ({ page }) => {
    await page.goto('/features/nested');

    const apiExamples = page.locator('[data-e2e="route-api-examples"]');
    await expect(apiExamples).toContainText('au-link="."');
    await expect(apiExamples).toContainText('$route.root.href(');
    await expect(apiExamples).toContainText('$route.fullPath');
    await expect(apiExamples).toContainText('$route.root.getPaths()');

    const playground = page.locator('.playground-page.is-embedded');
    await expect(playground.getByRole('textbox', { name: 'Editing /src/app.html' })).toContainText('path="account"');
    await expect(playground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const frame = playground.frameLocator('[data-e2e="playground-preview"]');
    await expect(frame.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await frame.getByRole('link', { name: 'Security' }).click();
    await expect(frame.getByRole('heading', { name: 'Security' })).toBeVisible();
  });

  test('nested parameter views keep local params scoped to their own route', async ({ page }) => {
    await page.goto('/features/params');

    const details = page.locator('.feature-details');
    await expect(details).toContainText('Child $params does not silently merge ancestor parameters.');
    await expect(details.locator('pre')).toContainText('$route.parent.$params.userId');

    const playground = page.locator('.playground-page.is-embedded');
    await expect(playground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const frame = playground.frameLocator('[data-e2e="playground-preview"]');
    await expect(frame.getByRole('heading', { name: 'Parent user: ada' })).toBeVisible();
    await expect(frame.getByRole('heading', { name: 'Child post: routing-basics' })).toBeVisible();
    await expect(frame.getByText('Parent user from child: ada')).toBeVisible();

    await frame.getByRole('link', { name: 'Grace / Compilers' }).click();
    await expect(frame.getByRole('heading', { name: 'Parent user: grace' })).toBeVisible();
    await expect(frame.getByRole('heading', { name: 'Child post: compiler-design' })).toBeVisible();
    await expect(frame.getByText('Parent user from child: grace')).toBeVisible();
  });

  test('query and hash state change without changing the matched route', async ({ page }) => {
    await page.goto('/features/url-state');

    const details = page.locator('.feature-details');
    await expect(details).toContainText("routingMode: 'hash'");
    await expect(details).toContainText("routeQueryKey: 'app'");

    const playgrounds = page.locator('.playground-page.is-embedded');
    await expect(playgrounds).toHaveCount(3);

    const playground = playgrounds.nth(0);
    await expect(playground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const frame = playground.frameLocator('[data-e2e="playground-preview"]');
    await expect(frame.getByRole('heading', { name: 'Product: ice-cream' })).toBeVisible();
    await expect(frame.getByText('Sort: popular')).toBeVisible();
    await expect(frame.getByText('Section: reviews')).toBeVisible();

    await frame.getByRole('link', { name: 'Price details' }).click();
    await expect(playground.locator('.preview-label code')).toHaveText('/products/ice-cream?sort=price#details');
    await expect(frame.getByText('Sort: price')).toBeVisible();
    await expect(frame.getByText('Section: details')).toBeVisible();

    const hashPlayground = playgrounds.nth(1);
    await expect(hashPlayground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const hashFrame = hashPlayground.frameLocator('[data-e2e="playground-preview"]');
    await expect(hashPlayground.locator('.preview-label code')).toHaveText('#products/ice-cream/overview');
    await hashFrame.getByRole('link', { name: 'Reviews' }).click();
    await expect(hashPlayground.locator('.preview-label code')).toHaveText('#products/ice-cream/reviews');
    await expect(hashFrame.getByText('Ice cream reviews')).toBeVisible();

    const queryPlayground = playgrounds.nth(2);
    await expect(queryPlayground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const queryFrame = queryPlayground.frameLocator('[data-e2e="playground-preview"]');
    await expect(queryPlayground.locator('.preview-label code')).toHaveText('?app=products/ice-cream/overview');
    await queryFrame.getByRole('link', { name: 'Reviews' }).click();
    await expect(queryPlayground.locator('.preview-label code')).toHaveText('?app=products/ice-cream/reviews');
    await expect(queryFrame.getByText('Ice cream reviews')).toBeVisible();

    const configurationSource = details.locator('pre').nth(1);
    await expect(configurationSource.locator('.syntax-string')).not.toHaveCount(0);
    await expect(configurationSource.locator('.syntax-comment')).not.toHaveCount(0);
  });

  test('active links update pathname, query, hash, and docs navigation state', async ({ page }) => {
    await page.goto('/features/active-links');

    const activeDocsLink = page.getByRole('link', { name: 'Active Links', exact: true });
    await expect(activeDocsLink).toHaveClass(/is-active/);
    await expect(activeDocsLink).toHaveAttribute('aria-current', 'page');

    const playground = page.locator('.playground-page.is-embedded');
    await expect(playground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const frame = playground.frameLocator('[data-e2e="playground-preview"]');
    const overview = frame.getByRole('link', { name: 'Overview' });
    const reviews = frame.getByRole('link', { name: 'Reviews', exact: true });
    const recent = frame.getByRole('link', { name: 'Recent reviews' });
    const comments = frame.getByRole('link', { name: 'Review comments' });

    await expect(reviews).toHaveClass(/selected/);
    await expect(reviews).toHaveAttribute('aria-current', 'page');
    await expect(recent).toHaveClass(/selected/);
    await expect(comments).toHaveClass(/selected/);

    await overview.click();
    await expect(playground.locator('.preview-label code')).toHaveText('/products/ice-cream/overview');
    await expect(overview).toHaveClass(/selected/);
    await expect(overview).toHaveAttribute('aria-current', 'page');
    await expect(reviews).not.toHaveClass(/selected/);
    await expect(recent).not.toHaveClass(/selected/);
    await expect(comments).not.toHaveClass(/selected/);

    await page.getByRole('link', { name: 'Basic Routes', exact: true }).click();
    await expect(page).toHaveURL(/\/features\/basic$/);
    await expect(page.getByRole('link', { name: 'Basic Routes', exact: true })).toHaveClass(/is-active/);
    await expect(activeDocsLink).not.toHaveClass(/is-active/);

    await page.goBack();
    await expect(page).toHaveURL(/\/features\/active-links$/);
    await expect(activeDocsLink).toHaveClass(/is-active/);

    await page.goForward();
    await expect(page).toHaveURL(/\/features\/basic$/);
    await expect(page.getByRole('link', { name: 'Basic Routes', exact: true })).toHaveClass(/is-active/);
  });

  test('exact, fallback, terminal, and parallel swap fixtures run inside their pages', async ({ page }) => {
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
    await frame.getByRole('link', { name: 'Terminal file path' }).click();
    await expect(frame.getByRole('heading', { name: 'Terminal file route' })).toBeVisible();
    await expect(frame.getByText('Path presented: /files/guides/router/start.html')).toBeVisible();
    await expect(frame.getByText('Terminal segment: guides/router/start.html')).toBeVisible();
    await expect(frame.getByText('Residue after **: /')).toBeVisible();
    await expect(frame.getByText('The nested route receives /')).toBeVisible();

    await page.goto('/features/swap');
    playground = page.locator('.playground-page.is-embedded');
    await expect(playground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    frame = playground.frameLocator('[data-e2e="playground-preview"]');
    await expect(frame.getByRole('heading', { name: 'Specs' })).toBeVisible();
    await frame.getByRole('link', { name: 'Reviews' }).click();
    await expect(frame.getByRole('heading', { name: 'Reviews' })).toBeVisible();
  });

  test('kitchen sink uses one editable source for scopes, slots, and repeated routes', async ({ page }) => {
    await page.goto('/features/kitchen-sink');

    const playground = page.locator('.playground-page.is-embedded');
    const editor = playground.getByRole('textbox', { name: 'Editing /src/app.html' });
    await expect(editor).toContainText('<let greeting.bind');
    await expect(editor).toContainText('au-slot="title"');
    await expect(editor).toContainText('repeat.for="room of rooms"');
    await expect(page.getByRole('button', { name: /show source/i })).toHaveCount(0);
    await expect(playground.getByRole('status')).toContainText('Running', { timeout: 60000 });

    const frame = playground.frameLocator('[data-e2e="playground-preview"]');
    await expect(frame.getByText('Welcome to Sunny room')).toBeVisible();
    await frame.getByRole('button', { name: 'Visits: 0' }).click();
    await expect(frame.getByRole('button', { name: 'Visits: 1' })).toBeVisible();

    for (let index = 0; index < 4; index++) {
      const moonLink = frame.getByText('Moon room', { exact: true });
      await expect(moonLink).toHaveAttribute('href', '/moon');
      await moonLink.click();
      await expect(frame.getByText('Welcome to Moon room')).toBeVisible();
      const sunnyLink = frame.getByText('Sunny room', { exact: true });
      await expect(sunnyLink).toHaveAttribute('href', '/sunny');
      await sunnyLink.click();
      await expect(frame.getByText('Welcome to Sunny room')).toBeVisible();
    }
    await expect(playground.locator('.console-entry.error')).toHaveCount(0);
  });
});
