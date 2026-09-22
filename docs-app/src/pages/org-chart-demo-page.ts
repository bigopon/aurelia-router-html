import { rootId } from './org-chart-demo-data';
import { OrgChartDemoNode } from './org-chart-demo-node';
import template from './org-chart-demo-page.html?raw';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class OrgChartDemoPage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'org-chart-demo-page',
    template,
    bindables: ['lineage'],
    dependencies: [OrgChartDemoNode],
  } as const;

  public lineage: string | null | undefined = '';
  public readonly rootId = rootId;
  public selectedLineage = rootId;
  public currentPath = `/${rootId}`;
  public scale = 0.7;
  public panX = 0;
  public panY = 0;
  public dragging = false;
  public openInfoId: string | null = null;
  public viewport!: HTMLElement;
  public surface!: HTMLElement;
  private hasCenteredInitialSelection = false;
  private readonly expanded = new Set<string>([rootId, 'head-product', 'head-people']);
  private dragPointerId: number | null = null;
  private dragOriginX = 0;
  private dragOriginY = 0;
  private dragStartX = 0;
  private dragStartY = 0;
  private readonly onPopState = () => {
    this.syncFromLocation();
  };

  public binding(): void {
    this.syncFromLineage();
  }

  public attached(): void {
    window.addEventListener('popstate', this.onPopState);
    this.ensureCanonicalLocation();
    this.resetView();
    this.centerSelectedNode(true);
  }

  public detaching(): void {
    window.removeEventListener('popstate', this.onPopState);
  }

  public lineageChanged(): void {
    this.syncFromLineage();
  }

  public get canvasTransform(): string {
    return `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
  }

  public get activePathLabel(): string {
    return `/demo/orgchart/${this.selectedLineage}`;
  }

  public isSelected(lineage: string): boolean {
    return this.selectedLineage === lineage;
  }

  public isActiveBranch(lineage: string): boolean {
    return this.selectedLineage === lineage || this.selectedLineage.startsWith(`${lineage}/`);
  }

  public shouldShowChildren(_lineage: string, id: string): boolean {
    return this.expanded.has(id);
  }

  public isInfoOpen(id: string): boolean {
    return this.openInfoId === id;
  }

  public readonly toggleExpanded = (id: string, lineage: string, event?: Event): void => {
    event?.stopPropagation();
    if (this.expanded.has(id)) {
      this.expanded.delete(id);
      if (this.selectedLineage === lineage || this.selectedLineage.startsWith(`${lineage}/`)) {
        this.selectedLineage = lineage;
        this.currentPath = `/${lineage}`;
        this.updateLocation(lineage, true);
      }
      this.openInfoId = null;
    } else {
      this.expanded.add(id);
    }
  };

  public readonly toggleInfo = (id: string, event?: Event): void => {
    event?.stopPropagation();
    this.openInfoId = this.openInfoId === id ? null : id;
  };

  public readonly selectLineage = async (lineage: string, event?: Event): Promise<void> => {
    event?.preventDefault();
    event?.stopPropagation();
    this.selectedLineage = lineage;
    this.currentPath = `/${lineage}`;
    this.expandLineage(lineage);
    this.updateLocation(lineage);
  };

  public readonly zoomIn = (): void => {
    this.scale = clamp(this.scale * 1.12, 0.35, 1.8);
  };

  public readonly zoomOut = (): void => {
    this.scale = clamp(this.scale / 1.12, 0.35, 1.8);
  };

  public readonly resetView = (): void => {
    this.scale = 0.7;
    this.panX = 0;
    this.panY = 0;
  };

  public readonly onViewportPointerDown = (event: PointerEvent): void => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('.node-card, .node-action, .tooltip-button, .tooltip-panel')) {
      return;
    }
    this.dragging = true;
    this.dragPointerId = event.pointerId;
    this.dragOriginX = this.panX;
    this.dragOriginY = this.panY;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    (event.currentTarget as HTMLElement | null)?.setPointerCapture(event.pointerId);
  };

  public readonly onViewportPointerMove = (event: PointerEvent): void => {
    if (!this.dragging || this.dragPointerId !== event.pointerId) {
      return;
    }
    this.panX = this.dragOriginX + (event.clientX - this.dragStartX);
    this.panY = this.dragOriginY + (event.clientY - this.dragStartY);
  };

  public readonly onViewportPointerUp = (event?: PointerEvent): void => {
    if (event != null && this.dragPointerId != null) {
      (event.currentTarget as HTMLElement | null)?.releasePointerCapture(this.dragPointerId);
    }
    this.dragging = false;
    this.dragPointerId = null;
  };

  public readonly onViewportWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const viewport = event.currentTarget as HTMLElement | null;
    if (viewport == null) {
      return;
    }
    const rect = viewport.getBoundingClientRect();
    const pivotX = event.clientX - rect.left;
    const pivotY = event.clientY - rect.top;
    const nextScale = clamp(this.scale * (event.deltaY < 0 ? 1.08 : 0.92), 0.35, 1.8);
    const ratio = nextScale / this.scale;
    this.panX = pivotX - (pivotX - this.panX) * ratio;
    this.panY = pivotY - (pivotY - this.panY) * ratio;
    this.scale = nextScale;
  };

  private syncFromLineage(): void {
    const lineage = this.lineage == null || this.lineage === '' ? rootId : this.lineage;
    this.selectedLineage = lineage;
    this.currentPath = `/${lineage}`;
    this.expandLineage(this.selectedLineage);
  }

  private syncFromLocation(): void {
    const lineage = this.readLineageFromLocation();
    this.selectedLineage = lineage === '' ? rootId : lineage;
    this.currentPath = `/${this.selectedLineage}`;
    this.expandLineage(this.selectedLineage);
  }

  private expandLineage(lineage: string): void {
    for (const segment of lineage.split('/')) {
      if (segment !== '') {
        this.expanded.add(segment);
      }
    }
  }

  private ensureCanonicalLocation(): void {
    const lineage = this.readLineageFromLocation();
    if (lineage === '') {
      this.updateLocation(rootId, true);
      this.selectedLineage = rootId;
      this.currentPath = `/${rootId}`;
      this.expandLineage(rootId);
    }
  }

  private readLineageFromLocation(): string {
    const path = window.location.pathname.replace(/\/+$/, '');
    const prefix = '/demo/orgchart';
    if (!path.startsWith(prefix)) {
      return '';
    }
    return path.slice(prefix.length).replace(/^\/+/, '');
  }

  private updateLocation(lineage: string, replace: boolean = false): void {
    const target = `/demo/orgchart/${lineage}`;
    if (window.location.pathname === target) {
      return;
    }
    if (replace) {
      window.history.replaceState(window.history.state, '', target);
    } else {
      window.history.pushState(window.history.state, '', target);
    }
  }

  private centerSelectedNode(force: boolean = false): void {
    if (!force && this.hasCenteredInitialSelection) {
      return;
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const viewport = this.viewport;
        const surface = this.surface;
        const selected = surface?.querySelector<HTMLElement>('.node-shell.is-selected > .node-card');
        const tree = surface?.querySelector<HTMLElement>('.org-tree');
        if (viewport == null || surface == null || selected == null || tree == null) {
          return;
        }
        const viewportRect = viewport.getBoundingClientRect();
        const surfaceRect = surface.getBoundingClientRect();
        const treeRect = tree.getBoundingClientRect();
        const fitScale = Math.min(
          0.9,
          Math.max(
            0.45,
            Math.min(
              (viewportRect.width - 160) / treeRect.width,
              (viewportRect.height - 180) / treeRect.height,
            ),
          ),
        );
        this.scale = fitScale;
        const scaledSurfaceRect = surface.getBoundingClientRect();
        const selectedRect = selected.getBoundingClientRect();
        const currentScale = this.scale;
        const surfaceOffsetX = scaledSurfaceRect.left - surfaceRect.left;
        const surfaceOffsetY = scaledSurfaceRect.top - surfaceRect.top;
        const selectedX = (selectedRect.left - viewportRect.left - this.panX - surfaceOffsetX) / currentScale;
        const selectedY = (selectedRect.top - viewportRect.top - this.panY - surfaceOffsetY) / currentScale;
        const selectedWidth = selectedRect.width / currentScale;
        const selectedHeight = selectedRect.height / currentScale;
        const targetCenterY = Math.max(120, viewportRect.height * 0.24);
        this.panX = viewportRect.width * 0.5 - (selectedX + selectedWidth / 2) * currentScale;
        this.panY = targetCenterY - (selectedY + selectedHeight / 2) * currentScale;
        this.hasCenteredInitialSelection = true;
      });
    });
  }
}
