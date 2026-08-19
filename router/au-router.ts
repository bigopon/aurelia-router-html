import { isPromise, Registration, resolve } from '@aurelia/kernel';
import {
  BindingMode,
  CustomElementStaticAuDefinition,
  ICustomElementController,
  ICustomElementViewModel,
  IHydratedController,
  IRenderLocation,
  IRendering,
  ISyntheticView,
  IViewFactory,
} from '@aurelia/runtime-html';
import { IInstruction, HydrateElementInstruction } from '@aurelia/template-compiler';
import { IContainer } from '@aurelia/kernel';
import { IRouteCoordinator, RouteCoordinator, type RouteNavigationState } from './coordinator';
import { noRouteFocusService, IRouteFocusService } from './focus';
import { MemoryPathAdapter } from './memory-path-adapter';
import { IPathAdapter } from './path-adapter';
import { IRouteContext, RouteContext } from './route-context';
import { parseRouteLocation, stringifyRouteLocation } from './route-location';
import { noRouteScrollService, IRouteScrollService } from './scroll';
import { IRouteViewSettlement, RouteViewSettlement } from './settlement';
import { noRouteTitleService, IRouteTitleService } from './title';

export class AuRouter implements ICustomElementViewModel {
  public static readonly $au: CustomElementStaticAuDefinition = {
    type: 'custom-element',
    name: 'au-router',
    containerless: true,
    template: null,
    bindables: {
      currentPath: { mode: BindingMode.twoWay },
    },
  };

  public currentPath: string = '/';
  public readonly location = resolve(IRenderLocation);
  public readonly factory: IViewFactory;
  public view: ISyntheticView | null = null;

  private readonly adapter = new MemoryPathAdapter('/');
  private readonly settlement = new RouteViewSettlement();
  private readonly coordinator: RouteCoordinator;
  private readonly context: RouteContext;
  private readonly navigationSubscription: () => void;
  private scope: IHydratedController['scope'] | null | undefined = void 0;
  private started: boolean = false;
  private syncingCurrentPath: boolean = false;
  private externalNavigationSequence: number = 0;
  private requestedPath: string | null = null;

  public constructor() {
    const rendering = resolve(IRendering);
    const container = resolve(IContainer);
    const instruction = resolve(IInstruction) as HydrateElementInstruction<Record<string, never>>;
    const childContainer = container.createChild();
    const { projections } = instruction;
    const { default: routerContentDefinition } = projections ?? {};

    this.context = new RouteContext(null, '*', {
      hrefFormatter: path => this.adapter.formatHref(path),
    });
    this.coordinator = new RouteCoordinator(
      this.context,
      this.adapter,
      () => new AbortController(),
      noRouteScrollService,
      noRouteFocusService,
      this.settlement,
    );

    childContainer.register(
      Registration.instance(IPathAdapter, this.adapter),
      Registration.instance(IRouteContext, this.context),
      Registration.instance(IRouteCoordinator, this.coordinator),
      Registration.instance(IRouteViewSettlement, this.settlement),
      Registration.instance(IRouteScrollService, noRouteScrollService),
      Registration.instance(IRouteFocusService, noRouteFocusService),
      Registration.instance(IRouteTitleService, noRouteTitleService),
    );

    this.factory = rendering.getViewFactory(routerContentDefinition, childContainer);
    this.navigationSubscription = this.coordinator.subscribeNavigation(state => {
      this.handleNavigationStateChange(state);
    });
  }

  $controller!: ICustomElementController<this>;

  public binding(_initiator: IHydratedController, parent: IHydratedController): void | Promise<void> {
    this.scope = parent.scope;
    this.adapter.replace(normalizeRouterPath(this.currentPath));
    this.view = this.factory.create().setLocation(this.location);
    const activation = this.view.activate(this.view, this.$controller, this.scope);
    if (isPromise(activation)) {
      return activation.then(() => this.startCoordinator());
    }
    return this.startCoordinator();
  }

  public currentPathChanged(value: string): void {
    if (!this.started || this.syncingCurrentPath) {
      return;
    }
    const nextPath = normalizeRouterPath(value);
    if (nextPath === this.getCommittedPath() && !this.coordinator.navigation.pending) {
      if (value !== nextPath) {
        this.writeCurrentPath(nextPath);
      }
      this.requestedPath = null;
      return;
    }

    this.requestedPath = nextPath;
    const navigationId = ++this.externalNavigationSequence;
    let result: boolean | Promise<boolean>;
    try {
      result = this.coordinator.load(nextPath);
    } catch (error) {
      this.restoreCommittedPath(navigationId);
      throw error;
    }

    if (isPromise(result)) {
      void result.then(
        accepted => {
          if (!accepted) {
            this.restoreCommittedPath(navigationId);
          }
        },
        () => {
          this.restoreCommittedPath(navigationId);
        },
      );
      return;
    }

    if (!result) {
      this.restoreCommittedPath(navigationId);
    }
  }

  public unbinding(): void | Promise<void> {
    this.started = false;
    this.externalNavigationSequence++;
    this.coordinator.stop();
    const view = this.view;
    this.view = null;
    this.scope = void 0;
    if (view == null) {
      return;
    }
    const deactivation = view.deactivate(view, this.$controller);
    if (isPromise(deactivation)) {
      return deactivation.then(() => {
        view.dispose();
      });
    }
    view.dispose();
  }

  public dispose(): void {
    this.navigationSubscription();
  }

  private startCoordinator(): void | Promise<void> {
    const started = this.coordinator.start();
    if (isPromise(started)) {
      return started.then(() => {
        this.started = true;
        this.writeCurrentPath(this.getCommittedPath());
      });
    }
    this.started = true;
    this.writeCurrentPath(this.getCommittedPath());
  }

  private restoreCommittedPath(navigationId: number): void {
    if (!this.started || navigationId !== this.externalNavigationSequence) {
      return;
    }
    this.requestedPath = null;
    this.writeCurrentPath(this.getCommittedPath());
  }

  private handleNavigationStateChange(state: RouteNavigationState): void {
    if (!this.started || state.pending) {
      return;
    }
    const committedPath = this.getCommittedPath();
    if (this.requestedPath != null) {
      if (committedPath === this.requestedPath) {
        this.requestedPath = null;
        this.writeCurrentPath(committedPath);
      }
      return;
    }
    this.writeCurrentPath(committedPath);
  }

  private getCommittedPath(): string {
    return stringifyRouteLocation(this.coordinator.currentLocation);
  }

  private writeCurrentPath(path: string): void {
    const normalized = normalizeRouterPath(path);
    if (this.currentPath === normalized) {
      return;
    }
    this.syncingCurrentPath = true;
    this.currentPath = normalized;
    this.syncingCurrentPath = false;
  }
}

function normalizeRouterPath(path: string | null | undefined): string {
  return stringifyRouteLocation(parseRouteLocation(path == null || path === '' ? '/' : path));
}
