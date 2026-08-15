import { IContainer, Registration } from '@aurelia/kernel';
import { AppTask } from 'aurelia';
import { IRouteAnimationOptions, normalizeRouteAnimationOptions, type RouteAnimationInput } from '../../../router/animation';
import { AuRoute } from '../../../router/au-route';
import { IRouteCoordinator, RouteCoordinator } from '../../../router/coordinator';
import type { PathAdapter } from '../../../router/path-adapter';
import { IRouteContext, RouteContext, type SwapOrder } from '../../../router/route-context';

interface PlaygroundRoutingOptions {
  swapOrder?: SwapOrder;
  animations?: RouteAnimationInput;
  interceptLinks?: boolean;
}

class MemoryPathAdapter implements PathAdapter {
  private path = normalizeRoutePath(globalThis.__PLAYGROUND_INITIAL_PATH__ ?? '/');
  private callback: ((path: string) => void) | null = null;

  public constructor(private readonly interceptLinks: boolean) {}

  public getCurrentPath(): string {
    return this.path;
  }

  public push(path: string): void {
    this.setPath(path);
  }

  public replace(path: string): void {
    this.setPath(path);
  }

  public subscribe(callback: (path: string) => void): () => void {
    this.callback = callback;
    document.addEventListener('click', this.onClick);
    return () => {
      document.removeEventListener('click', this.onClick);
      this.callback = null;
    };
  }

  private readonly onClick = (event: MouseEvent): void => {
    if (!this.interceptLinks || event.defaultPrevented || event.button !== 0) {
      return;
    }
    const target = event.target;
    const anchor = target instanceof Element ? target.closest('a[href]') : null;
    if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute('data-external')) {
      return;
    }
    const href = anchor.getAttribute('href');
    if (href == null || href.startsWith('#') || /^[a-z]+:/i.test(href)) {
      return;
    }
    event.preventDefault();
    const next = new URL(href, `https://playground.invalid${this.path}`).pathname;
    this.setPath(next);
  };

  private setPath(path: string): void {
    this.path = normalizeRoutePath(path);
    this.callback?.(this.path);
    window.parent.postMessage({
      channel: 'router-html-playground',
      type: 'navigation',
      path: this.path,
    }, '*');
  }
}

export function createPlaygroundRouting() {
  const register = (options: PlaygroundRoutingOptions = {}) => (container: IContainer) => {
    const root = new RouteContext(null, '*', { swapOrder: options.swapOrder });
    const coordinator = new RouteCoordinator(root, new MemoryPathAdapter(options.interceptLinks ?? true));
    container.register(
      AuRoute,
      Registration.instance(IRouteAnimationOptions, normalizeRouteAnimationOptions(options.animations)),
      Registration.instance(IRouteContext, root),
      Registration.instance(IRouteCoordinator, coordinator),
      AppTask.creating(() => coordinator.start()),
      AppTask.deactivated(() => coordinator.stop()),
    );
  };
  return {
    register: register({}),
    customize: (options: PlaygroundRoutingOptions) => ({ register: register(options) }),
  };
}

function normalizeRoutePath(path: string): string {
  const trimmed = path.trim();
  return trimmed === '' ? '/' : trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

declare global {
  var __PLAYGROUND_INITIAL_PATH__: string | undefined;
}
