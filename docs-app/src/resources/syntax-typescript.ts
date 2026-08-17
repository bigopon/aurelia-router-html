import { resolve } from 'aurelia';
import { INode, type INode as INodeType } from '@aurelia/runtime-html';
import { addCopyButton } from './copy-code';

const tokenPattern = /(\/\/[^\r\n]*|\/\*[\s\S]*?\*\/|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`|\b(?:as|async|await|class|const|export|extends|false|from|function|if|import|interface|let|new|null|private|protected|public|readonly|return|static|true|type|undefined|void)\b|\b\d+(?:\.\d+)?\b)/g;

export class SyntaxTypeScript {
  public static readonly $au = {
    type: 'custom-attribute',
    name: 'syntax-typescript',
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

    this.element.innerHTML = result + escapeHtml(source.slice(lastIndex));
    addCopyButton(this.element, source);
  }
}

function tokenClass(token: string): string {
  if (token.startsWith('//') || token.startsWith('/*')) {
    return 'syntax-comment';
  }
  if (token.startsWith('\'') || token.startsWith('"') || token.startsWith('`')) {
    return 'syntax-string';
  }
  if (/^\d/.test(token)) {
    return 'syntax-number';
  }
  return 'syntax-keyword';
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
