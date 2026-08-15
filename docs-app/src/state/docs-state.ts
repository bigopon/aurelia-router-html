import { docNav, type DocNavItem } from '../data/docs-nav';

export interface LabItem {
  id: string;
  name: string;
  qty: number;
}

export class DocsState {
  public nav = docNav;
  public basicStep: string = 'welcome';
  public nestedArea: string = 'dashboard';
  public selectedUserId: string = 'mira';
  public conditionalEnabled: boolean = false;
  public sourceVisible: boolean = false;
  public repeatedRoutes: Array<{ id: string; label: string }> = [];
  private repeatedRouteCount: number = 0;
  public swapStage: string = 'alpha';
  public animationStage: string = 'spring';
  public labItems: LabItem[] = [
    { id: 'kit', name: 'Starter kit', qty: 1 },
    { id: 'notes', name: 'Field notes', qty: 2 },
  ];

  public get totalQty(): number {
    return this.labItems.reduce((sum, item) => sum + item.qty, 0);
  }

  public get activeFeature(): DocNavItem | null {
    return this.nav.find(item => item.path === this.currentPath) ?? null;
  }

  public currentPath: string = '/';

  public setPath(path: string): void {
    this.currentPath = path;
  }

  public isRouteActive(path: string): boolean {
    return this.currentPath === path;
  }

  public toggleSource(): void {
    this.sourceVisible = !this.sourceVisible;
  }

  public addRepeatedRoute(): string {
    const id = `generated-${++this.repeatedRouteCount}`;
    this.repeatedRoutes = [
      ...this.repeatedRoutes,
      { id, label: `Generated route ${this.repeatedRouteCount}` },
    ];
    return id;
  }

  public clearRepeatedRoutes(): void {
    this.repeatedRoutes = [];
    this.repeatedRouteCount = 0;
  }

  public setQty(id: string, qty: number): void {
    const normalizedQty = Math.max(1, Math.floor(qty) || 1);
    this.labItems = this.labItems.map(item => item.id === id
      ? { ...item, qty: normalizedQty }
      : item);
  }
}
