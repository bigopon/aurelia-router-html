import { DI } from '@aurelia/kernel';

export type PathNavigationKind = 'intent' | 'traverse';

export interface PathNavigationCommitOptions {
  replace?: boolean;
}

export interface PathNavigation {
  readonly kind: PathNavigationKind;
  commit(path?: string, options?: PathNavigationCommitOptions): void | Promise<void>;
  rollback(): void | Promise<void>;
}

export interface IPathAdapter {
  getCurrentPath(): string;
  formatHref(path: string): string;
  push(path: string): void;
  replace(path: string): void;
  subscribe(callback: (path: string, navigation?: PathNavigation) => void): () => void;
}

export const IPathAdapter = DI.createInterface<IPathAdapter>('IPathAdapter');

export type PathAdapter = IPathAdapter;
