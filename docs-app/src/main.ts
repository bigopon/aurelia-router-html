import Aurelia from 'aurelia';
import { Routing } from '../../router/configuration';
import { DocsApp } from './pages/docs-app';
import { PlaygroundPage } from './pages/playground-page';
import { SyntaxHtml } from './resources/syntax-html';
import { SyntaxTypeScript } from './resources/syntax-typescript';
import './main.css';

void Aurelia
  .register(
    Routing.customize({
      animations: false,
    }),
    SyntaxHtml,
    SyntaxTypeScript,
    PlaygroundPage,
  )
  .app({
    host: document.querySelector('docs-app')!,
    component: DocsApp,
  })
  .start();
