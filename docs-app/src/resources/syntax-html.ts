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

    this.element.innerHTML = highlightHtml(escaped);
    addCopyButton(this.element, source);
  }
}

function highlightHtml(source: string): string {
  let result = '';
  let index = 0;

  while (index < source.length) {
    const tagStart = source.indexOf('&lt;', index);
    if (tagStart === -1) {
      result += source.slice(index);
      break;
    }

    result += source.slice(index, tagStart);

    const commentEnd = source.startsWith('&lt;!--', tagStart)
      ? source.indexOf('--&gt;', tagStart + 6)
      : -1;
    if (commentEnd !== -1) {
      result += source.slice(tagStart, commentEnd + 6);
      index = commentEnd + 6;
      continue;
    }

    const tagEnd = findTagEnd(source, tagStart + 4);
    if (tagEnd === -1) {
      result += source.slice(tagStart);
      break;
    }

    result += highlightTag(source.slice(tagStart, tagEnd + 4));
    index = tagEnd + 4;
  }

  return result;
}

function findTagEnd(source: string, from: number): number {
  let inQuote = false;

  for (let index = from; index < source.length; index++) {
    if (source.startsWith('&quot;', index)) {
      inQuote = !inQuote;
      index += 5;
      continue;
    }

    if (!inQuote && source.startsWith('&gt;', index)) {
      return index;
    }
  }

  return -1;
}

function highlightTag(tagSource: string): string {
  const match = /^&lt;(\/?)([\w-]+)([\s\S]*?)&gt;$/.exec(tagSource);
  if (match == null) {
    return tagSource;
  }

  const [, slash, tag, attributes] = match;
  const highlightedAttributes = attributes.replace(
    /(\s+)([\w.:-]+)(?:=(&quot;[\s\S]*?&quot;))?/g,
    (_attributeMatch: string, whitespace: string, name: string, value: string | undefined) => value == null
      ? `${whitespace}<span class="syntax-attribute">${name}</span>`
      : `${whitespace}<span class="syntax-attribute">${name}</span>=<span class="syntax-string">${value}</span>`,
  );

  return `&lt;${slash}<span class="syntax-tag">${tag}</span>${highlightedAttributes}&gt;`;
}
