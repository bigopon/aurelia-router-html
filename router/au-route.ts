import { resolve, IContainer, Registration } from '@aurelia/kernel';
import { astEvaluate, Scope } from '@aurelia/runtime';
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
import { IRouteContext, type SwapOrder } from './route-context';

export class AuRoute implements ICustomElementViewModel {
  public static readonly $au: CustomElementStaticAuDefinition = {
    type: 'custom-element',
    name: 'au-route',
    containerless: true,
    template: null,
    bindables: ['path'],
    processContent: (node, _, data) => {
      const path = node.getAttribute('path');
      const pathExpression = node.getAttribute('path.bind') ?? node.getAttribute('path.to-view');
      const hasBoundPath = pathExpression != null;
      data.path = path ?? (hasBoundPath ? '/__pending_route_path__' : '/');
      data.pathExpression = pathExpression;
      data.swapOrder = node.getAttribute('swap-order') as SwapOrder | null;
      data.animate = node.hasAttribute('animate');
      data.exact = node.hasAttribute('exact');
      data.fallback = node.hasAttribute('fallback');
    },
  };

  public path: string = '/';
  public view: ISyntheticView | null = null;
  public context: IRouteContext;
  public readonly location = resolve(IRenderLocation);
  public readonly factory: IViewFactory;
  public readonly overrideContext: Record<string, unknown> = {};
  private readonly animationOptions = resolve(IRouteAnimationOptions);
  private readonly animationsEnabled: boolean;
  private readonly expressionParser = resolve(IExpressionParser);
  private readonly pathExpression: string | null;
  private readonly unsubscribe: () => void;
  private viewActive: boolean = false;
  private animationRunId: number = 0;

  public constructor() {
    const parentContext = resolve(IRouteContext);
    const rendering = resolve(IRendering);
    const container = resolve(IContainer);
    const instruction = resolve(IInstruction) as HydrateElementInstruction<{ animate: boolean; exact: boolean; fallback: boolean; path: string; pathExpression: string | null; swapOrder: SwapOrder | null }>;
    const { projections, data: { animate, exact, fallback, path, pathExpression, swapOrder } } = instruction;
    const { default: routeComponentDefinition } = projections ?? {};
    const childContainer = container.createChild();
    this.factory = rendering.getViewFactory(routeComponentDefinition, childContainer);

    this.context = parentContext.createChild(path, {
      exact,
      fallback,
      swapOrder: swapOrder ?? undefined,
    });
    this.path = path;
    this.pathExpression = pathExpression;
    this.animationsEnabled = this.animationOptions.enabled || animate;
    this.overrideContext.$pattern = path;
    this.overrideContext.$params = this.context.$params;
    this.overrideContext.$route = this.context;
    this.isActive = this.context.active;
    this.unsubscribe = this.context.subscribe(state => {
      this.isActive = state.active;
      this.overrideContext.$params = state.params;
    });
    childContainer.register(Registration.instance(IRouteContext, this.context));
  }

  $controller!: ICustomElementController<this>;

  private scope?: Scope | null = null;
  public $params?: Record<string, unknown>;

  public binding(_initiator: IHydratedController, parent: IHydratedController): void | Promise<void> {
    this.scope ??= Scope.fromParent(parent.scope, parent.scope.bindingContext);
    Object.setPrototypeOf(this.overrideContext, parent.scope.overrideContext);
    this.scope.overrideContext = this.overrideContext;
    if (this.pathExpression != null) {
      const expression = this.expressionParser.parse(this.pathExpression, 'None');
      this.path = String(astEvaluate(expression, this.scope, null, null));
    }
    this.updatePath(this.path);

    if (this.isActive) {
      return this.activateView();
    }
  }

  public pathChanged(path: string): void {
    this.updatePath(path);
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
    return this.deactivateView();
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
    if (!this.$controller?.isActive) {
      return;
    }

    if (value) {
      void this.activateView();
    } else {
      void this.deactivateView();
    }
  }

  private getView() {
    return this.factory.create().setLocation(this.location);
  }

  private async activateView(): Promise<void> {
    if (this.viewActive || this.scope == null) {
      return;
    }

    this.view ??= this.getView();
    this.viewActive = true;
    await this.view.activate(this.view, this.$controller, this.scope);
    await this.animate('enter');
  }

  private async deactivateView(): Promise<void> {
    if (!this.viewActive || this.view == null) {
      return;
    }

    await this.animate('leave');
    this.viewActive = false;
    await this.view.deactivate(this.view, this.$controller);
  }

  private async animate(direction: 'enter' | 'leave'): Promise<void> {
    if (!this.animationsEnabled || this.view == null) {
      return;
    }

    const elements = this.getAnimationElements();
    if (elements.length === 0) {
      return;
    }

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

    await nextFrame();
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
      ...elements.map(getElementAnimationDuration),
    );

    if (duration > 0) {
      await wait(duration + 34);
    }

    if (runId !== this.animationRunId) {
      this.clearAnimationClasses(elements);
      return;
    }

    this.clearAnimationClasses(elements);
  }

  private getAnimationElements(): HTMLElement[] {
    const nodes = Array.from(this.view?.nodes.childNodes ?? []);
    return nodes.filter((node): node is HTMLElement => node instanceof HTMLElement);
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

function getElementAnimationDuration(element: HTMLElement): number {
  const style = window.getComputedStyle(element);
  const transitionDurations = parseTimeList(style.transitionDuration);
  const transitionDelays = parseTimeList(style.transitionDelay);
  const animationDurations = parseTimeList(style.animationDuration);
  const animationDelays = parseTimeList(style.animationDelay);

  const transitionTotal = transitionDurations.reduce((max, duration, index) => Math.max(max, duration + (transitionDelays[index] ?? transitionDelays[0] ?? 0)), 0);
  const animationTotal = animationDurations.reduce((max, duration, index) => Math.max(max, duration + (animationDelays[index] ?? animationDelays[0] ?? 0)), 0);

  return Math.max(transitionTotal, animationTotal, 0);
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
