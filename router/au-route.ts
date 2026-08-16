import { isPromise, onResolve, resolve, IContainer, IPlatform, Registration } from '@aurelia/kernel';
import { astEvaluate, queueAsyncTask, Scope } from '@aurelia/runtime';
import { IExpressionParser } from 'aurelia';
import {
  CustomElementStaticAuDefinition,
  ICustomElementController,
  ICustomElementViewModel,
  IHydratedController,
  IRendering,
  IRenderLocation,
  ISyntheticView,
  IViewFactory,
} from '@aurelia/runtime-html';
import {
  IInstruction,
  HydrateElementInstruction,
} from '@aurelia/template-compiler';
import { IRouteAnimationOptions } from './animation';
import { IRouteContext, RouteContext, type SwapOrder } from './route-context';

declare const __DEV__: boolean;

type AnimationPlatform = IPlatform & {
  readonly requestAnimationFrame: typeof requestAnimationFrame;
};

type RedirectMode = 'replace' | 'push';

export class AuRoute implements ICustomElementViewModel {
  public static readonly $au: CustomElementStaticAuDefinition = {
    type: 'custom-element',
    name: 'au-route',
    containerless: true,
    template: null,
    bindables: ['path', 'redirectTo'],
    processContent: (node, _, data) => {
      const path = node.getAttribute('path');
      const boundPathExpression = node.getAttribute('path.bind') ?? node.getAttribute('path.to-view');
      const shorthandPathExpression = node.getAttribute(':path');
      const pathExpression = boundPathExpression ?? shorthandPathExpression;
      if (shorthandPathExpression != null) {
        node.removeAttribute(':path');
        if (boundPathExpression == null) {
          node.setAttribute('path.bind', shorthandPathExpression);
        }
      }
      const hasBoundPath = pathExpression != null;
      if (__DEV__ && !hasBoundPath && path?.includes('${') === true) {
        console.warn(`[au-route] The path value "${path}" looks like an interpolation. Dynamic paths must use path.bind, path.to-view, or :path.`);
      }
      data.path = path ?? (hasBoundPath ? '/__pending_route_path__' : '/');
      data.pathExpression = pathExpression;
      const redirectTo = node.getAttribute('redirect-to');
      const boundRedirectExpression = node.getAttribute('redirect-to.bind') ?? node.getAttribute('redirect-to.to-view');
      const shorthandRedirectExpression = node.getAttribute(':redirect-to');
      const redirectExpression = boundRedirectExpression ?? shorthandRedirectExpression;
      if (shorthandRedirectExpression != null) {
        node.removeAttribute(':redirect-to');
        if (boundRedirectExpression == null) {
          node.setAttribute('redirect-to.bind', shorthandRedirectExpression);
        }
      }
      if (__DEV__ && redirectExpression == null && redirectTo?.includes('${') === true) {
        console.warn(`[au-route] The redirect-to value "${redirectTo}" looks like an interpolation. Dynamic redirects must use redirect-to.bind, redirect-to.to-view, or :redirect-to.`);
      }
      const redirectMode = node.getAttribute('redirect-mode') ?? 'replace';
      if (redirectMode !== 'replace' && redirectMode !== 'push') {
        throw new Error(`Invalid au-route redirect-mode "${redirectMode}". Expected "replace" or "push".`);
      }
      data.redirectTo = redirectTo;
      data.redirectMode = redirectMode;
      data.isRedirect = redirectTo != null || redirectExpression != null;
      data.swapOrder = node.getAttribute('swap-order') as SwapOrder | null;
      data.animate = node.hasAttribute('animate');
      data.exact = node.hasAttribute('exact');
      data.fallback = node.hasAttribute('fallback');
    },
  };

  public path: string = '/';
  public redirectTo: string | null = null;
  public view: ISyntheticView | null = null;
  public context: IRouteContext;
  public readonly location = resolve(IRenderLocation);
  public readonly factory: IViewFactory | null;
  public readonly overrideContext: Record<string, unknown> = {};
  private readonly animationOptions = resolve(IRouteAnimationOptions);
  private readonly animationsEnabled: boolean;
  private readonly expressionParser = resolve(IExpressionParser);
  private readonly platform = resolve(IPlatform) as AnimationPlatform;
  private readonly pathExpression: string | null;
  private readonly redirectMode: RedirectMode;
  private readonly isRedirect: boolean;
  private readonly unsubscribe: () => void;
  private viewActive: boolean = false;
  private requestedViewActive: boolean = false;
  private viewTransition: Promise<void> | null = null;
  private animationRunId: number = 0;

  public constructor() {
    const parentContext = resolve(IRouteContext);
    const rendering = resolve(IRendering);
    const container = resolve(IContainer);
    const instruction = resolve(IInstruction) as HydrateElementInstruction<{ animate: boolean; exact: boolean; fallback: boolean; isRedirect: boolean; path: string; pathExpression: string | null; redirectMode: RedirectMode; redirectTo: string | null; swapOrder: SwapOrder | null }>;
    const { projections, data: { animate, exact, fallback, isRedirect, path, pathExpression, redirectMode, redirectTo, swapOrder } } = instruction;
    const { default: routeComponentDefinition } = projections ?? {};
    const childContainer = container.createChild();
    this.factory = isRedirect ? null : rendering.getViewFactory(routeComponentDefinition, childContainer);

    this.context = parentContext.createChild(path, {
      exact,
      fallback,
      swapOrder: swapOrder ?? undefined,
    });
    this.path = path;
    this.pathExpression = pathExpression;
    this.redirectTo = redirectTo;
    this.redirectMode = redirectMode;
    this.isRedirect = isRedirect;
    this.animationsEnabled = this.animationOptions.enabled || animate;
    this.overrideContext.$pattern = path;
    this.overrideContext.$params = this.context.$params;
    this.overrideContext.$query = this.context.$query;
    this.overrideContext.$hash = this.context.$hash;
    this.overrideContext.$route = this.context;
    this.isActive = this.context.active;
    this.unsubscribe = this.context.subscribe(state => {
      this.isActive = state.active;
      this.overrideContext.$params = state.params;
      this.overrideContext.$query = state.query;
      this.overrideContext.$hash = state.hash;
      this.tryRedirect();
    });
    childContainer.register(Registration.instance(IRouteContext, this.context));
  }

  $controller!: ICustomElementController<this>;

  private scope?: Scope | null = null;
  public $params?: Record<string, unknown>;

  public binding(_initiator: IHydratedController, parent: IHydratedController): void | Promise<void> {
    this.scope ??= Scope.fromParent(parent.scope, parent.scope.bindingContext, this.overrideContext);
    if (this.pathExpression != null) {
      const expression = this.expressionParser.parse(this.pathExpression, 'None');
      this.path = String(astEvaluate(expression, this.scope, null, null));
    }
    this.updatePath(this.path);

    this.requestedViewActive = this.isActive && !this.isRedirect;
    this.tryRedirect();
    return this.queueViewUpdate();
  }

  public pathChanged(path: string): void {
    this.updatePath(path);
  }

  public redirectToChanged(value: string | null): void {
    this.redirectTo = value;
    this.tryRedirect();
  }

  private tryRedirect(): void {
    if (!this.isRedirect || !this.isActive || this.scope == null || this.redirectTo == null || this.redirectTo.trim() === '') {
      return;
    }
    const parent = this.context.parent;
    if (!(parent instanceof RouteContext)) {
      throw new Error('An au-route redirect requires a parent route context.');
    }
    parent._redirect(this.redirectTo, this.context.$params, this.redirectMode !== 'push');
  }

  private updatePath(path: string): void {
    if (path === this.context.pattern) {
      return;
    }

    this.context.usePattern(path);
    this.overrideContext.$pattern = path;
    const parent = this.context.parent;
    if (parent?.active === true) {
      parent.refresh();
    } else {
      this.context.apply('/__inactive__');
    }
  }

  public unbinding(_initiator: IHydratedController, _parent: IHydratedController): void | Promise<void> {
    this.scope = void 0;
    this.requestedViewActive = false;
    return this.queueViewUpdate();
  }

  public dispose(): void {
    this.unsubscribe();
    this.context.dispose();
  }

  private _isActive: boolean = false;
  public get isActive() {
    return this._isActive;
  }
  public set isActive(value: boolean) {
    this._isActive = value;
    this.requestedViewActive = value && !this.isRedirect;
    if (!this.$controller?.isActive) {
      return;
    }

    void this.queueViewUpdate();
  }

  private queueViewUpdate(): void | Promise<void> {
    const update = this.viewTransition == null
      ? this.updateView()
      : this.viewTransition.then(() => this.updateView());
    if (!isPromise(update)) {
      return;
    }

    const pending = update.catch(() => {});
    this.viewTransition = pending;
    void pending.then(() => {
      if (this.viewTransition === pending) {
        this.viewTransition = null;
      }
    });
    return update;
  }

  private updateView(): void | Promise<void> {
    while (this.viewActive !== this.requestedViewActive) {
      let transition: void | Promise<void>;
      if (this.requestedViewActive) {
        if (this.scope == null) {
          return;
        }
        transition = this.activateView();
      } else {
        transition = this.deactivateView();
      }
      if (isPromise(transition)) {
        return transition.then(() => this.updateView());
      }
    }
  }

  private getView() {
    return this.factory!.create().setLocation(this.location);
  }

  private activateView(): void | Promise<void> {
    if (this.viewActive || this.scope == null) {
      return;
    }

    this.view ??= this.getView();
    this.viewActive = true;
    return onResolve(
      this.view.activate(this.view, this.$controller, this.scope),
      () => this.animate('enter'),
    );
  }

  private deactivateView(): void | Promise<void> {
    if (!this.viewActive || this.view == null) {
      return;
    }

    const view = this.view;
    return onResolve(this.animate('leave'), () => {
      this.viewActive = false;
      return onResolve(view.deactivate(view, this.$controller), () => {
        this.clearViewLocation();
        view.dispose();
        if (this.view === view) {
          this.view = null;
        }
      });
    });
  }

  private clearViewLocation(): void {
    // Nested controllers can detach their sequences before the route view, so clear any emptied hosts still owned by this location.
    const start = this.location.$start;
    let current = start?.nextSibling ?? null;
    while (current != null && current !== this.location) {
      const next = current.nextSibling;
      current.remove();
      current = next;
    }
  }

  private animate(direction: 'enter' | 'leave'): void | Promise<void> {
    if (!this.animationsEnabled || this.view == null) {
      return;
    }

    const elements = this.getAnimationElements();
    if (elements.length === 0) {
      return;
    }

    return this.runAnimation(direction, elements);
  }

  private async runAnimation(direction: 'enter' | 'leave', elements: HTMLElement[]): Promise<void> {
    const runId = ++this.animationRunId;
    const prefix = this.animationOptions.classPrefix;
    const fromClass = `${prefix}-${direction}-from`;
    const activeClass = `${prefix}-${direction}-active`;
    const stateClass = `${prefix}-animating`;

    this.clearAnimationClasses(elements);
    for (const element of elements) {
      element.classList.add(stateClass, fromClass);
      element.dataset.auRouteTransition = direction;
    }

    await this.nextFrame();
    if (runId !== this.animationRunId) {
      this.clearAnimationClasses(elements);
      return;
    }

    for (const element of elements) {
      element.classList.add(activeClass);
      element.classList.remove(fromClass);
    }

    const duration = Math.max(
      this.animationOptions.fallbackMs,
      ...elements.map(element => this.getElementAnimationDuration(element)),
    );

    if (duration > 0) {
      await queueAsyncTask(() => {}, { delay: duration + 34 });
    }

    if (runId !== this.animationRunId) {
      this.clearAnimationClasses(elements);
      return;
    }

    this.clearAnimationClasses(elements);
  }

  private getAnimationElements(): HTMLElement[] {
    const nodes = Array.from(this.view?.nodes.childNodes ?? []);
    return nodes.filter((node): node is HTMLElement => node instanceof this.platform.globalThis.HTMLElement);
  }

  private getElementAnimationDuration(element: HTMLElement): number {
    const style = this.platform.globalThis.getComputedStyle(element);
    const transitionDurations = parseTimeList(style.transitionDuration);
    const transitionDelays = parseTimeList(style.transitionDelay);
    const animationDurations = parseTimeList(style.animationDuration);
    const animationDelays = parseTimeList(style.animationDelay);

    const transitionTotal = transitionDurations.reduce((max, duration, index) => Math.max(max, duration + (transitionDelays[index] ?? transitionDelays[0] ?? 0)), 0);
    const animationTotal = animationDurations.reduce((max, duration, index) => Math.max(max, duration + (animationDelays[index] ?? animationDelays[0] ?? 0)), 0);

    return Math.max(transitionTotal, animationTotal, 0);
  }

  private nextFrame(): Promise<void> {
    return new Promise(resolve => {
      this.platform.requestAnimationFrame(() => {
        this.platform.requestAnimationFrame(() => resolve());
      });
    });
  }

  private clearAnimationClasses(elements: HTMLElement[]): void {
    const prefix = this.animationOptions.classPrefix;
    const classes = [
      `${prefix}-animating`,
      `${prefix}-enter-from`,
      `${prefix}-enter-active`,
      `${prefix}-leave-from`,
      `${prefix}-leave-active`,
    ];

    for (const element of elements) {
      element.classList.remove(...classes);
      delete element.dataset.auRouteTransition;
    }
  }
}

function parseTimeList(value: string): number[] {
  return value.split(',').map(part => {
    const trimmed = part.trim();
    if (trimmed.endsWith('ms')) {
      return Number.parseFloat(trimmed.slice(0, -2)) || 0;
    }
    if (trimmed.endsWith('s')) {
      return (Number.parseFloat(trimmed.slice(0, -1)) || 0) * 1000;
    }
    return 0;
  });
}
