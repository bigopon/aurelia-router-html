import type { PathAdapter } from './path-adapter';

export interface BrowserAdapterOptions {
  interceptLinks?: boolean;
}

export class BrowserPathAdapter implements PathAdapter {
  public constructor(
    private readonly window: Window,
    private readonly options: BrowserAdapterOptions = {},
  ) {}

  public getCurrentPath(): string {
    return this.window.location.pathname || '/';
  }

  public push(path: string): void {
    this.window.history.pushState(null, '', path);
  }

  public replace(path: string): void {
    this.window.history.replaceState(null, '', path);
  }

  public subscribe(callback: (path: string) => void): () => void {
    const onPopState = () => {
      callback(this.getCurrentPath());
    };

    const onClick = (event: MouseEvent) => {
      if (!this.options.interceptLinks || event.defaultPrevented || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      const anchor = target instanceof Element
        ? target.closest('a[href]')
        : null;

      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      if (anchor.hasAttribute('download') || anchor.hasAttribute('external') || anchor.hasAttribute('data-external')) {
        return;
      }

      const anchorTarget = anchor.getAttribute('target');
      if (anchorTarget != null && anchorTarget !== '' && anchorTarget !== '_self' && anchorTarget !== this.window.name) {
        return;
      }

      const url = new URL(anchor.href, this.window.document.baseURI);
      if (url.origin !== this.window.location.origin) {
        return;
      }

      event.preventDefault();
      const nextPath = url.pathname || '/';
      this.push(nextPath);
      callback(nextPath);
    };

    this.window.addEventListener('popstate', onPopState);
    if (this.options.interceptLinks) {
      this.window.document.addEventListener('click', onClick);
    }

    return () => {
      this.window.removeEventListener('popstate', onPopState);
      if (this.options.interceptLinks) {
        this.window.document.removeEventListener('click', onClick);
      }
    };
  }
}
