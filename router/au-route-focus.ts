import { resolve } from '@aurelia/kernel';
import {
  INode,
  type CustomAttributeStaticAuDefinition,
  type ICustomAttributeViewModel,
  type INode as INodeType,
} from '@aurelia/runtime-html';
import { IRouteFocusService } from './focus';

export class AuRouteFocus implements ICustomAttributeViewModel {
  public static readonly $au: CustomAttributeStaticAuDefinition = {
    type: 'custom-attribute',
    name: 'au-route-focus',
  };

  /** @internal */
  private readonly element = resolve(INode) as INodeType<HTMLElement>;
  /** @internal */
  private readonly focusService = resolve(IRouteFocusService);
  /** @internal */
  private unregister: (() => void) | null = null;

  public attaching(): void {
    this.unregister = this.focusService.register(this.element);
  }

  public detaching(): void {
    this.unregister?.();
    this.unregister = null;
  }
}
