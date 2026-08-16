import Aurelia from 'aurelia';
import { Registration } from '@aurelia/kernel';
import { Routing } from '../../router/configuration';
import { DocsApp } from './pages/docs-app';
import { PlaygroundPage } from './pages/playground-page';
import { DocsState } from './state/docs-state';
import { SyntaxHtml } from './resources/syntax-html';
import { SyntaxTypeScript } from './resources/syntax-typescript';
import './main.css';

void Aurelia
  .register(
    Routing.customize({
      interceptLinks: true,
      animations: false,
    }),
    SyntaxHtml,
    SyntaxTypeScript,
    PlaygroundPage,
    Registration.singleton(DocsState, DocsState),
  )
  .app({
    host: document.querySelector('docs-app')!,
    component: DocsApp,
  })
  .start();
