import { getPerson, type Person } from './org-chart-demo-data';
import template from './org-chart-demo-node.html?raw';

interface OrgChartLike {
  isSelected(lineage: string): boolean;
  isActiveBranch(lineage: string): boolean;
  shouldShowChildren(lineage: string, id: string): boolean;
  isInfoOpen(id: string): boolean;
  toggleExpanded(id: string, lineage: string, event?: Event): void;
  toggleInfo(id: string, event?: Event): void;
  selectLineage(lineage: string, event?: Event): Promise<void>;
}

export class OrgChartDemoNode {
  public static readonly $au = {
    type: 'custom-element',
    name: 'org-chart-demo-node',
    template,
    bindables: ['employeeId', 'lineage', 'chart'],
  } as const;

  public employeeId = '';
  public lineage = '';
  public chart!: OrgChartLike;

  public get employee(): Person | null {
    return getPerson(this.employeeId);
  }

  public get reports(): readonly Person[] {
    const employee = this.employee;
    return employee == null
      ? []
      : employee.reports
        .map(id => getPerson(id))
        .filter((person): person is Person => person != null);
  }

  public childLineage(reportId: string): string {
    return `${this.lineage}/${reportId}`;
  }

  public isChildActive(reportId: string): boolean {
    return this.chart.isActiveBranch(this.childLineage(reportId));
  }

  public async selectChild(reportId: string, event?: Event): Promise<void> {
    await this.chart.selectLineage(this.childLineage(reportId), event);
  }

  public async select(event?: Event): Promise<void> {
    await this.chart.selectLineage(this.lineage, event);
  }

  public toggleInfo(event?: Event): void {
    this.chart.toggleInfo(this.employeeId, event);
  }

  public toggleExpanded(event?: Event): void {
    this.chart.toggleExpanded(this.employeeId, this.lineage, event);
  }

  public get selected(): boolean {
    return this.chart.isSelected(this.lineage);
  }

  public get activeBranch(): boolean {
    return this.chart.isActiveBranch(this.lineage);
  }

  public get showChildren(): boolean {
    return this.chart.shouldShowChildren(this.lineage, this.employeeId);
  }

  public get infoOpen(): boolean {
    return this.chart.isInfoOpen(this.employeeId);
  }
}
