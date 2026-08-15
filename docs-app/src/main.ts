import Aurelia from 'aurelia';
import { Registration } from '@aurelia/kernel';
import { Routing } from '../../router/configuration';
import { DocsApp } from './pages/docs-app';
import { PlaygroundPage } from './pages/playground-page';
import { DocsState } from './state/docs-state';
import { SyntaxHtml } from './resources/syntax-html';
import './main.css';

void Aurelia
  .register(
    Routing.customize({
      interceptLinks: true,
      animations: false,
    }),
    SyntaxHtml,
    PlaygroundPage,
    Registration.singleton(DocsState, DocsState),
  )
  .app({
    host: document.querySelector('docs-app')!,
    component: DocsApp,
  })
  .start();
