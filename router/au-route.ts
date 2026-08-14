import { resolve, IContainer, Registration } from '@aurelia/kernel';
import { Scope } from '@aurelia/runtime';
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
import { IRouteContext } from './route-context';

export class AuRoute implements ICustomElementViewModel {
  public static readonly $au: CustomElementStaticAuDefinition = {
    type: 'custom-element',
    name: 'au-route',
    containerless: true,
    template: null,
    processContent: (node, _, data) => {
      data.path = node.getAttribute('path') ?? '/';
    },
  };

  public path: string = '/';
  public view: ISyntheticView | null = null;
  public context: IRouteContext;
  public readonly location = resolve(IRenderLocation);
  public readonly factory: IViewFactory;
  public readonly overrideContext: Record<string, unknown> = {};
  private readonly unsubscribe: () => void;
  private viewActive: boolean = false;

  public constructor() {
    const parentContext = resolve(IRouteContext);
    const rendering = resolve(IRendering);
    const container = resolve(IContainer);
    const instruction = resolve(IInstruction) as HydrateElementInstruction<{ path: string }>;
    const { projections, data: { path } } = instruction;
    const { default: routeComponentDefinition } = projections ?? {};
    const childContainer = container.createChild();
    this.factory = rendering.getViewFactory(routeComponentDefinition, childContainer);

    this.context = parentContext.createChild(path);
    this.path = path;
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

    if (this.isActive) {
      return this.activateView();
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

  private activateView(): void | Promise<void> {
    if (this.viewActive || this.scope == null) {
      return;
    }

    this.view ??= this.getView();
    this.viewActive = true;
    return this.view.activate(this.view, this.$controller, this.scope);
  }

  private deactivateView(): void | Promise<void> {
    if (!this.viewActive || this.view == null) {
      return;
    }

    this.viewActive = false;
    return this.view.deactivate(this.view, this.$controller);
  }
}
