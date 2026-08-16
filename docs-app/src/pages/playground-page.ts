import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { basicSetup, EditorView } from 'codemirror';
import CompilerWorker from '../playground/compiler.worker?worker';
import { cloneExample, playgroundExamples, type PlaygroundExample } from '../playground/examples';
import type { PlaygroundCompileRequest, PlaygroundCompileResponse, PlaygroundDiagnostic, PlaygroundPreviewMessage } from '../playground/protocol';
import runtimeUrl from '../playground/preview-runtime.ts?worker&url';
import template from './playground-page.html?raw';

interface ConsoleEntry {
  level: string;
  message: string;
}

interface CodeMirrorUpdate {
  readonly docChanged: boolean;
  readonly state: { readonly doc: { toString(): string } };
}

type PlaygroundViewMode = 'code' | 'split' | 'preview';

const autoRunDelay = 900;

export class PlaygroundPage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'playground-page',
    template,
    bindables: ['exampleId', 'embedded'],
  } as const;

  public exampleId: string | null = null;
  public embedded = false;
  public readonly examples = playgroundExamples;
  public project = cloneExample(initialExample());
  public selectedFile = this.project.initialFile ?? Object.keys(this.project.files)[0];
  public diagnostics: PlaygroundDiagnostic[] = [];
  public consoleEntries: ConsoleEntry[] = [];
  public compiling = false;
  public status = 'Ready to compile';
  public currentPreviewPath = this.project.initialPath;
  public previewTitle = '';
  public viewMode: PlaygroundViewMode = 'split';
  public editorHost!: HTMLElement;
  public previewHost!: HTMLElement;
  public autoRunProgress!: HTMLElement;
  private worker: Worker | null = null;
  private readonly editors = new Map<string, EditorView>();
  private requestId = 0;
  private iframe: HTMLIFrameElement | null = null;
  private runtimeSource: Promise<string> | null = null;
  private autoRunTimer: number | null = null;

  public binding(): void {
    this.viewMode = this.readViewMode();
    if (this.exampleId == null) {
      return;
    }
    const example = this.examples.find(candidate => candidate.id === this.exampleId);
    if (example != null) {
      this.loadExample(example);
    }
  }

  public attached(): void {
    this.showEditor(this.selectedFile);
    this.worker = new CompilerWorker();
    this.worker.addEventListener('message', this.onCompileMessage);
    this.worker.addEventListener('error', this.onWorkerError);
    window.addEventListener('message', this.onPreviewMessage);
    void this.run();
  }

  public detaching(): void {
    this.cancelAutoRun();
    this.worker?.removeEventListener('message', this.onCompileMessage);
    this.worker?.removeEventListener('error', this.onWorkerError);
    this.worker?.terminate();
    this.worker = null;
    window.removeEventListener('message', this.onPreviewMessage);
    this.iframe?.remove();
    this.iframe = null;
    for (const editor of this.editors.values()) {
      editor.destroy();
    }
    this.editors.clear();
  }

  public get fileNames(): string[] {
    return Object.keys(this.project.files);
  }

  public selectFile(path: string): void {
    if (path === this.selectedFile || this.project.files[path] == null) {
      return;
    }
    this.selectedFile = path;
    this.showEditor(path);
  }

  public setViewMode(mode: PlaygroundViewMode): void {
    this.viewMode = mode;
    try {
      localStorage.setItem(this.viewModeStorageKey, mode);
    } catch {
      // A blocked storage API should not prevent the playground from working.
    }
    if (mode !== 'preview') {
      requestAnimationFrame(() => this.editors.get(this.selectedFile)?.requestMeasure());
    }
  }

  public queueRun(): void {
    this.cancelAutoRun();
    this.status = 'Changes pending';
    this.autoRunProgress?.classList.remove('is-counting');
    void this.autoRunProgress?.offsetWidth;
    this.autoRunProgress?.classList.add('is-counting');
    this.autoRunTimer = window.setTimeout(() => {
      this.autoRunTimer = null;
      this.autoRunProgress?.classList.remove('is-counting');
      this.run();
    }, autoRunDelay);
  }

  public chooseExample(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    const example = this.examples.find(candidate => candidate.id === id);
    if (example != null) {
      this.loadExample(example);
      void this.run();
    }
  }

  public reset(): void {
    const original = this.examples.find(example => example.id === this.project.id) ?? this.examples[0];
    this.loadExample(original);
    void this.run();
  }

  public async copyProject(): Promise<void> {
    try {
      await navigator.clipboard.writeText(JSON.stringify({
        entry: this.project.entry,
        files: this.project.files,
      }, null, 2));
      this.status = 'Project copied';
    } catch {
      this.status = 'Clipboard access was unavailable';
    }
  }

  public run(): void {
    this.cancelAutoRun();
    const id = ++this.requestId;
    this.compiling = true;
    this.status = 'Compiling…';
    this.diagnostics = [];
    this.consoleEntries = [];
    this.previewTitle = '';
    const request: PlaygroundCompileRequest = {
      type: 'compile',
      id,
      entry: this.project.entry,
      files: this.project.files,
    };
    this.worker?.postMessage(request);
  }

  private readonly onCompileMessage = (event: MessageEvent<PlaygroundCompileResponse>): void => {
    const response = event.data;
    if (response.id !== this.requestId) {
      return;
    }
    this.compiling = false;
    this.diagnostics = response.diagnostics;
    if (response.type === 'compile-error') {
      this.status = 'Compilation failed';
      return;
    }
    this.status = response.diagnostics.length === 0 ? 'Compiled' : 'Compiled with warnings';
    void this.showPreview(response.javascript, response.css);
  };

  private readonly onWorkerError = (event: ErrorEvent): void => {
    this.compiling = false;
    this.status = 'Compiler worker failed';
    this.diagnostics = [{
      file: event.filename || null,
      line: event.lineno || null,
      column: event.colno || null,
      severity: 'error',
      message: event.message,
    }];
  };

  private readonly onPreviewMessage = (event: MessageEvent<PlaygroundPreviewMessage>): void => {
    if (event.source !== this.iframe?.contentWindow || event.data.channel !== 'router-html-playground') {
      return;
    }
    const message = event.data;
    if (message.type === 'navigation' && message.path != null) {
      this.currentPreviewPath = message.path;
    } else if (message.type === 'title') {
      this.previewTitle = message.title ?? '';
    } else if (message.type === 'console' || message.type === 'runtime-error') {
      this.consoleEntries = [...this.consoleEntries, {
        level: message.level ?? 'error',
        message: message.message ?? 'Unknown runtime error',
      }];
    } else if (message.type === 'ready') {
      this.status = 'Running';
    }
  };

  private loadExample(example: PlaygroundExample): void {
    for (const editor of this.editors.values()) {
      editor.destroy();
    }
    this.editors.clear();
    this.project = cloneExample(example);
    this.selectedFile = this.project.initialFile ?? Object.keys(this.project.files)[0];
    this.currentPreviewPath = this.project.initialPath;
    this.previewTitle = '';
    this.diagnostics = [];
    this.consoleEntries = [];
    if (this.editorHost != null) {
      this.showEditor(this.selectedFile);
    }
  }

  private showEditor(path: string): void {
    for (const editor of this.editors.values()) {
      editor.dom.remove();
    }

    let editor = this.editors.get(path);
    if (editor == null) {
      editor = new EditorView({
        doc: this.project.files[path] ?? '',
        extensions: [
          basicSetup,
          languageFor(path),
          oneDark,
          EditorView.contentAttributes.of({
            'aria-label': `Editing ${path}`,
            'aria-multiline': 'true',
            spellcheck: 'false',
          }),
          EditorView.updateListener.of((update: CodeMirrorUpdate) => {
            if (!update.docChanged) {
              return;
            }
            this.project = {
              ...this.project,
              files: { ...this.project.files, [path]: update.state.doc.toString() },
            };
            this.queueRun();
          }),
        ],
      });
      this.editors.set(path, editor);
    }

    this.editorHost.replaceChildren(editor.dom);
    editor.requestMeasure();
  }

  private async showPreview(javascript: string, css: string): Promise<void> {
    try {
      const runtime = await (this.runtimeSource ??= fetch(runtimeUrl).then(response => {
        if (!response.ok) {
          throw new Error(`Could not load the preview runtime (${response.status}).`);
        }
        return response.text();
      }));
      this.iframe?.remove();
      const iframe = document.createElement('iframe');
      iframe.title = 'Playground preview';
      iframe.dataset.e2e = 'playground-preview';
      iframe.setAttribute('sandbox', 'allow-scripts');
      iframe.srcdoc = createPreviewDocument(runtime, runtimeUrl, javascript, css, this.project.initialPath);
      this.previewHost.replaceChildren(iframe);
      this.iframe = iframe;
    } catch (error) {
      this.status = 'Preview failed';
      this.consoleEntries = [{ level: 'error', message: error instanceof Error ? error.message : String(error) }];
    }
  }

  private get viewModeStorageKey(): string {
    return this.embedded ? 'router-html-playground-view-embedded' : 'router-html-playground-view-standalone';
  }

  private readViewMode(): PlaygroundViewMode {
    try {
      const mode = localStorage.getItem(this.viewModeStorageKey);
      if (mode === 'code' || mode === 'split' || mode === 'preview') {
        return mode;
      }
    } catch {
      // Use the default split view when storage is unavailable.
    }
    return 'split';
  }

  private cancelAutoRun(): void {
    if (this.autoRunTimer != null) {
      window.clearTimeout(this.autoRunTimer);
      this.autoRunTimer = null;
    }
    this.autoRunProgress?.classList.remove('is-counting');
  }
}

function createPreviewDocument(runtime: string, runtimeUrl: string, javascript: string, css: string, initialPath: string): string {
  const bridge = `${previewBridge}\nglobalThis.__PLAYGROUND_INITIAL_PATH__ = ${JSON.stringify(initialPath)};`;
  const externalRuntime = /^\s*import\s/m.test(runtime);
  const runtimeLoader = externalRuntime
    ? `await import(${JSON.stringify(new URL(runtimeUrl, window.location.href).href)});`
    : 'while (globalThis.__PLAYGROUND_PACKAGES__ == null) await new Promise(resolve => setTimeout(resolve, 0));';
  const application = `${runtimeLoader}\n${javascript}\nwindow.parent.postMessage({ channel: 'router-html-playground', type: 'ready' }, '*');`;
  const inlineRuntime = externalRuntime ? '' : `<script type="module">${escapeClosingTag(runtime, 'script')}</script>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${escapeClosingTag(css, 'style')}</style></head><body><div id="app"></div><script>${escapeClosingTag(bridge, 'script')}</script>${inlineRuntime}<script type="module">${escapeClosingTag(application, 'script')}</script></body></html>`;
}

function escapeClosingTag(value: string, tag: string): string {
  return value.replace(new RegExp(`</${tag}`, 'gi'), `<\\/${tag}`);
}

const previewBridge = `
const send = (type, detail = {}) => window.parent.postMessage({ channel: 'router-html-playground', type, ...detail }, '*');
const stringify = value => {
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return String(value); }
};
for (const level of ['log', 'info', 'warn', 'error']) {
  const original = console[level].bind(console);
  console[level] = (...values) => {
    original(...values);
    send('console', { level, message: values.map(stringify).join(' ') });
  };
}
window.addEventListener('error', event => send('runtime-error', { level: 'error', message: event.message }));
window.addEventListener('unhandledrejection', event => send('runtime-error', { level: 'error', message: stringify(event.reason) }));
const sendTitle = () => send('title', { title: document.title });
new MutationObserver(sendTitle).observe(document.head, { childList: true, subtree: true, characterData: true });
sendTitle();`;

function initialExample(): PlaygroundExample {
  const id = window.location.pathname.split('/').filter(Boolean).at(-1);
  return playgroundExamples.find(example => example.id === id) ?? playgroundExamples[0];
}

function languageFor(path: string) {
  if (/\.tsx?$/i.test(path)) {
    return javascript({ typescript: true, jsx: path.toLowerCase().endsWith('.tsx') });
  }
  if (/\.jsx?$/i.test(path)) {
    return javascript({ jsx: path.toLowerCase().endsWith('.jsx') });
  }
  if (/\.html?$/i.test(path)) {
    return html();
  }
  if (/\.css$/i.test(path)) {
    return css();
  }
  return [];
}
