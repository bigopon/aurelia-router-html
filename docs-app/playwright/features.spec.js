import { expect, test } from '@playwright/test';

test.describe('router HTML docs features', () => {
  test('playground compiles conventions and runs routes in an isolated replaceable preview', async ({ page }) => {
    await page.goto('/playground');

    const preview = page.locator('[data-e2e="playground-preview"]');
    await expect(preview).toHaveAttribute('sandbox', 'allow-scripts');
    expect(await preview.evaluate(element => element.getBoundingClientRect().height)).toBeLessThanOrEqual(650);
    expect(await page.locator('.playground-workspace').evaluate(element => element.getBoundingClientRect().height)).toBeLessThanOrEqual(650);
    expect(await page.locator('.playground-editor-panel').evaluate(element => element.getBoundingClientRect().height)).toBeLessThanOrEqual(650);
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
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');

    const overviewOrder = await page.locator('[data-e2e="getting-started"], [data-e2e="examples-section"], [data-e2e="routing-customization"]')
      .evaluateAll(elements => elements.map(element => element.getAttribute('data-e2e')));
    expect(overviewOrder).toEqual(['getting-started', 'examples-section', 'routing-customization']);
    const gettingStarted = page.locator('[data-e2e="getting-started"]');
    await expect(gettingStarted).toContainText("import { Routing } from 'aurelia-v2-router-html'");
    await expect(gettingStarted).toContainText('.register(Routing)');
    await expect(gettingStarted).not.toContainText('interceptLinks');
    await expect(gettingStarted).not.toContainText('animations');

    const customization = page.locator('[data-e2e="routing-customization"]');
    await expect(customization).toContainText('Pathname');
    await expect(customization).toContainText('Hash');
    await expect(customization).toContainText('Query key');
    await expect(customization).toContainText('Memory');
    await expect(customization).toContainText('Custom adapter');
    await expect(customization).toContainText('interceptLinks');
    await expect(customization).toContainText('swapOrder');
    await expect(customization).toContainText('animations');
    await expect(customization).toContainText('titles');
    await expect(customization).toContainText('scrolling');
    await expect(customization).toContainText('focus');
    const modeSnippets = customization.locator('[data-e2e="routing-mode-snippets"] article');
    await expect(modeSnippets).toHaveCount(3);
    await expect(modeSnippets.nth(0).locator('pre')).toContainText("routingMode: 'path'");
    await expect(modeSnippets.nth(1).locator('pre')).toContainText("routingMode: 'hash'");
    await expect(modeSnippets.nth(2).locator('pre')).toContainText("routingMode: 'query'");
    await expect(modeSnippets.nth(2).locator('pre')).toContainText("routeQueryKey: 'app'");
    expect(await modeSnippets.nth(2).locator('.copy-code-source').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);

    const codeBlocks = page.locator('pre.code-block');
    await expect(page.locator('pre.code-block > .copy-code-button')).toHaveCount(await codeBlocks.count());
    const pathCopyButton = modeSnippets.nth(0).locator('.copy-code-button');
    await pathCopyButton.click();
    await expect(pathCopyButton).toHaveText('Copied');
    expect((await page.evaluate(() => navigator.clipboard.readText())).replaceAll('\r\n', '\n')).toBe(
      "Routing.customize({\n  routingMode: 'path'\n});",
    );
    await page.waitForTimeout(1_000);
    await pathCopyButton.click();
    await expect(pathCopyButton).toHaveClass(/is-copy-confirmed/);
    await page.waitForTimeout(2_300);
    await expect(pathCopyButton).toHaveText('Copied');
    await page.waitForTimeout(900);
    await expect(pathCopyButton).toHaveText('Copy');

    const features = page.locator('[data-e2e="overview-features"] .overview-feature');
    const longSnippet = features.filter({ hasText: 'Basic Routes' }).locator('pre');
    expect(await longSnippet.evaluate(element => {
      const source = element.querySelector('.copy-code-source');
      return source == null ? Number.POSITIVE_INFINITY : Math.abs(source.getBoundingClientRect().bottom - element.getBoundingClientRect().bottom);
    })).toBeLessThan(1);
    const copyButtonLeft = await longSnippet.locator('.copy-code-button').evaluate(element => element.getBoundingClientRect().left);
    await longSnippet.locator('.copy-code-source').evaluate(element => {
      element.scrollLeft = element.scrollWidth;
    });
    expect(await longSnippet.locator('.copy-code-button').evaluate(element => element.getBoundingClientRect().left)).toBe(copyButtonLeft);

    await expect(features).toHaveCount(24);
    const basicSyntax = features.filter({ hasText: 'Basic Routes' }).locator('pre');
    await expect(basicSyntax).toContainText('<au-route path="products">');
    await expect(basicSyntax).toContainText("$route.isActive('/products', {}, { exact: true })");
    await expect(basicSyntax).toContainText('au-link="products"');
    await expect(basicSyntax).toContainText('au-link="/products"');
    const activeLinkSyntax = features.filter({ hasText: 'Active Links' }).locator('pre');
    await expect(activeLinkSyntax).toContainText("$route.href('reviews')");
    await expect(activeLinkSyntax).toContainText("$route.isActive('reviews', {}, { exact: true })");
    const matchingSyntax = features.filter({ hasText: 'Exact & Fallback Matching' }).locator('pre');
    await expect(matchingSyntax).toContainText('<au-route path="products/:id" exact>');
    await expect(matchingSyntax).toContainText('<au-route path="offers/:id?" exact>');
    await expect(matchingSyntax).toContainText('<au-route path="*" fallback>');
    const wildcardSyntax = features.filter({ hasText: 'Wildcard Paths' }).locator('pre');
    await expect(wildcardSyntax).toContainText('<au-route path="date/*/summary" exact>');
    await expect(wildcardSyntax).toContainText("Date: ${$params['*']}");
    await expect(wildcardSyntax).toContainText('<au-route path="files/**">');
    const adapterSyntax = features.filter({ hasText: 'Routing Adapters' }).locator('pre');
    await expect(adapterSyntax).toContainText("new MemoryPathAdapter('/dashboard')");
    await expect(adapterSyntax).toContainText('Routing.customize');
    const paramsSyntax = features
      .filter({ has: page.getByRole('heading', { name: 'Params', exact: true }) })
      .locator('pre');
    await expect(paramsSyntax).toContainText('<au-route path="posts/:postId">');
    await expect(paramsSyntax).toContainText('$route.parent.$params.userId');
    const constraintSyntax = features.filter({ hasText: 'Segment Constraints' }).locator('pre');
    await expect(constraintSyntax).toContainText('path="products/:id{{^\\d+$}}"');
    await expect(constraintSyntax).toContainText('path="archive/:year{{^\\d{4}$}}?"');
    const swapSyntax = features.filter({ hasText: 'Swap Order' }).locator('pre');
    await expect(swapSyntax).toContainText('swap-order="parallel"');
    await expect(swapSyntax).toContainText('<au-route path="specs">Specs</au-route>');
    await expect(swapSyntax).toContainText('<au-route path="reviews">Reviews</au-route>');
    const urlSyntax = features.filter({ hasText: 'Query, Hash & URL Modes' }).locator('pre');
    await expect(urlSyntax).toContainText("Sort: ${$query.get('sort')}");
    const hashScrollingSyntax = features.filter({ hasText: 'Scrolling & Restoration' }).locator('pre');
    await expect(hashScrollingSyntax).toContainText('au-link="guide#api-reference"');
    await expect(hashScrollingSyntax).toContainText("options: { hash: 'api-reference' }");
    await expect(hashScrollingSyntax).toContainText('id="api-reference"');
    const focusSyntax = features.filter({ hasText: 'Focus Management' }).locator('pre');
    await expect(focusSyntax).toContainText('<h1 au-route-focus>Account settings</h1>');
    const programmaticSyntax = features.filter({ hasText: 'Programmatic Navigation' }).locator('pre');
    await expect(programmaticSyntax).toContainText('resolve(IRouteContext)');
    await expect(programmaticSyntax).toContainText('this.route.load');
    const redirectSyntax = features.filter({ hasText: 'Declarative Redirects' }).locator('pre');
    await expect(redirectSyntax).toContainText('redirect-to="/products/:productId"');
    const titleSyntax = features.filter({ hasText: 'Page Titles' }).locator('pre');
    await expect(titleSyntax).toContainText('title.bind="cameraTitle"');
    const lifecycleSyntax = features.filter({ hasText: 'Loading & Loaded' }).locator('pre');
    await expect(lifecycleSyntax).toContainText('loading.bind="() => loadProduct()"');
    await expect(lifecycleSyntax).toContainText('loaded.bind="() => productIsReady()"');
    const guardSyntax = features.filter({ hasText: 'Navigation Guards' }).locator('pre');
    await expect(guardSyntax).toContainText('can-load.bind="() => canOpenAccount()"');
    await expect(guardSyntax).toContainText('can-unload.bind="() => canLeaveAccount()"');
    const guardFailureSyntax = features.filter({ hasText: 'Guard Failure Modes' }).locator('pre');
    await expect(guardFailureSyntax).toContainText('guard-failure="local"');
    await expect(guardFailureSyntax).toContainText('<au-route path="*" fallback>');
    const errorRecoverySyntax = features.filter({ hasText: 'Error Recovery' }).locator('pre');
    await expect(errorRecoverySyntax).toContainText('on-error.bind="failure => recover(failure)"');
    await expect(errorRecoverySyntax).toContainText('$route.parent.failure.error.message');
    await expect(page.getByRole('link', { name: 'Jump to example' })).toHaveCount(24);
    const editLinks = features.getByRole('link', { name: 'Edit in playground' });
    await expect(editLinks).toHaveCount(24);
    expect(await editLinks.evaluateAll(links => links.map(link => link.getAttribute('href')))).toEqual([
      '/playground/basic-routes',
      '/playground/nested-routes',
      '/playground/route-params',
      '/playground/segment-constraints',
      '/playground/url-state',
      '/playground/active-links',
      '/playground/hash-scrolling',
      '/playground/focus-management',
      '/playground/programmatic-navigation',
      '/playground/declarative-redirects',
      '/playground/page-titles',
      '/playground/route-lifecycle',
      '/playground/navigation-guards',
      '/playground/layered-navigation-guards',
      '/playground/error-recovery',
      '/playground/memory-adapter',
      '/playground/conditional-routes',
      '/playground/repeated-routes',
      '/playground/exact-fallback',
      '/playground/wildcard-paths',
      '/playground/swap-order',
      '/playground/route-animations',
      '/playground/shared-state',
      '/playground/kitchen-sink',
    ]);
    await expect(page.getByText('Runnable demo')).toHaveCount(0);
    await expect(page.locator('button:not(.copy-code-button)')).toHaveCount(0);
    await expect(page.locator('.nav-list .nav-end')).toHaveText('End of guide');
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

    const matchingSyntax = page.locator('.overview-feature', { hasText: 'Exact & Fallback Matching' }).locator('pre');
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

  test('API cheat sheet collects the application-facing router surface', async ({ page }) => {
    await page.goto('/api');

    await expect(page.getByRole('heading', { name: 'API Cheat Sheet' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'API Cheat Sheet', exact: true })).toHaveClass(/is-active/);
    await expect(page).toHaveTitle('API Cheat Sheet | Aurelia Router HTML');

    const sheet = page.locator('.api-cheat-sheet');
    await expect(sheet).toContainText('path.bind');
    await expect(sheet).toContainText('redirect-to');
    await expect(sheet).toContainText('guard-failure');
    await expect(sheet).toContainText('$route.isActive');
    await expect(sheet).toContainText('IRouteContext');
    await expect(sheet).toContainText('scrolling');
    await expect(sheet).toContainText('au-route-focus');
    await expect(sheet).toContainText("fallback: 'heading'");
    await expect(sheet).toContainText(':id{{^\\d+$}}');
    await expect(sheet).toContainText('A target without a leading slash is contextual');
    await expect(sheet).toContainText('A leading slash is root-absolute');
    await expect(sheet).toContainText('every au-route path declaration matches the residue supplied by its parent');
    const codeBlocks = sheet.locator('pre.code-block');
    await expect(sheet.locator('pre.code-block > .copy-code-button')).toHaveCount(await codeBlocks.count());

    await page.getByRole('link', { name: 'Links', exact: true }).click();
    await expect(page).toHaveURL(/\/api#links-and-navigation$/);
    await expect(page.getByRole('heading', { name: 'Links and navigation' })).toBeVisible();
  });

  test('purpose page explains declarative template-owned routing', async ({ page }) => {
    await page.goto('/why-router-html');

    await expect(page.getByRole('heading', { name: 'Why Router HTML' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Why Router HTML', exact: true })).toHaveClass(/is-active/);
    await expect(page).toHaveTitle('Why Router HTML | Aurelia Router HTML');

    const purpose = page.locator('[data-e2e="router-purpose"]');
    await expect(purpose).toContainText('The route tree is the UI tree');
    await expect(purpose).toContainText('There is no parallel JavaScript route-configuration syntax');
    await expect(purpose).toContainText('does not remove TypeScript');
    await expect(purpose.locator('pre').first()).toContainText('<au-route path="products">');
    await expect(purpose.locator('pre').nth(1)).toContainText('repeat.for="tab of activeTabs"');

    const codeBlocks = purpose.locator('pre.code-block');
    await expect(purpose.locator('pre.code-block > .copy-code-button')).toHaveCount(await codeBlocks.count());
  });

  test('hash-scrolling guide runs its delayed target example', async ({ page }) => {
    await page.goto('/features/hash-scrolling');
    await expect(page.getByRole('status')).toContainText('Running', { timeout: 60000 });

    const frame = page.frameLocator('[data-e2e="playground-preview"]');
    await expect(frame.getByRole('heading', { name: 'Documentation home' })).toBeVisible();
    await frame.getByRole('link', { name: 'Static API link' }).click();

    await expect(page.locator('.playground-preview-panel .preview-label code')).toHaveText('/guide#api-reference');
    await expect(frame.getByText('API section ready')).toBeVisible();
    await expect(frame.getByRole('heading', { name: 'API reference' })).toBeVisible();
    await expect.poll(() => frame.locator('body').evaluate(() => window.scrollY)).toBeGreaterThan(300);
  });

  test('focus-management guide moves focus only when a new route view attaches', async ({ page }) => {
    await page.goto('/features/focus');
    const guide = page.locator('[data-e2e="focus-guide"]');
    await expect(guide).toContainText('Focus management is off by default');
    await expect(guide).toContainText("fallback: 'heading'");

    const playground = page.locator('.playground-page.is-embedded');
    await expect(playground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const frame = playground.frameLocator('[data-e2e="playground-preview"]');
    await expect(frame.getByText('after a route change, look for the dashed violet border and glow')).toBeVisible();
    const welcome = frame.getByRole('heading', { name: 'Welcome' });
    await expect(welcome).toBeVisible();
    await expect(welcome).not.toBeFocused();

    await frame.getByRole('link', { name: 'Account' }).click();
    const account = frame.getByRole('heading', { name: 'Account settings' });
    await expect(account).toBeFocused();
    await expect(account).toHaveAttribute('tabindex', '-1');
    await expect.poll(() => account.evaluate(element => getComputedStyle(element).outlineColor))
      .toBe('rgb(118, 85, 217)');
    const focusStyle = await account.evaluate(element => ({
      outlineStyle: getComputedStyle(element).outlineStyle,
      boxShadow: getComputedStyle(element).boxShadow,
    }));
    expect(focusStyle.outlineStyle).toBe('dashed');
    expect(focusStyle.boxShadow).not.toBe('none');

    const security = frame.getByRole('link', { name: 'Show security settings' });
    await security.focus();
    await security.evaluate(element => element.click());
    await expect(playground.locator('.preview-label code')).toHaveText('/account?panel=security');
    await expect(security).toBeFocused();
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
      ['segment-constraints', ':id{{^\\d+$}}'],
      ['url-state', "$query.get('sort')"],
      ['active-links', 'au-link.bind'],
      ['focus', 'au-route-focus'],
      ['programmatic', 'resolve(IRouteContext)', '/src/app.ts'],
      ['redirects', 'redirect-to.bind'],
      ['titles', 'title.bind="cameraTitle"'],
      ['adapters', 'MemoryPathAdapter', '/src/main.ts'],
      ['conditional', 'if.bind="canEdit"'],
      ['repeated', 'repeat.for="tab of tabs"'],
      ['matching', 'fallback'],
      ['wildcards', 'path="date/*/summary"'],
      ['swap', 'swap-order="parallel"'],
      ['animation', 'animate'],
      ['shared-state', 'state.totalQty'],
      ['kitchen-sink', 'au-slot="title"'],
    ];

    for (const [path, source, file = '/src/app.html'] of features) {
      await page.goto(`/features/${path}`);
      const playground = page.locator('.playground-page.is-embedded');
      await expect(playground).toHaveCount(path === 'url-state' ? 3 : 1);
      await expect(playground.first().getByRole('textbox', { name: `Editing ${file}` })).toContainText(source);
      const codeBlocks = page.locator('pre.code-block');
      await expect(page.locator('pre.code-block > .copy-code-button')).toHaveCount(await codeBlocks.count());
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

  test('segment constraints select required, optional, and middle parameter routes', async ({ page }) => {
    await page.goto('/features/segment-constraints');
    const guide = page.locator('[data-e2e="segment-constraints-guide"]');
    await expect(guide).toContainText(':id{{^\\d+$}}');
    await expect(guide).toContainText('cannot consume another segment');
    await expect(guide).toContainText('previous valid matcher remains installed');

    const playground = page.locator('.playground-page.is-embedded');
    await expect(playground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const frame = playground.frameLocator('[data-e2e="playground-preview"]');
    await expect(frame.getByRole('heading', { name: 'Numeric product 42' })).toBeVisible();

    await frame.getByRole('link', { name: 'Named product' }).click();
    await expect(playground.locator('.preview-label code')).toHaveText('/products/ice-cream');
    await expect(frame.getByRole('heading', { name: 'Named product ice-cream' })).toBeVisible();
    await expect(frame.getByText('The slug segment contains lowercase letters and hyphens.')).toBeVisible();

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
    const lowLevel = frame.getByRole('link', { name: 'Low-level reviews' });

    await expect(reviews).toHaveClass(/selected/);
    await expect(reviews).toHaveAttribute('aria-current', 'page');
    await expect(recent).toHaveClass(/selected/);
    await expect(comments).toHaveClass(/selected/);
    await expect(lowLevel).toHaveClass(/selected/);

    await overview.click();
    await expect(playground.locator('.preview-label code')).toHaveText('/products/ice-cream/overview');
    await expect(overview).toHaveClass(/selected/);
    await expect(overview).toHaveAttribute('aria-current', 'page');
    await expect(reviews).not.toHaveClass(/selected/);
    await expect(recent).not.toHaveClass(/selected/);
    await expect(comments).not.toHaveClass(/selected/);
    await expect(lowLevel).not.toHaveClass(/selected/);

    await lowLevel.click();
    await expect(playground.locator('.preview-label code')).toHaveText('/products/ice-cream/reviews');
    await expect(lowLevel).toHaveClass(/selected/);

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

  test('exact, fallback, and parallel swap fixtures run inside their pages', async ({ page }) => {
    await page.goto('/features/matching');
    let playground = page.locator('.playground-page.is-embedded');
    await expect(playground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    let frame = playground.frameLocator('[data-e2e="playground-preview"]');
    await expect(frame.getByRole('heading', { name: 'Product catalog' })).toBeVisible();
    await frame.getByRole('link', { name: 'Offers', exact: true }).click();
    await expect(frame.getByRole('heading', { name: 'Offer: all offers' })).toBeVisible();
    await expect(frame.getByRole('link', { name: 'Offers', exact: true })).toHaveClass(/is-active/);
    await frame.getByRole('link', { name: 'Summer offer' }).click();
    await expect(frame.getByRole('heading', { name: 'Offer: summer' })).toBeVisible();
    await expect(frame.getByRole('link', { name: 'Offers', exact: true })).not.toHaveClass(/is-active/);
    await expect(frame.getByRole('link', { name: 'Summer offer' })).toHaveClass(/is-active/);
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
    await expect(frame.getByText('Captured date: 2026-08-16')).toBeVisible();
    await frame.getByRole('link', { name: 'Folder guide' }).click();
    await expect(frame.getByRole('heading', { name: 'Single folder route' })).toBeVisible();
    await expect(frame.getByText('Captured folder: guides and api')).toBeVisible();
    await expect(frame.getByText('Residue after *: /')).toBeVisible();
    await frame.getByRole('link', { name: 'Terminal file path' }).click();
    await expect(frame.getByRole('heading', { name: 'Terminal file route' })).toBeVisible();
    await expect(frame.getByText('Path presented: /files/guides/router/start.html')).toBeVisible();
    await expect(frame.getByText('Terminal segment: guides/router/start.html')).toBeVisible();
    await expect(frame.getByText('Residue after **: /')).toBeVisible();
    await expect(frame.getByText('The nested route receives /')).toBeVisible();
  });

  test('memory adapter fixture navigates and restores history without browser URLs', async ({ page }) => {
    await page.goto('/features/adapters');
    const details = page.locator('.feature-details');
    await expect(details).toContainText('getCurrentPath()');
    await expect(details).toContainText('formatHref()');
    await expect(details).toContainText('Do not notify');
    await expect(details).toContainText('adapterFactory');
    await expect(details).toContainText('pre-registered IPathAdapter');
    await expect(details).toContainText('Ignored by Router HTML');
    const interceptGuide = page.locator('[data-e2e="intercept-links-guide"]');
    await expect(interceptGuide).toContainText('Yes—required');
    await expect(interceptGuide).toContainText('Often useful');
    await expect(interceptGuide).toContainText('Not useful');
    await expect(interceptGuide).toContainText('Not applicable');
    await expect(interceptGuide).toContainText('$route.load');

    const playground = page.locator('.playground-page.is-embedded');
    await expect(playground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const frame = playground.frameLocator('[data-e2e="playground-preview"]');

    await expect(frame.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    const dashboard = frame.getByRole('link', { name: 'Dashboard' });
    const reports = frame.getByRole('link', { name: 'Reports' });
    await expect(dashboard).toHaveClass(/is-active/);
    await reports.click();
    await expect(frame.getByRole('heading', { name: 'Reports' })).toBeVisible();
    await expect(reports).toHaveClass(/is-active/);
    await frame.getByRole('button', { name: 'Back' }).click();
    await expect(frame.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('programmatic navigation uses the contextual route API', async ({ page }) => {
    await page.goto('/features/programmatic');
    const guide = page.locator('[data-e2e="programmatic-navigation-guide"]');
    await expect(guide).toContainText('IRouteContext is the view-model form of template $route');
    await expect(guide).toContainText("this.route.load('/products/:id'");
    await expect(guide).toContainText("$route.load('/login')");
    await expect(guide).toContainText('does not need IRouteCoordinator');

    const playground = page.locator('.playground-page.is-embedded');
    await expect(playground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const frame = playground.frameLocator('[data-e2e="playground-preview"]');
    await frame.getByRole('button', { name: 'Open camera reviews' }).click();
    await expect(frame.getByRole('heading', { name: 'camera reviews' })).toBeVisible();
    await expect(frame.getByText('Sort: recent')).toBeVisible();
    await expect(frame.getByText('Section: comments')).toBeVisible();
  });

  test('redirect guide embeds the documented playground source', async ({ page }) => {
    await page.goto('/features/redirects');
    const guide = page.locator('[data-e2e="redirect-guide"]');
    await expect(guide).toContainText('redirect-to.bind');
    await expect(guide).toContainText('redirect-mode="push"');
    await expect(guide).toContainText('Replacement is the default');

    const playground = page.locator('.playground-page.is-embedded');
    await expect(playground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const editor = playground.getByRole('textbox', { name: 'Editing /src/app.html' });
    await expect(editor).toContainText('redirect-to.bind="legacyTarget"');
    await expect(editor).toContainText('redirect-to="products/:productId"');
    await expect(editor).toContainText('path="/" exact redirect-to="profile"');
  });

  test('page titles compose nested static and bound metadata in the real browser', async ({ page }) => {
    await page.goto('/features/titles');
    await expect(page).toHaveTitle('Page Titles | Aurelia Router HTML');

    const guide = page.locator('[data-e2e="title-guide"]');
    await expect(guide).toContainText('title.bind');
    const playground = page.locator('.playground-page.is-embedded');
    await expect(playground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    await expect(playground.getByRole('textbox', { name: 'Editing /src/app.html' })).toContainText('title.bind="cameraTitle"');
    const preview = page.frames().find(frame => frame !== page.mainFrame());
    expect(preview).toBeDefined();
    const visibleTitle = playground.locator('[data-e2e="preview-title"]');
    await expect(visibleTitle).toHaveText('Products · Camera details');
    await preview.getByRole('button', { name: 'Change title' }).click();
    await expect(visibleTitle).toHaveText('Products · Mirrorless camera');
    await preview.getByRole('link', { name: 'Lens' }).click();
    await expect(visibleTitle).toHaveText('Products · Lens details');
  });

  test('loading and loaded guide runs nested lifecycle callbacks in its embedded playground', async ({ page }) => {
    await page.goto('/features/lifecycle');
    await expect(page).toHaveTitle('Loading & Loaded | Aurelia Router HTML');

    const guide = page.locator('[data-e2e="lifecycle-guide"]');
    await expect(guide).toContainText('loading.bind');
    await expect(guide).toContainText('loaded.bind');
    await expect(guide).toContainText('parent to child');
    await expect(guide).toContainText('child to parent');
    await expect(guide).toContainText('Loading errors today');
    await expect(guide).not.toContainText('.call="');

    const playground = page.locator('.playground-page.is-embedded');
    await expect(playground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    await expect(playground.getByRole('textbox', { name: 'Editing /src/app.html' })).toContainText('loading.bind="() => prepare');
    const frame = playground.frameLocator('[data-e2e="playground-preview"]');
    await frame.getByRole('link', { name: 'Project board' }).click();
    await expect(frame.getByRole('heading', { name: 'Project board' })).toBeVisible();
    await expect(frame.locator('ol')).toContainText('Projects loading');
    await expect(frame.locator('ol')).toContainText('Board loading');
    await expect(frame.locator('ol')).toContainText('Board loaded');
    await expect(frame.locator('ol')).toContainText('Projects loaded');
  });

  test('navigation guard guide cancels, approves, and redirects in its embedded playground', async ({ page }) => {
    await page.goto('/features/guards');
    await expect(page).toHaveTitle('Navigation Guards | Aurelia Router HTML');

    const guide = page.locator('[data-e2e="guards-guide"]');
    await expect(guide).toContainText('can-load');
    await expect(guide).toContainText('can-unload');
    await expect(guide).toContainText('Atomic navigation');

    const playground = page.locator('.playground-page.is-embedded');
    await expect(playground).toHaveCount(1);
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
    await expect(page).toHaveTitle('Guard Failure Modes | Aurelia Router HTML');

    const guide = page.locator('[data-e2e="guard-failure-guide"]');
    await expect(guide).toContainText('guard-failure="navigation"');
    await expect(guide).toContainText('guard-failure="local"');
    await expect(guide).toContainText('immediate parent rematches the residue');
    await expect(guide).toContainText('can-unload');

    const layeredPlayground = page.locator('.playground-page.is-embedded');
    await expect(layeredPlayground).toHaveCount(1);
    await expect(layeredPlayground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const layeredFrame = layeredPlayground.frameLocator('[data-e2e="playground-preview"]');

    await layeredFrame.getByRole('link', { name: 'Member portal' }).click();
    await expect(layeredFrame.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(layeredFrame.getByLabel('Guard invocation order').locator('li')).toHaveText([
      'Portal guard: require a signed-in member',
    ]);

    await layeredFrame.getByRole('button', { name: 'Use member' }).click();
    await layeredFrame.getByRole('link', { name: 'Member portal' }).click();
    await expect(layeredFrame.getByRole('heading', { name: 'Member profile' })).toBeVisible();
    await layeredFrame.getByRole('link', { name: 'Open staff area' }).click();
    await expect(layeredFrame.getByRole('heading', { name: 'Member portal' })).toBeVisible();
    await expect(layeredFrame.getByRole('heading', { name: 'Staff access denied' })).toBeVisible();
    await expect(layeredPlayground.locator('.preview-label code')).toHaveText('/portal/staff/reports');
    await expect(layeredFrame.getByLabel('Guard invocation order').locator('li')).toHaveText([
      'Portal guard: require a signed-in member',
      'Staff guard: require staff access',
    ]);

    await layeredFrame.getByRole('button', { name: 'Use staff' }).click();
    await layeredFrame.getByRole('link', { name: 'Home' }).click();
    await layeredFrame.getByRole('link', { name: 'Member portal' }).click();
    await layeredFrame.getByRole('link', { name: 'Open staff area' }).click();
    await expect(layeredFrame.getByRole('heading', { name: 'Staff reports' })).toBeVisible();
    await expect(layeredFrame.getByLabel('Guard invocation order').locator('li')).toHaveText([
      'Portal guard: require a signed-in member',
      'Staff guard: require staff access',
    ]);

    await layeredFrame.getByRole('link', { name: 'Administration' }).click();
    await expect(layeredFrame.getByRole('heading', { name: 'Staff area' })).toBeVisible();
    await expect(layeredFrame.getByRole('heading', { name: 'Administration access denied' })).toBeVisible();
    await expect(layeredPlayground.locator('.preview-label code')).toHaveText('/portal/staff/admin');
    await expect(layeredFrame.getByLabel('Guard invocation order').locator('li').last()).toHaveText(
      'Administration guard: require admin access',
    );

    await layeredFrame.getByRole('button', { name: 'Use admin' }).click();
    await layeredFrame.getByRole('link', { name: 'Home' }).click();
    await layeredFrame.getByRole('link', { name: 'Member portal' }).click();
    await layeredFrame.getByRole('link', { name: 'Open staff area' }).click();
    await layeredFrame.getByRole('link', { name: 'Administration' }).click();
    await expect(layeredFrame.getByRole('heading', { name: 'Administration' })).toBeVisible();
    await expect(layeredFrame.getByLabel('Guard invocation order').locator('li')).toHaveText([
      'Portal guard: require a signed-in member',
      'Staff guard: require staff access',
      'Administration guard: require admin access',
    ]);
  });

  test('error recovery guide retains its parent, exposes failure details, and retries cleanly', async ({ page }) => {
    await page.goto('/features/error-recovery');
    await expect(page).toHaveTitle('Error Recovery | Aurelia Router HTML');

    const guide = page.locator('[data-e2e="error-recovery-guide"]');
    await expect(guide).toContainText('on-error.bind');
    await expect(guide).toContainText('failure.source');
    await expect(guide).toContainText('failure.boundary');
    await expect(guide).toContainText('failure.recovery');
    await expect(guide).toContainText('$route.parent.failure');
    await expect(guide.locator('pre.code-block > .copy-code-button')).toHaveCount(2);
    await expect(page.locator('.playground-page.is-embedded')).toHaveCount(3);

    const sourceExample = page.locator('[data-e2e="source-error-example"]');
    const sourcePlayground = sourceExample.locator('.playground-page');
    await expect(sourcePlayground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const sourceFrame = sourcePlayground.frameLocator('[data-e2e="playground-preview"]');
    await sourceFrame.getByRole('link', { name: 'Reports' }).click();
    await expect(sourceFrame.getByRole('heading', { name: 'Reports could not load' })).toBeVisible();
    await expect(sourceFrame.getByText('Sibling fallback', { exact: true })).toBeVisible();
    await expect(sourceFrame.getByText('The Reports route handled its own error.')).toBeVisible();
    await expect(sourceFrame.getByRole('status')).toHaveText('Reports handled its own loading failure');
    await expect(sourcePlayground.locator('.preview-label code')).toHaveText('/reports');

    const parentExample = page.locator('[data-e2e="parent-error-example"]');
    const parentPlayground = parentExample.locator('.playground-page');
    await expect(parentPlayground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const parentFrame = parentPlayground.frameLocator('[data-e2e="playground-preview"]');
    await parentFrame.getByRole('link', { name: 'Reports' }).click();
    await expect(parentFrame.getByRole('heading', { name: 'Workspace', exact: true })).toBeVisible();
    await expect(parentFrame.getByRole('heading', { name: 'Workspace recovery' })).toBeVisible();
    await expect(parentFrame.getByText('Parent boundary', { exact: true })).toBeVisible();
    await expect(parentFrame.getByText('Child route stage', { exact: true })).toBeVisible();
    await expect(parentFrame.getByText('Sibling fallback inside parent', { exact: true })).toBeVisible();
    await expect(parentFrame.getByText('The parent Workspace handled the child Reports failure.')).toBeVisible();
    await expect(parentFrame.getByRole('status')).toHaveText('Workspace handled /reports');
    await expect(parentFrame.getByText('Boundary: /workspace')).toBeVisible();

    const grandparentExample = page.locator('[data-e2e="grandparent-error-example"]');
    const grandparentPlayground = grandparentExample.locator('.playground-page');
    await expect(grandparentPlayground.getByRole('status')).toContainText('Running', { timeout: 60000 });
    const grandparentFrame = grandparentPlayground.frameLocator('[data-e2e="playground-preview"]');
    await grandparentFrame.getByRole('link', { name: 'Reports' }).click();
    await expect(grandparentFrame.getByRole('heading', { name: 'Portal', exact: true })).toBeVisible();
    await expect(grandparentFrame.getByRole('heading', { name: 'Workspace', exact: true })).toBeVisible();
    await expect(grandparentFrame.getByRole('heading', { name: 'Portal recovery' })).toBeVisible();
    await expect(grandparentFrame.getByText('Grandparent boundary', { exact: true })).toBeVisible();
    await expect(grandparentFrame.getByText('Parent route · no boundary', { exact: true })).toBeVisible();
    await expect(grandparentFrame.getByText('Grandchild route stage', { exact: true })).toBeVisible();
    await expect(grandparentFrame.getByText('The grandparent Portal handled the Reports failure.')).toBeVisible();
    await expect(grandparentFrame.getByText('The immediate parent Workspace still owns recovery state.')).toBeVisible();
    await expect(grandparentFrame.getByRole('status')).toHaveText('Portal handled /reports');
    await expect(grandparentFrame.getByText('Boundary: /portal')).toBeVisible();
    await expect(grandparentFrame.getByText('Recovery owner: /workspace')).toBeVisible();

    await sourceFrame.getByRole('button', { name: 'Allow reports retry' }).click();
    await sourceFrame.getByRole('link', { name: 'Home' }).click();
    await sourceFrame.getByRole('link', { name: 'Reports' }).click();
    await expect(sourceFrame.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible();
    await expect(sourceFrame.getByRole('heading', { name: 'Reports could not load' })).toHaveCount(0);
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
