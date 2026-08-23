import { expect, test } from '@playwright/test';

test.describe('router HTML docs search', () => {
  test('desktop theme toggle stays in place while the search field expands', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');

    const themeToggle = page.locator('.desktop-theme-switch');
    const searchInput = page.locator('#docs-search-input');

    const before = await themeToggle.boundingBox();
    await searchInput.focus();
    const after = await themeToggle.boundingBox();

    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
    expect(after?.x).toBe(before?.x);
    expect(after?.y).toBe(before?.y);
  });

  test('escape closes the search and keyboard navigation keeps the active result highlighted', async ({ page }) => {
    await mockSearchIndex(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');

    const searchInput = page.locator('#docs-search-input');
    await searchInput.focus();
    await searchInput.fill('router');
    await expect(page.locator('.docs-search-results')).toBeVisible();

    await page.keyboard.press('ArrowDown');

    const firstResult = page.locator('.docs-search-link').nth(0);
    const secondResult = page.locator('.docs-search-link').nth(1);

    await expect(firstResult).toHaveClass(/is-focused/);
    await secondResult.hover();
    await expect(secondResult).toHaveClass(/is-focused/);
    await expect(firstResult).not.toHaveClass(/is-focused/);

    await page.keyboard.press('Escape');

    await expect(page.locator('body')).not.toHaveClass(/docs-search-open/);
    await expect(searchInput).not.toBeFocused();
  });

  test('lazy loading keeps the intended keyboard selection highlighted across appended results', async ({ page }) => {
    await mockSearchIndex(page, { totalResults: 16, delayMs: 30 });
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');

    const searchInput = page.locator('#docs-search-input');
    await searchInput.focus();
    await searchInput.fill('router');
    await expect(page.locator('.docs-search-link')).toHaveCount(8);

    for (let index = 0; index < 8; index++) {
      await page.keyboard.press('ArrowDown');
    }

    await expect(page.locator('.docs-search-link')).toHaveCount(16);
    await expect(page.locator('.docs-search-link.is-focused')).toHaveCount(1);
    await expect(page.locator('.docs-search-link').nth(6)).toHaveClass(/is-focused/);

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');

    await expect(page.locator('.docs-search-link').nth(8)).toHaveClass(/is-focused/);
    await expect(page.locator('.docs-search-link.is-focused')).toHaveCount(1);
  });
});

async function mockSearchIndex(page, options = {}) {
  const totalResults = options.totalResults ?? 2;
  const delayMs = options.delayMs ?? 0;

  await page.route('**/pagefind/pagefind.js', async route => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: `
        export async function init() {}
        export async function search() {
          return {
            results: Array.from({ length: ${totalResults} }, (_, index) => ({
              async data() {
                if (${delayMs} > 0) {
                  await new Promise(resolve => setTimeout(resolve, ${delayMs}));
                }
                return {
                  url: '/features/result-' + (index + 1),
                  excerpt: 'Search result ' + (index + 1) + ' for <mark>router</mark> docs',
                  meta: {
                    title: 'Result ' + (index + 1),
                    section: index % 2 === 0 ? 'Features' : 'Guides',
                  },
                };
              },
            })),
          };
        }
      `,
    });
  });
}
