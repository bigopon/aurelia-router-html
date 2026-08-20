import { resolve } from '@aurelia/kernel';
import {
  INode,
  type CustomAttributeStaticAuDefinition,
  type ICustomAttributeViewModel,
  type INode as INodeType,
} from '@aurelia/runtime-html';
import { IRouteCoordinator, type RouteNavigationState } from './coordinator';
import { IRouteContext, RouteContext, type RouteActiveOptions, type RouteLoadOptions, type RouteParams } from './route-context';

export interface RouteLinkOptions extends RouteActiveOptions, RouteLoadOptions {}

export interface LinkInstruction {
  readonly target: string | IRouteContext;
  readonly params?: RouteParams;
  readonly options?: RouteLinkOptions;
  readonly activeClass?: string;
  readonly pendingClass?: string;
}

export const routeNavigationErrorEvent = 'au-route-navigation-error';

export class AuLink implements ICustomAttributeViewModel {
  public static readonly $au: CustomAttributeStaticAuDefinition = {
    type: 'custom-attribute',
    name: 'au-link',
    noMultiBindings: true,
    bindables: ['value'],
  };

  public value: string | IRouteContext | LinkInstruction | null | undefined;

  /** @internal */
  private readonly element = resolve(INode) as INodeType<HTMLElement>;
  /** @internal */
  private readonly route = resolve(IRouteContext);
  /** @internal */
  private readonly coordinator = resolve(IRouteCoordinator);
  /** @internal */
  private unsubscribeState: (() => void) | null = null;
  /** @internal */
  private unsubscribeRegistry: (() => void) | null = null;
  /** @internal */
  private unsubscribeNavigation: (() => void) | null = null;
  /** @internal */
  private isAttached: boolean = false;
  /** @internal */
  private appliedActiveClass: string | null = null;
  /** @internal */
  private appliedPendingClass: string | null = null;
  /** @internal */
  private navigation: RouteNavigationState = this.coordinator.navigation;

  public attaching(): void {
    this.isAttached = true;
    this.element.addEventListener('click', this.onClick);
    this.unsubscribeState = this.route.subscribe(() => this.update());
    this.unsubscribeRegistry = this.route.root instanceof RouteContext
      ? this.route.root._subscribeRegistry(() => this.update())
      : null;
    this.unsubscribeNavigation = this.coordinator.subscribeNavigation(state => {
      this.navigation = state;
      this.update();
    });
    this.update();
  }

  public detaching(): void {
    this.isAttached = false;
    this.element.removeEventListener('click', this.onClick);
    this.unsubscribeState?.();
    this.unsubscribeState = null;
    this.unsubscribeRegistry?.();
    this.unsubscribeRegistry = null;
    this.unsubscribeNavigation?.();
    this.unsubscribeNavigation = null;
  }

  public valueChanged(): void {
    if (this.isAttached) {
      this.update();
    }
  }

  /** @internal */
  private readonly onClick = (event: MouseEvent): void => {
    if (event.defaultPrevented || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    if (this.element.tagName !== 'A' || !this.element.hasAttribute('href') || this.element.hasAttribute('download') || this.element.hasAttribute('external') || this.element.hasAttribute('data-external')) {
      return;
    }
    const target = this.element.getAttribute('target');
    if (target != null && target !== '' && target !== '_self') {
      return;
    }
    const instruction = this.getInstruction();
    if (instruction == null) {
      return;
    }
    event.preventDefault();
    try {
      const navigation = this.route.load(instruction.target, instruction.params, instruction.options);
      if (navigation instanceof Promise) {
        void navigation.catch(error => this.reportNavigationError(error));
      }
    } catch (error) {
      this.reportNavigationError(error);
    }
  };

  /** @internal */
  private reportNavigationError(error: unknown): void {
    const Event = this.element.ownerDocument.defaultView?.CustomEvent ?? CustomEvent;
    this.element.dispatchEvent(new Event(routeNavigationErrorEvent, {
      bubbles: true,
      composed: true,
      detail: { error },
    }));
  }

  /** @internal */
  private update(): void {
    const instruction = this.getInstruction();
    if (instruction == null) {
      this.clear();
      return;
    }

    const { target, params = {}, options = {}, activeClass = 'is-active', pendingClass = 'is-pending' } = instruction;
    let href: string;
    try {
      href = this.route.href(target, params, options);
    } catch (error) {
      if (typeof target === 'string' && !this.route.isActive(target, params, options)) {
        this.clear();
        return;
      }
      throw error;
    }

    this.element.setAttribute('href', href);
    this.updateActiveClass(activeClass, this.route.isActive(target, params, options));
    const pending = this.navigation.pending && this.navigation.href === href;
    this.updatePendingClass(pendingClass, pending);
    if (pending) {
      this.element.setAttribute('aria-busy', 'true');
    } else {
      this.element.removeAttribute('aria-busy');
    }
    if (this.route.isActive(target, params, { ...options, exact: true })) {
      this.element.setAttribute('aria-current', 'page');
    } else {
      this.element.removeAttribute('aria-current');
    }
  }

  /** @internal */
  private clear(): void {
    this.element.removeAttribute('href');
    this.updateActiveClass(null, false);
    this.updatePendingClass(null, false);
    this.element.removeAttribute('aria-current');
    this.element.removeAttribute('aria-busy');
  }

  /** @internal */
  private getInstruction(): LinkInstruction | null {
    const value = this.value;
    if (value == null || value === '') {
      return null;
    }
    if (typeof value === 'object' && 'target' in value) {
      return value as LinkInstruction;
    }
    return { target: value as string | IRouteContext };
  }

  /** @internal */
  private updateActiveClass(activeClass: string | null, active: boolean): void {
    if (this.appliedActiveClass != null && this.appliedActiveClass !== activeClass) {
      this.element.classList.remove(this.appliedActiveClass);
    }
    this.appliedActiveClass = activeClass;
    if (activeClass != null && activeClass !== '') {
      this.element.classList.toggle(activeClass, active);
    }
  }

  /** @internal */
  private updatePendingClass(pendingClass: string | null, pending: boolean): void {
    if (this.appliedPendingClass != null && this.appliedPendingClass !== pendingClass) {
      this.element.classList.remove(this.appliedPendingClass);
    }
    this.appliedPendingClass = pendingClass;
    if (pendingClass != null && pendingClass !== '') {
      this.element.classList.toggle(pendingClass, pending);
    }
  }
}
