import { resolve } from 'aurelia';
import { INode, type INode as INodeType } from '@aurelia/runtime-html';
import { addCopyButton } from './copy-code';

const tokenPattern = /(\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#[\da-fA-F]{3,8}\b|@[\w-]+|\b(?:from|to|important)\b|\b\d+(?:\.\d+)?(?:ms|s|px|rem|em|vh|vw|%)?\b)/g;
const propertyPattern = /(^|[;{\s])([a-z-]+)(\s*:)/gim;

export class SyntaxCss {
  public static readonly $au = {
    type: 'custom-attribute',
    name: 'syntax-css',
  } as const;

  private readonly element = resolve(INode) as INodeType<HTMLElement>;

  public attaching(): void {
    const source = this.element.textContent ?? '';
    let result = '';
    let lastIndex = 0;

    for (const match of source.matchAll(tokenPattern)) {
      const token = match[0];
      const index = match.index;
      result += escapeHtml(source.slice(lastIndex, index));
      result += `<span class="${tokenClass(token)}">${escapeHtml(token)}</span>`;
      lastIndex = index + token.length;
    }

    const highlighted = result + escapeHtml(source.slice(lastIndex));
    this.element.innerHTML = highlighted.replace(
      propertyPattern,
      (_match: string, prefix: string, property: string, suffix: string) =>
        `${prefix}<span class="syntax-attribute">${property}</span>${suffix}`,
    );
    addCopyButton(this.element, source);
  }
}

function tokenClass(token: string): string {
  if (token.startsWith('/*')) {
    return 'syntax-comment';
  }
  if (token.startsWith('"') || token.startsWith('\'')) {
    return 'syntax-string';
  }
  if (token.startsWith('#')) {
    return 'syntax-number';
  }
  if (token.startsWith('@') || token === 'from' || token === 'to' || token === 'important') {
    return 'syntax-keyword';
  }
  return 'syntax-number';
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
