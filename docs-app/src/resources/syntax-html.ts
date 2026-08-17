import { resolve } from 'aurelia';
import { INode, type INode as INodeType } from '@aurelia/runtime-html';
import { addCopyButton } from './copy-code';

export class SyntaxHtml {
  public static readonly $au = {
    type: 'custom-attribute',
    name: 'syntax-html',
  } as const;

  private readonly element = resolve(INode) as INodeType<HTMLElement>;

  public attaching(): void {
    const source = this.element.textContent ?? '';
    const escaped = source
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');

    this.element.innerHTML = escaped.replace(
      /&lt;(\/?)([\w-]+)([\s\S]*?)&gt;/g,
      (_match, slash: string, tag: string, attributes: string) => {
        const highlightedAttributes = attributes.replace(
          /(\s+)([\w.:-]+)(?:=(&quot;.*?&quot;))?/g,
          (_attributeMatch: string, whitespace: string, name: string, value: string | undefined) => value == null
            ? `${whitespace}<span class="syntax-attribute">${name}</span>`
            : `${whitespace}<span class="syntax-attribute">${name}</span>=<span class="syntax-string">${value}</span>`,
        );
        return `&lt;${slash}<span class="syntax-tag">${tag}</span>${highlightedAttributes}&gt;`;
      },
    );
    addCopyButton(this.element, source);
  }
}
