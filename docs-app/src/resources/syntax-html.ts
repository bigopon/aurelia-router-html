import { resolve } from 'aurelia';
import { INode, type INode as INodeType } from '@aurelia/runtime-html';

export class SyntaxHtml {
  public static readonly $au = {
    type: 'custom-attribute',
    name: 'syntax-html',
  } as const;

  private readonly element = resolve(INode) as INodeType<HTMLElement>;

  public attaching(): void {
    const escaped = (this.element.textContent ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');

    this.element.innerHTML = escaped
      .replace(/(&lt;\/?)([\w-]+)/g, '$1<span class="syntax-tag">$2</span>')
      .replace(/([\w.-]+)(=)(&quot;[^&]*&quot;)/g, '<span class="syntax-attribute">$1</span>$2<span class="syntax-string">$3</span>');
  }
}
