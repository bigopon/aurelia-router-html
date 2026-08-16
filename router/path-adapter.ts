import { DI } from '@aurelia/kernel';

export interface IPathAdapter {
  getCurrentPath(): string;
  formatHref(path: string): string;
  push(path: string): void;
  replace(path: string): void;
  subscribe(callback: (path: string) => void): () => void;
}

export const IPathAdapter = DI.createInterface<IPathAdapter>('IPathAdapter');

export type PathAdapter = IPathAdapter;
