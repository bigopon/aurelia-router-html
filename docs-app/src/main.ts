import Aurelia from 'aurelia';
import { Registration } from '@aurelia/kernel';
import { Routing } from '../../router/configuration';
import { DocsApp } from './pages/docs-app';
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
    Registration.singleton(DocsState, DocsState),
  )
  .app({
    host: document.querySelector('docs-app')!,
    component: DocsApp,
  })
  .start();
