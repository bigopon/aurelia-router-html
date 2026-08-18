import { isPromise, onResolve, resolve, IContainer, IPlatform, Registration } from '@aurelia/kernel';
import { IExpressionParser, type IsBindingBehavior } from '@aurelia/expression-parser';
import { astEvaluate, queueAsyncTask, Scope } from '@aurelia/runtime';
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
import { IRouteCoordinator, RouteCoordinator } from './coordinator';
import type { RouteCanLoadCallback, RouteCanUnloadCallback, RouteGuardFailure } from './guard';
import type { RouteErrorHandler } from './error';
import { IRouteContext, RouteContext, type SwapOrder } from './route-context';
import { IRouteTitleService } from './title';
import { IRouteViewSettlement } from './settlement';

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
    bindables: ['path', 'redirectTo', 'title', 'canLoad', 'canUnload', 'onError'],
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
      const loadingExpression = node.getAttribute('loading.bind');
      const loadedExpression = node.getAttribute('loaded.bind');
      node.removeAttribute('loading.bind');
      node.removeAttribute('loaded.bind');
      data.loadingExpression = loadingExpression;
      data.loadedExpression = loadedExpression;
      const title = node.getAttribute('title');
      const shorthandTitleExpression = node.getAttribute(':title');
      if (shorthandTitleExpression != null) {
        node.removeAttribute(':title');
        if (!node.hasAttribute('title.bind') && !node.hasAttribute('title.to-view')) {
          node.setAttribute('title.bind', shorthandTitleExpression);
        }
      }
      const hasBoundTitle = node.hasAttribute('title.bind')
        || node.hasAttribute('title.to-view')
        || shorthandTitleExpression != null;
      if (__DEV__ && !hasBoundTitle && title?.includes('${') === true) {
        console.warn(`[au-route] The title value "${title}" looks like an interpolation. Dynamic titles must use title.bind, title.to-view, or :title.`);
      }
      data.title = title;
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
      const guardFailure = node.getAttribute('guard-failure') ?? 'navigation';
      if (guardFailure !== 'navigation' && guardFailure !== 'local') {
        throw new Error(`Invalid au-route guard-failure "${guardFailure}". Expected "navigation" or "local".`);
      }
      data.guardFailure = guardFailure;
      data.swapOrder = node.getAttribute('swap-order') as SwapOrder | null;
      data.animate = node.hasAttribute('animate');
      data.exact = node.hasAttribute('exact');
      data.fallback = node.hasAttribute('fallback');
    },
  };

  public path: string = '/';
  public redirectTo: string | null = null;
  public title: string | null = null;
  public canLoad: RouteCanLoadCallback | null = null;
  public canUnload: RouteCanUnloadCallback | null = null;
  public onError: RouteErrorHandler | null = null;
  public view: ISyntheticView | null = null;
  public context: IRouteContext;
  public readonly location = resolve(IRenderLocation);
  public readonly factory: IViewFactory | null;
  public readonly overrideContext: Record<string, unknown> = {};
  private readonly lifecycleOverrideContext: Record<string, unknown> = Object.create(this.overrideContext);
  private readonly animationOptions = resolve(IRouteAnimationOptions);
  private readonly animationsEnabled: boolean;
  private readonly expressionParser = resolve(IExpressionParser);
  private readonly platform = resolve(IPlatform) as AnimationPlatform;
  private readonly titleService = resolve(IRouteTitleService);
  private readonly settlement = resolve(IRouteViewSettlement);
  private readonly coordinator = resolve(IRouteCoordinator) as RouteCoordinator;
  private readonly pathExpression: string | null;
  private readonly loadingExpression: string | null;
  private readonly loadedExpression: string | null;
  private loadingAst: IsBindingBehavior | null = null;
  private loadedAst: IsBindingBehavior | null = null;
  private readonly redirectMode: RedirectMode;
  private readonly isRedirect: boolean;
  private readonly unsubscribe: () => void;
  private viewActive: boolean = false;
  private requestedViewActive: boolean = false;
  private viewTransition: Promise<void> | null = null;
  private animationRunId: number = 0;
  private lastRedirectKey: string | null = null;

  public constructor() {
    const parentContext = resolve(IRouteContext);
    const rendering = resolve(IRendering);
    const container = resolve(IContainer);
    const instruction = resolve(IInstruction) as HydrateElementInstruction<{ animate: boolean; exact: boolean; fallback: boolean; guardFailure: RouteGuardFailure; isRedirect: boolean; loadedExpression: string | null; loadingExpression: string | null; path: string; pathExpression: string | null; redirectMode: RedirectMode; redirectTo: string | null; swapOrder: SwapOrder | null; title: string | null }>;
    const { projections, data: { animate, exact, fallback, guardFailure, isRedirect, loadedExpression, loadingExpression, path, pathExpression, redirectMode, redirectTo, swapOrder, title } } = instruction;
    const { default: routeComponentDefinition } = projections ?? {};
    const childContainer = container.createChild();
    this.factory = isRedirect ? null : rendering.getViewFactory(routeComponentDefinition, childContainer);

    this.context = parentContext.createChild(path, {
      exact,
      fallback,
      guardFailure,
      swapOrder: swapOrder ?? undefined,
    });
    this.path = path;
    this.title = title;
    (this.context as RouteContext)._setTitle(title);
    this.pathExpression = pathExpression;
    this.loadingExpression = loadingExpression;
    this.loadedExpression = loadedExpression;
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
      const wasActive = this.isActive;
      this.isActive = state.active;
      if (state.active && !wasActive) {
        this.lastRedirectKey = null;
      }
      this.overrideContext.$params = state.params;
      this.overrideContext.$query = state.query;
      this.overrideContext.$hash = state.hash;
      this.tryRedirect();
    });
    childContainer.register(Registration.instance(IRouteContext, this.context));
  }

  $controller!: ICustomElementController<this>;

  private scope?: Scope | null = null;
  private lifecycleScope?: Scope | null = null;
  public $params?: Record<string, unknown>;

  public binding(_initiator: IHydratedController, parent: IHydratedController): void | Promise<void> {
    this.scope ??= Scope.fromParent(parent.scope, parent.scope.bindingContext, this.overrideContext);
    this.lifecycleScope ??= Scope.fromParent(parent.scope, parent.scope.bindingContext, this.lifecycleOverrideContext);
    this.updateErrorHandler();
    if (this.pathExpression != null) {
      const expression = this.expressionParser.parse(this.pathExpression, 'None');
      this.path = String(astEvaluate(expression, this.scope, null, null));
    }
    this.loadingAst ??= this.loadingExpression == null ? null : this.expressionParser.parse(this.loadingExpression, 'None');
    this.loadedAst ??= this.loadedExpression == null ? null : this.expressionParser.parse(this.loadedExpression, 'None');
    this.updatePath(this.path);

    this.requestedViewActive = this.isActive && !this.isRedirect;
    this.tryRedirect();
    return this.queueViewUpdate();
  }

  public bound(): void {
    this.updateTitle(this.title);
    this.updateGuards();
    this.updateErrorHandler();
  }

  public canLoadChanged(): void {
    this.updateGuards();
  }

  public canUnloadChanged(): void {
    this.updateGuards();
  }

  public onErrorChanged(): void {
    this.updateErrorHandler();
  }

  public pathChanged(path: string): void {
    this.updatePath(path);
  }

  public redirectToChanged(value: string | null): void {
    this.redirectTo = value;
    this.tryRedirect();
  }

  public titleChanged(value: unknown): void {
    this.updateTitle(value);
  }

  private updateTitle(value: unknown): void {
    this.title = value == null ? null : String(value);
    (this.context as RouteContext)._setTitle(this.title);
    if (this.context.active && !this.isRedirect) {
      this.titleService.requestUpdate();
    }
  }

  private updateGuards(): void {
    (this.context as RouteContext)._setGuards(this.canLoad, this.canUnload);
  }

  private updateErrorHandler(): void {
    (this.context as RouteContext)._setErrorHandler(this.onError);
  }

  private tryRedirect(): void {
    if (this.coordinator._isRollingBack || !this.isRedirect || !this.isActive || this.scope == null || this.redirectTo == null || this.redirectTo.trim() === '') {
      return;
    }
    const parent = this.context.parent;
    if (!(parent instanceof RouteContext)) {
      throw new Error('An au-route redirect requires a parent route context.');
    }
    const redirectKey = `${this.context.$path}\0${this.redirectTo}\0${this.redirectMode}`;
    if (this.lastRedirectKey === redirectKey) {
      return;
    }
    this.lastRedirectKey = redirectKey;
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
      (this.context as RouteContext)._deactivate();
    }
  }

  public unbinding(_initiator: IHydratedController, _parent: IHydratedController): void | Promise<void> {
    this.scope = void 0;
    this.lifecycleScope = void 0;
    this.lifecycleOverrideContext.$lifecycle = undefined;
    this.requestedViewActive = false;
    return this.queueViewUpdate();
  }

  public dispose(): void {
    this.unsubscribe();
    this.context.dispose();
    this.titleService.requestUpdate();
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

    const loading = this.loadingAst;
    return this.coordinator._runRouteActivation(this.context as RouteContext, this.canLoad, () => onResolve(
      this.invokeLifecycle('loading', loading),
      value => {
        if (loading != null) {
          (this.context as RouteContext)._setData('loading', value);
        }
        if (!this.requestedViewActive || this.scope == null) {
          return;
        }

        const scope = this.scope;
        this.view ??= this.getView();
        const view = this.view;
        this.viewActive = true;
        this.settlement.begin();
        let activation: void | Promise<void>;
        try {
          activation = this.coordinator._runRoutePhase('activation', () => view.activate(view, this.$controller, scope));
        } catch (error) {
          this.endViewActivation();
          throw error;
        }

        const loaded = this.loadedAst;
        const ready = onResolve(activation, () => onResolve(
          this.invokeLifecycle('loaded', loaded),
          value => {
            if (loaded != null) {
              (this.context as RouteContext)._setData('loaded', value);
            }
          },
        ));
        if (isPromise(ready)) {
          return ready.then(
            () => {
              this.endViewActivation();
              return this.coordinator._runEnterAnimation(() => this.animate('enter'));
            },
            error => {
              this.endViewActivation();
              throw error;
            },
          );
        }
        this.endViewActivation();
        return this.coordinator._runEnterAnimation(() => this.animate('enter'));
      },
    ));
  }

  private invokeLifecycle(phase: 'loading' | 'loaded', expression: IsBindingBehavior | null): unknown | Promise<unknown> {
    if (expression == null || this.lifecycleScope == null) {
      return;
    }
    const context = this.coordinator._createLifecycleContext(this.context as RouteContext);
    this.lifecycleOverrideContext.$lifecycle = context;
    try {
      return this.coordinator._runRoutePhase(phase, () => astEvaluate(expression, this.lifecycleScope!, null, null));
    } finally {
      this.lifecycleOverrideContext.$lifecycle = undefined;
    }
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
        this.titleService.requestUpdate();
      });
    });
  }

  private endViewActivation(): void {
    this.settlement.end();
    this.titleService.requestUpdate();
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
