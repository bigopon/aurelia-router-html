import { resolve } from '@aurelia/kernel';
import {
  INode,
  type CustomAttributeStaticAuDefinition,
  type ICustomAttributeViewModel,
  type INode as INodeType,
} from '@aurelia/runtime-html';
import { IRouteContext, RouteContext, type RouteActiveOptions, type RouteLoadOptions, type RouteParams } from './route-context';

export interface RouteLinkOptions extends RouteActiveOptions, RouteLoadOptions {}

export interface LinkInstruction {
  readonly target: string | IRouteContext;
  readonly params?: RouteParams;
  readonly options?: RouteLinkOptions;
  readonly activeClass?: string;
}

export class AuLink implements ICustomAttributeViewModel {
  public static readonly $au: CustomAttributeStaticAuDefinition = {
    type: 'custom-attribute',
    name: 'au-link',
    noMultiBindings: true,
    bindables: ['value'],
  };

  public value: string | IRouteContext | LinkInstruction | null | undefined;

  private readonly element = resolve(INode) as INodeType<HTMLElement>;
  private readonly route = resolve(IRouteContext);
  private unsubscribeState: (() => void) | null = null;
  private unsubscribeRegistry: (() => void) | null = null;
  private isAttached: boolean = false;
  private appliedActiveClass: string | null = null;

  public attaching(): void {
    this.isAttached = true;
    this.element.addEventListener('click', this.onClick);
    this.unsubscribeState = this.route.subscribe(() => this.update());
    this.unsubscribeRegistry = this.route.root instanceof RouteContext
      ? this.route.root._subscribeRegistry(() => this.update())
      : null;
  }

  public detaching(): void {
    this.isAttached = false;
    this.element.removeEventListener('click', this.onClick);
    this.unsubscribeState?.();
    this.unsubscribeState = null;
    this.unsubscribeRegistry?.();
    this.unsubscribeRegistry = null;
  }

  public valueChanged(): void {
    if (this.isAttached) {
      this.update();
    }
  }

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
    this.route.load(instruction.target, instruction.params, instruction.options);
  };

  private update(): void {
    const instruction = this.getInstruction();
    if (instruction == null) {
      this.clear();
      return;
    }

    const { target, params = {}, options = {}, activeClass = 'is-active' } = instruction;
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
    if (this.route.isActive(target, params, { ...options, exact: true })) {
      this.element.setAttribute('aria-current', 'page');
    } else {
      this.element.removeAttribute('aria-current');
    }
  }

  private clear(): void {
    this.element.removeAttribute('href');
    this.updateActiveClass(null, false);
    this.element.removeAttribute('aria-current');
  }

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

  private updateActiveClass(activeClass: string | null, active: boolean): void {
    if (this.appliedActiveClass != null && this.appliedActiveClass !== activeClass) {
      this.element.classList.remove(this.appliedActiveClass);
    }
    this.appliedActiveClass = activeClass;
    if (activeClass != null && activeClass !== '') {
      this.element.classList.toggle(activeClass, active);
    }
  }
}
