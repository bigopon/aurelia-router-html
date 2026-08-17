# Aurelia Router HTML

HTML-first routing for Aurelia 2 applications.

## Installation

```sh
npm install aurelia-router-html
```

## Usage

```ts
import Aurelia from 'aurelia';
import { Routing } from 'aurelia-router-html';
import { App } from './app';

void Aurelia
  .register(Routing)
  .app({
    host: document.querySelector('#app'),
    component: App,
  })
  .start();
```

Declare routes with `<au-route>` and navigate with `<au-link>`. The browser adapter uses pathname URLs by default; hash, query, memory, and custom adapters are also supported.

This package currently targets Aurelia `2.0.0-rc.2`.

## License

[MIT](LICENSE)
