export interface PathAdapter {
  getCurrentPath(): string;
  formatHref(path: string): string;
  push(path: string): void;
  replace(path: string): void;
  subscribe(callback: (path: string) => void): () => void;
}
