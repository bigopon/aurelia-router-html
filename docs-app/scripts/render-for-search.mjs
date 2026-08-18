import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { BrowserPlatform } from '@aurelia/platform-browser';
import { noop } from '@aurelia/kernel';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, '.pagefind-source');
const dom = new JSDOM('<!doctype html><html lang="en"><head></head><body></body></html>', {
  pretendToBeVisual: true,
  url: 'https://aurelia-router-html.netlify.app/',
});
const { window } = dom;
window.scrollTo = noop;
Object.assign(globalThis, {
  window,
  document: window.document,
  Node: window.Node,
  Element: window.Element,
  HTMLElement: window.HTMLElement,
  Event: window.Event,
  EventTarget: window.EventTarget,
  CustomEvent: window.CustomEvent,
  MutationObserver: window.MutationObserver,
  customElements: window.customElements,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: window.navigator });
BrowserPlatform.set(globalThis, new BrowserPlatform(window, { fetch: noop }));

const server = await createServer({
  configFile: resolve(root, 'vite.config.mjs'),
  root,
  logLevel: 'error',
  server: { middlewareMode: true },
  appType: 'custom',
});

try {
  const { docNav } = await server.ssrLoadModule('/src/data/docs-nav.ts');
  const { renderDocsPage } = await server.ssrLoadModule('/src/prerender.ts');
  const paths = docNav
    .filter(item => item.path !== '/playground')
    .map(item => item.path);
  await rm(output, { recursive: true, force: true });

  for (const path of paths) {
    const rendered = await renderDocsPage(path);
    const target = path === '/'
      ? resolve(output, 'index.html')
      : resolve(output, path.slice(1), 'index.html');
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, `<!doctype html><html lang="en"><body>${rendered}</body></html>`);
  }
} finally {
  await server.close();
  dom.window.close();
}
