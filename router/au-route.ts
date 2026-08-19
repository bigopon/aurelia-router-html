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
import type { RouteLifecycleContext, RouteTransitionCause, RouteTransitionPlan, RouteTransitionTrigger, RouteValueSnapshot } from './lifecycle';
import type { RouteErrorHandler } from './error';
import { IRouteContext, RouteContext, type RouteState, type SwapOrder } from './route-context';
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
      const group = node.hasAttribute('group');
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
      if (group && (path != null || pathExpression != null)) {
        throw new Error('An au-route group cannot also declare a path.');
      }
      data.path = path ?? (hasBoundPath ? '/__pending_route_path__' : '/');
      data.pathExpression = pathExpression;
      const loadingExpression = node.getAttribute('loading.bind');
      const loadedExpression = node.getAttribute('loaded.bind');
      node.removeAttribute('loading.bind');
      node.removeAttribute('loaded.bind');
      data.loadingExpression = loadingExpression;
      data.loadedExpression = loadedExpression;
      data.transitionOn = parseTransitionOn(node.getAttribute('transition-on'));
      data.transitionPlan = parseTransitionPlan(node.getAttribute('transition-plan'));
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
      if (group && (redirectTo != null || redirectExpression != null)) {
        throw new Error('An au-route group cannot declare redirect-to.');
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
      data.group = group;
      if (group && data.exact) {
        throw new Error('An au-route group cannot use exact matching.');
      }
      if (group && data.fallback) {
        throw new Error('An au-route group cannot be a fallback route.');
      }
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
  /** @internal */
  private readonly lifecycleOverrideContext: Record<string, unknown> = Object.create(this.overrideContext);
  /** @internal */
  private readonly animationOptions = resolve(IRouteAnimationOptions);
  /** @internal */
  private readonly animationsEnabled: boolean;
  /** @internal */
  private readonly expressionParser = resolve(IExpressionParser);
  /** @internal */
  private readonly platform = resolve(IPlatform) as AnimationPlatform;
  /** @internal */
  private readonly titleService = resolve(IRouteTitleService);
  /** @internal */
  private readonly settlement = resolve(IRouteViewSettlement);
  /** @internal */
  private readonly coordinator = resolve(IRouteCoordinator) as RouteCoordinator;
  /** @internal */
  private readonly pathExpression: string | null;
  /** @internal */
  private readonly loadingExpression: string | null;
  /** @internal */
  private readonly loadedExpression: string | null;
  /** @internal */
  private readonly transitionOn: ReadonlySet<RouteTransitionTrigger>;
  /** @internal */
  private readonly transitionPlan: RouteTransitionPlan;
  /** @internal */
  private loadingAst: IsBindingBehavior | null = null;
  /** @internal */
  private loadedAst: IsBindingBehavior | null = null;
  /** @internal */
  private readonly redirectMode: RedirectMode;
  /** @internal */
  private readonly isRedirect: boolean;
  /** @internal */
  private readonly isGroup: boolean;
  /** @internal */
  private readonly unsubscribe: () => void;
  /** @internal */
  private readonly unsubscribeNavigation: () => void;
  /** @internal */
  private viewActive: boolean = false;
  /** @internal */
  private discoveryActive: boolean = false;
  /** @internal */
  private requestedViewActive: boolean = false;
  /** @internal */
  private viewTransition: Promise<void> | null = null;
  /** @internal */
  private animationRunId: number = 0;
  /** @internal */
  private lastRedirectKey: string | null = null;
  /** @internal */
  private previousState: RouteState | null = null;
  /** @internal */
  private preflightedNavigationId: number = 0;

  public constructor() {
    const parentContext = resolve(IRouteContext);
    const rendering = resolve(IRendering);
    const container = resolve(IContainer);
    const instruction = resolve(IInstruction) as HydrateElementInstruction<{ animate: boolean; exact: boolean; fallback: boolean; group: boolean; guardFailure: RouteGuardFailure; isRedirect: boolean; loadedExpression: string | null; loadingExpression: string | null; path: string; pathExpression: string | null; redirectMode: RedirectMode; redirectTo: string | null; swapOrder: SwapOrder | null; title: string | null; transitionOn: ReadonlySet<RouteTransitionTrigger>; transitionPlan: RouteTransitionPlan }>;
    const { projections, data: { animate, exact, fallback, group, guardFailure, isRedirect, loadedExpression, loadingExpression, path, pathExpression, redirectMode, redirectTo, swapOrder, title, transitionOn, transitionPlan } } = instruction;
    const { default: routeComponentDefinition } = projections ?? {};
    const childContainer = container.createChild();
    this.factory = isRedirect ? null : rendering.getViewFactory(routeComponentDefinition, childContainer);

    this.context = parentContext.createChild(path, {
      exact,
      fallback,
      group,
      guardFailure,
      swapOrder: swapOrder ?? undefined,
    });
    (this.context as RouteContext & { _auRoute?: AuRoute })._auRoute = this;
    (this.context as RouteContext)._setRegistered(false);
    this.path = path;
    this.title = title;
    (this.context as RouteContext)._setTitle(title);
    this.pathExpression = pathExpression;
    this.loadingExpression = loadingExpression;
    this.loadedExpression = loadedExpression;
    this.transitionOn = transitionOn;
    this.transitionPlan = transitionPlan;
    this.redirectTo = redirectTo;
    this.redirectMode = redirectMode;
    this.isRedirect = isRedirect;
    this.isGroup = group;
    this.animationsEnabled = this.animationOptions.enabled || animate;
    this.overrideContext.$pattern = path;
    this.overrideContext.$params = this.context.$params;
    this.overrideContext.$query = this.context.$query;
    this.overrideContext.$hash = this.context.$hash;
    this.overrideContext.$route = this.context;
    this.overrideContext.$navigation = this.coordinator.navigation;
    this.isActive = this.context.active;
    this.unsubscribe = this.context.subscribe(state => {
      const previous = this.previousState;
      this.previousState = state;
      const wasActive = this.isActive;
      this.isActive = state.active;
      if (state.active && !wasActive) {
        this.lastRedirectKey = null;
      }
      this.overrideContext.$params = state.params;
      this.overrideContext.$query = state.query;
      this.overrideContext.$hash = state.hash;
      if (previous != null && wasActive && state.active) {
        this.tryRetainedTransition(previous, state);
      }
      this.tryRedirect();
    });
    this.unsubscribeNavigation = this.coordinator.subscribeNavigation(state => {
      this.overrideContext.$navigation = state;
    });
    childContainer.register(Registration.instance(IRouteContext, this.context));
  }

  $controller!: ICustomElementController<this>;

  /** @internal */
  private scope?: Scope | null = null;
  /** @internal */
  private lifecycleScope?: Scope | null = null;
  public $params?: Record<string, unknown>;

  public binding(_initiator: IHydratedController, parent: IHydratedController): void | Promise<void> {
    this.scope ??= Scope.fromParent(parent.scope, parent.scope.bindingContext, this.overrideContext);
    this.lifecycleScope ??= Scope.fromParent(parent.scope, parent.scope.bindingContext, this.lifecycleOverrideContext);
    (this.context as RouteContext)._setRegistered(true);
    this.updateErrorHandler();
    if (this.pathExpression != null) {
      const expression = this.expressionParser.parse(this.pathExpression, 'None');
      this.path = String(astEvaluate(expression, this.scope, null, null));
    }
    this.loadingAst ??= this.loadingExpression == null ? null : this.expressionParser.parse(this.loadingExpression, 'None');
    this.loadedAst ??= this.loadedExpression == null ? null : this.expressionParser.parse(this.loadedExpression, 'None');
    this.updatePath(this.path);
    const prepared = this.ensureDiscoveryView();
    const update = onResolve(prepared, () => {
      this.updateRequestedViewActive();
      this.tryRedirect();
      return this.queueViewUpdate();
    });
    return isPromise(update) ? update : undefined;
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

  /** @internal */
  private updateTitle(value: unknown): void {
    this.title = value == null ? null : String(value);
    (this.context as RouteContext)._setTitle(this.title);
    if (this.context.active && !this.isRedirect) {
      this.titleService.requestUpdate();
    }
  }

  /** @internal */
  private updateGuards(): void {
    const context = this.context as RouteContext;
    context._setGuards(this.canLoad, this.canUnload);
    context._setTransitionPolicy(
      this.transitionOn,
      this.transitionPlan,
      this.loadingExpression != null || this.loadedExpression != null,
    );
  }

  /** @internal */
  private updateErrorHandler(): void {
    (this.context as RouteContext)._setErrorHandler(this.onError);
  }

  /** @internal */
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

  /** @internal */
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
    (this.context as RouteContext)._setRegistered(false);
    this.requestedViewActive = false;
    return this.queueViewUpdate();
  }

  public dispose(): void {
    this.unsubscribe();
    this.unsubscribeNavigation();
    delete (this.context as RouteContext & { _auRoute?: AuRoute })._auRoute;
    this.context.dispose();
    this.titleService.requestUpdate();
  }

  /** @internal */
  private _isActive: boolean = false;
  public get isActive() {
    return this._isActive;
  }
  public set isActive(value: boolean) {
    this._isActive = value;
    this.updateRequestedViewActive();
    if (!this.$controller?.isActive) {
      return;
    }

    void this.queueViewUpdate();
  }

  /** @internal */
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

  /** @internal */
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

  /** @internal */
  private getView() {
    return this.factory!.create().setLocation(this.location);
  }

  /** @internal */
  private ensureDiscoveryView(): void | Promise<void> {
    if (!this.isGroup || this.factory == null || this.scope == null || this.discoveryActive) {
      return;
    }
    const fragment = this.platform.globalThis.document.createDocumentFragment();
    const view = this.view ??= this.factory.create().setHost(fragment);
    const activation = this.coordinator._runRoutePhase('activation', () => view.activate(view, this.$controller, this.scope!));
    if (isPromise(activation)) {
      return activation.then(() => {
        this.discoveryActive = true;
      });
    }
    this.discoveryActive = true;
  }

  /** @internal */
  private updateRequestedViewActive(): void {
    this.requestedViewActive = this._isActive && !this.isRedirect && this.hasVisibleAncestorRoute();
  }

  /** @internal */
  private hasVisibleAncestorRoute(): boolean {
    let parent = this.context.parent;
    while (parent instanceof RouteContext) {
      const route = (parent as RouteContext & { _auRoute?: AuRoute })._auRoute;
      if (route != null && !route.viewActive) {
        return false;
      }
      parent = parent.parent;
    }
    return true;
  }

  /** @internal */
  private notifyDescendantVisibilityChange(): void | Promise<void> {
    const pending: Promise<void>[] = [];
    for (const child of this.context.children) {
      const route = (child as RouteContext & { _auRoute?: AuRoute })._auRoute;
      const result = route?.handleAncestorVisibilityChange();
      if (isPromise(result)) {
        pending.push(result.catch(() => {}));
      }
    }
    return pending.length === 0 ? undefined : Promise.all(pending).then(() => {});
  }

  /** @internal */
  private handleAncestorVisibilityChange(): void | Promise<void> {
    const previous = this.requestedViewActive;
    this.updateRequestedViewActive();
    let update: void | Promise<void> = undefined;
    if (previous !== this.requestedViewActive && this.$controller?.isActive) {
      update = this.queueViewUpdate();
    }
    return onResolve(update, () => this.notifyDescendantVisibilityChange());
  }

  /** @internal */
  private preflightDescendantCanLoad(): void | Promise<void> {
    const pending: Promise<void>[] = [];
    for (const child of this.context.children) {
      const route = (child as RouteContext & { _auRoute?: AuRoute })._auRoute;
      const result = route?.preflightActivationBranch();
      if (isPromise(result)) {
        pending.push(result);
      }
    }
    return pending.length === 0 ? undefined : Promise.all(pending).then(() => {});
  }

  /** @internal */
  private preflightActivationBranch(): void | Promise<void> {
    if (!this.isActive || this.isRedirect || this.viewActive) {
      return;
    }
    const navigationId = this.coordinator.navigation.id;
    if (this.preflightedNavigationId === navigationId) {
      return;
    }
    const lifecycle = this.coordinator._createLifecycleContext(this.context as RouteContext, 'enter');
    const current = this.coordinator._runCanLoadOnly(this.context as RouteContext, this.canLoad, lifecycle);
    const afterCurrent = onResolve(current, () => {
      this.preflightedNavigationId = navigationId;
      return this.preflightDescendantCanLoad();
    });
    return isPromise(afterCurrent) ? afterCurrent : undefined;
  }

  /** @internal */
  private refreshGroupDescendants(): void {
    if (this.isGroup && this.context.active) {
      (this.context as RouteContext).refresh();
    }
  }

  /** @internal */
  private activateView(): void | Promise<void> {
    if (this.viewActive || this.scope == null) {
      return;
    }
    if (this.coordinator._isRollingBack) {
      return this.activateRestoredView();
    }

    const context = this.context as RouteContext;
    const lifecycle = this.coordinator._createLifecycleContext(context, 'enter');
    const finishSettlementOnAbort = this.coordinator._isReplacementDescendantActivation(context);
    let viewSettlement: Promise<void> | null = null;
    const activate = () => onResolve(
      this.isGroup ? this.refreshGroupDescendants() : undefined,
      () => onResolve(
        this.isGroup ? this.preflightDescendantCanLoad() : undefined,
        () => onResolve(
          this.runLoading(lifecycle),
          () => {
            if (!this.requestedViewActive || this.scope == null) {
              return;
            }

            const scope = this.scope;
            if (this.isGroup) {
              const prepared = this.ensureDiscoveryView();
              return onResolve(prepared, () => this.finishGroupActivation(lifecycle, finishSettlementOnAbort));
            }
            this.view ??= this.getView();
            const view = this.view;
            this.viewActive = true;
            this.settlement.begin();
            let settling = true;
            const finishSettlement = (): void => {
              if (!settling) {
                return;
              }
              settling = false;
              lifecycle.signal.removeEventListener('abort', finishSettlement);
              this.endViewActivation();
            };
            if (finishSettlementOnAbort) {
              if (lifecycle.signal.aborted) {
                finishSettlement();
              } else {
                lifecycle.signal.addEventListener('abort', finishSettlement, { once: true });
              }
            }
            let activation: void | Promise<void>;
            try {
              activation = this.coordinator._runRoutePhase('activation', () => view.activate(view, this.$controller, scope));
            } catch (error) {
              return this.failViewActivation(error, finishSettlement);
            }

            let ready: unknown | Promise<unknown>;
            try {
              ready = onResolve(activation, () => {
                this.coordinator._assertNavigationSignal(lifecycle.signal);
                return this.runLoaded(lifecycle);
              });
            } catch (error) {
              return this.failViewActivation(error, finishSettlement);
            }
            if (isPromise(ready)) {
              const settled = ready.then(
                () => {
                  this.coordinator._assertNavigationSignal(lifecycle.signal);
                  finishSettlement();
                  return this.coordinator._runEnterAnimation(() => this.animate('enter'));
                },
                error => this.failViewActivation(error, finishSettlement),
              );
              viewSettlement = settled.then(() => {}, () => {});
              return settled;
            }
            finishSettlement();
            return this.coordinator._runEnterAnimation(() => this.animate('enter'));
          },
        ),
      ),
    );
    const routed = this.preflightedNavigationId === this.coordinator.navigation.id
      ? this.coordinator._runRouteActivation(context, this.canLoad, lifecycle, activate, true)
      : this.coordinator._runRouteActivation(context, this.canLoad, lifecycle, activate);
    if (!isPromise(routed)) {
      return;
    }
    return routed.catch(error => {
      const pendingView = viewSettlement;
      if (pendingView == null) {
        throw error;
      }
      return pendingView.then(() => {
        throw error;
      });
    });
  }

  /** @internal */
  private finishGroupActivation(
    lifecycle: RouteLifecycleContext,
    finishSettlementOnAbort: boolean,
  ): void | Promise<void> {
    if (!this.requestedViewActive || this.scope == null) {
      return;
    }
    const view = this.view!;
    this.viewActive = true;
    this.settlement.begin();
    let settling = true;
    const finishSettlement = (): void => {
      if (!settling) {
        return;
      }
      settling = false;
      lifecycle.signal.removeEventListener('abort', finishSettlement);
      this.endViewActivation();
    };
    if (finishSettlementOnAbort) {
      if (lifecycle.signal.aborted) {
        finishSettlement();
      } else {
        lifecycle.signal.addEventListener('abort', finishSettlement, { once: true });
      }
    }
    try {
      view.nodes.insertBefore(this.location);
    } catch (error) {
      return this.failViewActivation(error, finishSettlement);
    }
    const descendantsReady = this.notifyDescendantVisibilityChange();
    let ready: void | Promise<void>;
    try {
      ready = onResolve(descendantsReady, () => this.runLoaded(lifecycle));
    } catch (error) {
      return this.failViewActivation(error, finishSettlement);
    }
    if (isPromise(ready)) {
      return ready.then(
        () => {
          this.coordinator._assertNavigationSignal(lifecycle.signal);
          finishSettlement();
          return this.coordinator._runEnterAnimation(() => this.animate('enter'));
        },
        error => this.failViewActivation(error, finishSettlement),
      );
    }
    finishSettlement();
    return this.coordinator._runEnterAnimation(() => this.animate('enter'));
  }

  /** @internal */
  private activateRestoredView(): void | Promise<void> {
    const scope = this.scope!;
    this.view ??= this.getView();
    const view = this.view;
    this.viewActive = true;
    this.settlement.begin();
    let activation: void | Promise<void>;
    try {
      activation = view.activate(view, this.$controller, scope);
    } catch (error) {
      return this.failViewActivation(error);
    }
    if (isPromise(activation)) {
      return activation.then(
        () => this.endViewActivation(),
        error => this.failViewActivation(error),
      );
    }
    this.endViewActivation();
  }

  /** @internal */
  private invokeLifecycle(
    phase: 'loading' | 'loaded',
    expression: IsBindingBehavior | null,
    lifecycle: RouteLifecycleContext,
  ): unknown | Promise<unknown> {
    if (expression == null || this.lifecycleScope == null) {
      return;
    }
    this.lifecycleOverrideContext.$lifecycle = lifecycle;
    try {
      return this.coordinator._runRoutePhase(phase, () => astEvaluate(expression, this.lifecycleScope!, null, null));
    } finally {
      this.lifecycleOverrideContext.$lifecycle = undefined;
    }
  }

  /** @internal */
  private runLoading(lifecycle: RouteLifecycleContext): void | Promise<void> {
    const expression = this.loadingAst;
    return onResolve(this.invokeLifecycle('loading', expression, lifecycle), value => {
      this.coordinator._assertNavigationSignal(lifecycle.signal);
      if (expression != null) {
        (this.context as RouteContext)._setData('loading', value);
      }
    });
  }

  /** @internal */
  private runLoaded(lifecycle: RouteLifecycleContext): void | Promise<void> {
    const expression = this.loadedAst;
    return onResolve(this.invokeLifecycle('loaded', expression, lifecycle), value => {
      this.coordinator._assertNavigationSignal(lifecycle.signal);
      if (expression != null) {
        (this.context as RouteContext)._setData('loaded', value);
      }
    });
  }

  /** @internal */
  private async runReplace(lifecycle: RouteLifecycleContext): Promise<void> {
    await this.runLoading(lifecycle);
    this.coordinator._assertNavigationSignal(lifecycle.signal);
    if (!this.viewActive || this.view == null || this.scope == null) {
      return;
    }

    const previousView = this.view;
    const scope = this.scope;
    let candidateView: ISyntheticView | null = null;
    let candidateSettling = false;
    let previousDeactivation: Promise<void> | null = null;
    let rolledBack = false;
    let committed = false;
    let rollbackPromise: Promise<void> | null = null;
    const finishCandidateSettlement = (): void => {
      if (!candidateSettling) {
        return;
      }
      candidateSettling = false;
      this.endViewActivation();
    };
    const commit = (): void => {
      if (committed || rolledBack) {
        return;
      }
      committed = true;
      previousView.dispose();
    };
    const rollback = (): void | Promise<void> => {
      if (committed || rolledBack) {
        return rollbackPromise ?? undefined;
      }
      rolledBack = true;
      rollbackPromise = (async () => {
        if (!lifecycle.signal.aborted) {
          await previousDeactivation?.catch(() => {});
        }
        finishCandidateSettlement();
        await this.restoreReplacedView(previousView, candidateView, scope, lifecycle.signal.aborted);
      })();
      return rollbackPromise;
    };
    const registered = this.coordinator._registerViewTransaction(commit, rollback);
    try {
      await this.animate('leave');
      this.coordinator._assertNavigationSignal(lifecycle.signal);
      this.viewActive = false;
      let finishPreviousDeactivation!: () => void;
      previousDeactivation = new Promise<void>(resolve => { finishPreviousDeactivation = resolve; });
      try {
        await previousView.deactivate(previousView, this.$controller);
      } finally {
        finishPreviousDeactivation();
      }
      this.coordinator._assertNavigationSignal(lifecycle.signal);

      candidateView = this.getView();
      this.view = candidateView;
      this.viewActive = true;
      this.settlement.begin();
      candidateSettling = true;
      await this.coordinator._runRoutePhase('activation', () => candidateView!.activate(candidateView!, this.$controller, scope));
      this.coordinator._assertNavigationSignal(lifecycle.signal);
      await this.runLoaded(lifecycle);
      this.coordinator._assertNavigationSignal(lifecycle.signal);
      finishCandidateSettlement();

      if (!registered) {
        commit();
      }
      this.coordinator._runEnterAnimation(() => this.animate('enter'));
    } catch (error) {
      finishCandidateSettlement();
      try {
        await this.coordinator._runViewRollback(rollback);
      } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], 'Route replacement and view rollback both failed.');
      }
      throw error;
    }
  }

  /** @internal */
  private async restoreReplacedView(
    previousView: ISyntheticView,
    candidateView: ISyntheticView | null,
    scope: Scope,
    cancelling: boolean,
  ): Promise<void> {
    if (candidateView == null && this.view === previousView && this.viewActive) {
      this.titleService.requestUpdate();
      return;
    }
    if (candidateView != null) {
      let deactivation: void | Promise<void>;
      if (this.view === candidateView && this.viewActive) {
        this.viewActive = false;
        deactivation = candidateView.deactivate(candidateView, this.$controller);
      }
      const disposeCandidate = (): void => candidateView.dispose();
      if (isPromise(deactivation!)) {
        if (cancelling) {
          void deactivation.then(disposeCandidate, disposeCandidate);
        } else {
          await deactivation;
          disposeCandidate();
        }
      } else {
        disposeCandidate();
      }
    }
    this.clearViewLocation();
    this.view = previousView;
    if (this.requestedViewActive && this.scope != null) {
      await previousView.activate(previousView, this.$controller, scope);
      this.viewActive = true;
    }
    this.titleService.requestUpdate();
  }

  /** @internal */
  private tryRetainedTransition(previous: RouteState, next: RouteState): void {
    if (this.coordinator._isRollingBack || this.scope == null || !this.viewActive || this.isRedirect) {
      return;
    }

    const changes: RouteTransitionCause[] = [];
    if (!paramsEqual(previous.params, next.params)) {
      changes.push('params');
    }
    if (previous.query.toString() !== next.query.toString()) {
      changes.push('query');
    }
    if (previous.hash !== next.hash) {
      changes.push('hash');
    }
    const reload = this.coordinator._isReloadNavigation();
    if (reload) {
      changes.push('reload');
    }
    const plan = this.coordinator._getTransitionPlan(this.transitionPlan);
    const triggered = reload || changes.some(change => change !== 'reload' && this.transitionOn.has(change));
    if (
      plan === 'none'
      || !triggered
      || plan === 'rerun' && this.canLoad == null && this.loadingAst == null && this.loadedAst == null
    ) {
      return;
    }

    const result = this.coordinator._runRetainedTransition(
      this.context as RouteContext,
      this.canLoad,
      toValueSnapshot(previous),
      changes,
      plan,
      lifecycle => plan === 'replace' ? this.runReplace(lifecycle) : this.runLoading(lifecycle),
      plan === 'rerun' ? lifecycle => this.runLoaded(lifecycle) : null,
    );
    if (isPromise(result)) {
      void result.catch(() => {});
    }
  }

  /** @internal */
  private deactivateView(): void | Promise<void> {
    if (!this.viewActive || this.view == null) {
      return;
    }

    const view = this.view;
    if (this.isGroup && this.discoveryActive) {
      return onResolve(this.animate('leave'), () => {
        this.viewActive = false;
        view.nodes.remove();
        void this.notifyDescendantVisibilityChange();
        this.titleService.requestUpdate();
      });
    }
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

  /** @internal */
  private endViewActivation(): void {
    this.settlement.end();
    this.titleService.requestUpdate();
  }

  /** @internal */
  private failViewActivation(error: unknown, finishSettlement: () => void = () => this.endViewActivation()): never | Promise<never> {
    let cleanup: void | Promise<void>;
    try {
      cleanup = this.deactivateView();
    } catch (cleanupError) {
      finishSettlement();
      throw new AggregateError([error, cleanupError], 'Route view activation and cleanup both failed.');
    }
    if (isPromise(cleanup)) {
      return cleanup.then(
        () => {
          finishSettlement();
          throw error;
        },
        cleanupError => {
          finishSettlement();
          throw new AggregateError([error, cleanupError], 'Route view activation and cleanup both failed.');
        },
      );
    }
    finishSettlement();
    throw error;
  }

  /** @internal */
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

  /** @internal */
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

  /** @internal */
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

  /** @internal */
  private getAnimationElements(): HTMLElement[] {
    const nodes = Array.from(this.view?.nodes.childNodes ?? []);
    return nodes.filter((node): node is HTMLElement => node instanceof this.platform.globalThis.HTMLElement);
  }

  /** @internal */
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

  /** @internal */
  private nextFrame(): Promise<void> {
    return new Promise(resolve => {
      this.platform.requestAnimationFrame(() => {
        this.platform.requestAnimationFrame(() => resolve());
      });
    });
  }

  /** @internal */
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

function parseTransitionOn(value: string | null): ReadonlySet<RouteTransitionTrigger> {
  const inputs = value == null || value.trim() === ''
    ? ['params']
    : value.trim().toLowerCase().split(/[\s,]+/);
  for (const input of inputs) {
    if (input !== 'params' && input !== 'query' && input !== 'hash' && input !== 'all' && input !== 'none') {
      throw new Error(`Invalid au-route transition-on value "${input}". Expected "params", "query", "hash", "all", or "none".`);
    }
  }
  if (inputs.length > 1 && (inputs.includes('all') || inputs.includes('none'))) {
    throw new Error(`Invalid au-route transition-on value "${value}". "all" and "none" must be used alone.`);
  }
  const normalized: readonly RouteTransitionTrigger[] = inputs[0] === 'all'
    ? ['params', 'query', 'hash']
    : inputs[0] === 'none' ? [] : inputs as RouteTransitionTrigger[];
  const result = new Set<RouteTransitionTrigger>();
  for (const input of normalized) {
    result.add(input);
  }
  return result;
}

function parseTransitionPlan(value: string | null): RouteTransitionPlan {
  const plan = value == null || value.trim() === ''
    ? 'rerun'
    : value.trim().toLowerCase();
  if (plan !== 'replace' && plan !== 'rerun' && plan !== 'none') {
    throw new Error(`Invalid au-route transition-plan value "${plan}". Expected "replace", "rerun", or "none".`);
  }
  return plan;
}

function paramsEqual(
  left: Readonly<Record<string, string>>,
  right: Readonly<Record<string, string>>,
): boolean {
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) {
    return false;
  }
  return keys.every(key => left[key] === right[key]);
}

function toValueSnapshot(state: RouteState): RouteValueSnapshot {
  return Object.freeze({
    path: state.path,
    residue: state.residue,
    params: state.params,
    query: state.query,
    hash: state.hash,
  });
}
