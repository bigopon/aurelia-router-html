import { MemoryPathAdapter } from '../../router/memory-path-adapter';
import { createDocsApp } from './bootstrap';

export async function renderDocsPage(path: string): Promise<string> {
  const host = document.createElement('docs-app');
  document.body.replaceChildren(host);

  const app = createDocsApp(host, { adapter: new MemoryPathAdapter(path) });
  await app.start();

  host.querySelector('h2')?.setAttribute('data-pagefind-meta', 'title');

  const html = host.outerHTML;
  await app.stop(true);
  return html;
}
