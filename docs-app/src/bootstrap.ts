import Aurelia from 'aurelia';
import type { IPathAdapter } from '../../router/path-adapter';
import { Routing } from '../../router/configuration';
import { DocsApp } from './pages/docs-app';
import { SyntaxHtml } from './resources/syntax-html';
import { SyntaxCss } from './resources/syntax-css';
import { SyntaxTypeScript } from './resources/syntax-typescript';
import { DocsSearch } from './resources/docs-search';
import './main.css';

export interface DocsAppOptions {
  adapter?: IPathAdapter;
  resources?: readonly unknown[];
}

export function createDocsApp(host: HTMLElement, options: DocsAppOptions = {}): Aurelia {
  const routing = options.adapter == null
    ? Routing.customize({
      animations: false,
      focus: true,
      titles: {
        fallback: 'Aurelia Router HTML',
        compose: titles => `${titles[0]} | Aurelia Router HTML`,
      },
    })
    : Routing.customize({
      adapter: options.adapter,
      animations: false,
      titles: false,
      scrolling: false,
      focus: false,
    });

  return Aurelia
    .register(
      routing,
      SyntaxHtml,
      SyntaxCss,
      SyntaxTypeScript,
      DocsSearch,
      ...(options.resources ?? []),
    )
    .app({
      host,
      component: DocsApp,
    }) as Aurelia;
}
