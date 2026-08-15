export class DocsState {
  public currentPath: string = '/';

  public setPath(path: string): void {
    this.currentPath = path;
  }

}
