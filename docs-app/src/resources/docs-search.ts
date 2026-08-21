import template from './docs-search.html?raw';

interface PagefindModule {
  init(): Promise<void>;
  search(term: string): Promise<PagefindSearchResponse>;
}

interface PagefindSearchResponse {
  results: readonly PagefindSearchResult[];
}

interface PagefindSearchResult {
  data(): Promise<PagefindSearchResultData>;
}

interface PagefindSearchResultData {
  url: string;
  excerpt?: string;
  meta?: Record<string, string>;
}

interface SearchResult {
  readonly url: string;
  readonly title: string;
  readonly section: string;
  readonly excerpt: string;
}

export interface DocsSearchSelectDetail {
  readonly result: SearchResult;
  readonly source: 'keyboard' | 'pointer';
}

const focusRequestEvent = 'docs-search-focus-request';
const initialVisibleResults = 8;
const visibleResultsStep = 8;

let pagefindPromise: Promise<PagefindModule> | null = null;
const pagefindModulePath = '/pagefind/pagefind.js';

async function loadPagefind(): Promise<PagefindModule> {
  pagefindPromise ??= import(/* @vite-ignore */ pagefindModulePath).then(async module => {
    const pagefind = module as unknown as PagefindModule;
    await pagefind.init();
    return pagefind;
  });
  return pagefindPromise;
}

export class DocsSearch {
  public static readonly $au = {
    type: 'custom-element',
    name: 'docs-search',
    template,
  } as const;

  public searchQuery: string = '';
  public loading: boolean = false;
  public indexUnavailable: boolean = false;
  public statusMessage: string = '';
  public results: readonly SearchResult[] = [];
  public totalResults: number = 0;
  public focusedIndex: number = -1;
  public isExpanded: boolean = false;
  public readonly shortcutHint: string = navigator.platform.toLowerCase().includes('mac') ? 'Cmd K or /' : 'Ctrl K or /';
  public searchShell: HTMLElement | null = null;
  public searchInput: HTMLInputElement | null = null;
  public readonly resultLinks: HTMLAnchorElement[] = [];
  public resultsList: HTMLOListElement | null = null;
  public loadingMoreMessage: string = '';
  /** @internal */
  private readonly onFocusRequest = () => this.focusSearch();

  /** @internal */
  private searchToken: number = 0;
  /** @internal */
  private searchTimeout: ReturnType<typeof setTimeout> | null = null;
  /** @internal */
  private visibleResults: number = initialVisibleResults;
  /** @internal */
  private allResults: readonly PagefindSearchResult[] = [];
  /** @internal */
  private loadingMoreResults: boolean = false;
  /** @internal */
  private hydratedResults: SearchResult[] = [];
  /** @internal */
  private resultDataCache: Promise<SearchResult>[] = [];
  /** @internal */
  private focusRequestToken: number = 0;

  public attached(): void {
    window.addEventListener(focusRequestEvent, this.onFocusRequest);
    this.syncOverlayState();
    void this.ensureIndex();
  }

  public detaching(): void {
    window.removeEventListener(focusRequestEvent, this.onFocusRequest);
    this.setOverlayActive(false);
    if (this.searchTimeout != null) {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = null;
    }
  }

  public get hasOverflowResults(): boolean {
    return this.totalResults > this.results.length;
  }

  public onInput(): void {
    this.isExpanded = true;
    this.syncOverlayState();
    if (this.searchTimeout != null) {
      clearTimeout(this.searchTimeout);
    }
    const term = this.searchQuery.trim();
    if (term === '') {
      this.resetResults();
      return;
    }
    this.searchTimeout = setTimeout(() => {
      void this.runSearch(term);
    }, 160);
  }

  public openSearch(): void {
    this.isExpanded = true;
    this.syncOverlayState();
  }

  public focusSearch(): void {
    this.isExpanded = true;
    this.syncOverlayState();
    this.searchInput?.focus();
    this.searchInput?.select();
  }

  public dismissSearch(): void {
    this.isExpanded = false;
    this.focusedIndex = -1;
    this.syncOverlayState();
    this.searchInput?.blur();
  }

  public onShellFocusOut(event: FocusEvent): void {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && this.searchShell?.contains(nextTarget)) {
      return;
    }
    this.dismissSearch();
  }

  public onKeyDown(event: KeyboardEvent): void {
    if (this.results.length === 0) {
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      void this.moveFocus(1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.focusedIndex <= 0) {
        this.focusedIndex = -1;
        return;
      }
      this.focusResult(this.focusedIndex - 1);
      return;
    }
    if (event.key === 'Enter' && this.focusedIndex >= 0) {
      event.preventDefault();
      const result = this.results[this.focusedIndex];
      if (result != null) {
        this.concludeSearch();
        this.dispatchSelect(result, 'keyboard');
      }
    }
    if (event.key === 'End' && this.hasOverflowResults) {
      event.preventDefault();
      void this.showMoreResults(true);
    }
  }

  public clearSearch(): void {
    this.searchQuery = '';
    this.isExpanded = false;
    this.resetResults();
  }

  public onResultClick(event: MouseEvent, result: SearchResult): void {
    event.preventDefault();
    this.concludeSearch();
    this.dispatchSelect(result, 'pointer');
  }

  public async showMoreResults(focusLastResult: boolean = false): Promise<void> {
    if (!this.hasOverflowResults || this.loadingMoreResults) {
      return;
    }
    this.loadingMoreResults = true;
    this.loadingMoreMessage = 'Loading more results...';
    this.visibleResults = Math.min(this.visibleResults + visibleResultsStep, this.allResults.length);
    try {
      await this.syncVisibleResults(this.searchToken, this.searchQuery.trim(), true);
      if (focusLastResult && this.results.length > 0) {
        this.focusResult(this.results.length - 1);
      }
    } finally {
      this.loadingMoreResults = false;
      this.loadingMoreMessage = '';
    }
  }

  /** @internal */
  private async ensureIndex(): Promise<void> {
    try {
      await loadPagefind();
    } catch {
      this.indexUnavailable = true;
    }
  }

  /** @internal */
  private async runSearch(term: string): Promise<void> {
    const token = ++this.searchToken;
    this.loading = true;
    this.loadingMoreResults = false;
    this.loadingMoreMessage = '';
    this.statusMessage = '';
    this.focusedIndex = -1;
    this.resultLinks.length = 0;
    this.visibleResults = initialVisibleResults;
    this.hydratedResults = [];
    this.resultDataCache = [];

    try {
      const pagefind = await loadPagefind();
      if (token !== this.searchToken) {
        return;
      }

      const response = await pagefind.search(term);
      if (token !== this.searchToken) {
        return;
      }

      this.totalResults = response.results.length;
      this.allResults = response.results;
      await this.syncVisibleResults(token, term, false);
    } catch {
      if (token !== this.searchToken) {
        return;
      }
      this.indexUnavailable = true;
      this.results = [];
      this.totalResults = 0;
      this.allResults = [];
      this.hydratedResults = [];
      this.resultDataCache = [];
      this.statusMessage = '';
      this.loadingMoreMessage = '';
    } finally {
      if (token === this.searchToken) {
        this.loading = false;
      }
    }
  }

  /** @internal */
  private async syncVisibleResults(token: number, term: string, appendOnly: boolean): Promise<void> {
    const startIndex = appendOnly ? this.hydratedResults.length : 0;
    const endIndex = Math.min(this.visibleResults, this.allResults.length);
    const pendingResults: Promise<SearchResult>[] = [];

    for (let index = startIndex; index < endIndex; index++) {
      pendingResults.push(this.getSearchResult(index));
    }

    const nextResults = await Promise.all(pendingResults);
    if (token !== this.searchToken) {
      return;
    }

    if (appendOnly) {
      this.hydratedResults = this.hydratedResults.concat(nextResults);
    } else {
      this.hydratedResults = nextResults;
      this.resultLinks.length = 0;
    }

    this.results = this.hydratedResults;
    this.statusMessage = this.totalResults === 0
      ? `No results for "${term}".`
      : this.totalResults > this.results.length
        ? `Showing ${this.results.length} of ${this.totalResults} results for "${term}".`
        : `${this.totalResults} result${this.totalResults === 1 ? '' : 's'} for "${term}".`;
  }

  /** @internal */
  private getSearchResult(index: number): Promise<SearchResult> {
    this.resultDataCache[index] ??= this.allResults[index].data().then(result => {
      const title = result.meta?.title?.trim() || result.url;
      const section = result.meta?.section?.trim() || '';
      return {
        url: result.url,
        title,
        section,
        excerpt: result.excerpt?.trim() || '',
      };
    });
    return this.resultDataCache[index];
  }

  /** @internal */
  private focusResult(index: number): void {
    this.focusedIndex = index;
    void this.scheduleResultScroll(index, ++this.focusRequestToken);
  }

  /** @internal */
  private async scheduleResultScroll(index: number, token: number): Promise<void> {
    for (let attempt = 0; attempt < 6; attempt++) {
      if (token !== this.focusRequestToken) {
        return;
      }
      await waitForFrame();
      const link = this.resultLinks[index];
      const list = this.resultsList;
      if (link != null && link.isConnected && list != null && list.isConnected) {
        this.scrollResultIntoView(list, link);
        return;
      }
    }
  }

  /** @internal */
  private scrollResultIntoView(list: HTMLOListElement, link: HTMLAnchorElement): void {
    const scrollMargin = 10;
    const listRect = list.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    const topDelta = linkRect.top - listRect.top;
    const bottomDelta = linkRect.bottom - listRect.bottom;

    if (topDelta < scrollMargin) {
      list.scrollTop = Math.max(0, list.scrollTop + topDelta - scrollMargin);
      return;
    }

    if (bottomDelta > -scrollMargin) {
      list.scrollTop = list.scrollTop + bottomDelta + scrollMargin;
    }
  }

  /** @internal */
  private async moveFocus(delta: number): Promise<void> {
    const nextIndex = Math.min(this.focusedIndex + delta, this.results.length - 1);
    const needsMoreResults = delta > 0
      && nextIndex >= this.results.length - 2
      && this.hasOverflowResults;

    if (needsMoreResults) {
      const previousLength = this.results.length;
      await this.showMoreResults();
      if (this.results.length > previousLength) {
        this.focusResult(Math.min(this.focusedIndex + delta, this.results.length - 1));
        return;
      }
    }

    this.focusResult(nextIndex);
  }

  /** @internal */
  private resetResults(): void {
    this.searchToken++;
    this.loading = false;
    this.statusMessage = '';
    this.results = [];
    this.totalResults = 0;
    this.focusedIndex = -1;
    this.resultLinks.length = 0;
    this.resultsList = null;
    this.visibleResults = initialVisibleResults;
    this.allResults = [];
    this.loadingMoreResults = false;
    this.loadingMoreMessage = '';
    this.hydratedResults = [];
    this.resultDataCache = [];
    this.focusRequestToken++;
  }

  /** @internal */
  private concludeSearch(): void {
    this.dismissSearch();
  }

  /** @internal */
  private dispatchSelect(result: SearchResult, source: DocsSearchSelectDetail['source']): void {
    this.searchInput?.dispatchEvent(new CustomEvent<DocsSearchSelectDetail>('docs-search-select', {
      bubbles: true,
      detail: {
        result,
        source,
      },
    }));
  }

  /** @internal */
  private syncOverlayState(): void {
    this.setOverlayActive(this.isExpanded);
  }

  /** @internal */
  private setOverlayActive(active: boolean): void {
    document.body.classList.toggle('docs-search-open', active);
  }
}

function waitForFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}
