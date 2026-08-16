export interface PlaygroundDiagnostic {
  file: string | null;
  line: number | null;
  column: number | null;
  severity: 'error' | 'warning';
  message: string;
}

export interface PlaygroundCompileRequest {
  type: 'compile';
  id: number;
  entry: string;
  files: Record<string, string>;
}

export interface PlaygroundCompileSuccess {
  type: 'compiled';
  id: number;
  javascript: string;
  css: string;
  diagnostics: PlaygroundDiagnostic[];
}

export interface PlaygroundCompileFailure {
  type: 'compile-error';
  id: number;
  diagnostics: PlaygroundDiagnostic[];
}

export type PlaygroundCompileResponse = PlaygroundCompileSuccess | PlaygroundCompileFailure;

export interface PlaygroundPreviewMessage {
  channel: 'router-html-playground';
  type: 'ready' | 'console' | 'runtime-error' | 'navigation' | 'title';
  level?: 'log' | 'info' | 'warn' | 'error';
  message?: string;
  path?: string;
  title?: string;
}
