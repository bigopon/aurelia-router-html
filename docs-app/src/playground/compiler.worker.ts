import { build, initialize, type BuildFailure, type Loader, type Message, type Plugin } from 'esbuild-wasm';
import wasmUrl from 'esbuild-wasm/esbuild.wasm?url';
import ts from 'typescript';
import { preprocess, type IFileUnit, type IFileUnitHost } from './conventions';
import type {
  PlaygroundCompileRequest,
  PlaygroundCompileResponse,
  PlaygroundDiagnostic,
} from './protocol';
import { runtimePackages } from './runtime-packages';
import {
  dirname,
  extension,
  normalizeVirtualPath,
  resolveProjectFile,
  resolveVirtualPath,
} from '../../../playground/virtual-path';

const runtimeNamespace = 'playground-runtime';
const projectNamespace = 'playground-project';
const textNamespace = 'playground-text';
const runtimeSpecifiers = new Set(Object.keys(runtimePackages));
const reservedWords = new Set(['class', 'default', 'delete', 'export', 'extends', 'function', 'import', 'in', 'instanceof', 'new', 'return', 'super', 'this', 'throw', 'typeof', 'var', 'void', 'while', 'with', 'yield']);
let initialized: Promise<void> | null = null;

self.onmessage = (event: MessageEvent<PlaygroundCompileRequest>): void => {
  if (event.data.type !== 'compile') {
    return;
  }
  void compile(event.data).then(response => self.postMessage(response));
};

async function compile(request: PlaygroundCompileRequest): Promise<PlaygroundCompileResponse> {
  try {
    await ensureInitialized();
    const files = new Map<string, string>();
    for (const [path, contents] of Object.entries(request.files)) {
      files.set(normalizeVirtualPath(path), contents);
    }
    const entry = normalizeVirtualPath(request.entry);
    if (!files.has(entry)) {
      return failure(request.id, `Entry file ${entry} does not exist.`, entry);
    }

    const result = await build({
      entryPoints: [entry],
      absWorkingDir: '/',
      bundle: true,
      format: 'esm',
      platform: 'browser',
      target: 'es2022',
      write: false,
      outdir: '/out',
      sourcemap: 'inline',
      logLevel: 'silent',
      define: {
        __DEV__: 'true',
      },
      plugins: [createVirtualPlugin(files)],
    });

    const diagnostics = [
      ...result.warnings.map(message => toDiagnostic(message, 'warning')),
      ...result.errors.map(message => toDiagnostic(message, 'error')),
    ];
    const javascript = result.outputFiles.find(file => file.path.endsWith('.js'))?.text ?? '';
    const css = result.outputFiles.find(file => file.path.endsWith('.css'))?.text ?? '';
    return {
      type: 'compiled',
      id: request.id,
      javascript,
      css,
      diagnostics,
    };
  } catch (error) {
    const buildFailure = error as Partial<BuildFailure>;
    if (Array.isArray(buildFailure.errors)) {
      return {
        type: 'compile-error',
        id: request.id,
        diagnostics: [
          ...buildFailure.errors.map(message => toDiagnostic(message, 'error')),
          ...(buildFailure.warnings ?? []).map(message => toDiagnostic(message, 'warning')),
        ],
      };
    }
    return failure(request.id, error instanceof Error ? error.message : String(error));
  }
}

function createVirtualPlugin(files: ReadonlyMap<string, string>): Plugin {
  const host: IFileUnitHost = {
    fileExists(unit, path) {
      return resolveProjectFile(files, unit.path, path) != null;
    },
    readFile(unit, path) {
      const resolved = resolveProjectFile(files, unit.path, path);
      if (resolved == null) {
        throw new Error(`Cannot read ${path} from ${unit.path}.`);
      }
      return files.get(resolved)!;
    },
  };

  return {
    name: 'aurelia-playground',
    setup(pluginBuild) {
      pluginBuild.onResolve({ filter: /.*/ }, args => {
        if (args.kind === 'entry-point') {
          return { path: normalizeVirtualPath(args.path), namespace: projectNamespace };
        }
        if (args.path.startsWith('playground-text:')) {
          const specifier = args.path.slice('playground-text:'.length);
          const path = resolveProjectFile(files, args.importer, specifier);
          return path == null
            ? { errors: [{ text: `Cannot resolve stylesheet ${specifier} from ${args.importer}.` }] }
            : { path, namespace: textNamespace };
        }
        if (runtimeSpecifiers.has(args.path)) {
          return { path: args.path, namespace: runtimeNamespace };
        }
        if (!args.path.startsWith('.') && !args.path.startsWith('/')) {
          return { errors: [{ text: `Package "${args.path}" is not available in this playground.` }] };
        }
        const path = resolveProjectFile(files, args.importer, args.path);
        return path == null
          ? { errors: [{ text: `Cannot resolve ${args.path} from ${args.importer}.` }] }
          : { path, namespace: projectNamespace };
      });

      pluginBuild.onLoad({ filter: /.*/, namespace: runtimeNamespace }, args => ({
        contents: createRuntimeShim(args.path),
        loader: 'js',
      }));

      pluginBuild.onLoad({ filter: /.*/, namespace: textNamespace }, args => ({
        contents: files.get(args.path)!,
        loader: 'text',
      }));

      pluginBuild.onLoad({ filter: /.*/, namespace: projectNamespace }, args => {
        const contents = files.get(args.path);
        if (contents == null) {
          return { errors: [{ text: `Virtual file ${args.path} does not exist.` }] };
        }
        const ext = extension(args.path);
        if (ext === '.css') {
          return { contents, loader: 'css', resolveDir: dirname(args.path) };
        }
        const unit: IFileUnit = { path: args.path, contents };
        const transformed = preprocess(unit, {
          hmr: false,
          isDev: true,
          enableConventions: true,
          experimentalTemplateTypeCheck: false,
          stringModuleWrap: id => `playground-text:${id}`,
        }, host);
        const code = transformed?.code ?? contents;
        return {
          contents: transpile(code, args.path, ext),
          loader: transpiledLoaderFor(ext),
          resolveDir: dirname(args.path),
        };
      });
    },
  };
}

function createRuntimeShim(specifier: string): string {
  const exports = Object.keys(runtimePackages[specifier]);
  const statements = [`const __package = globalThis.__PLAYGROUND_PACKAGES__[${JSON.stringify(specifier)}];`];
  if (exports.includes('default')) {
    statements.push('export default __package.default;');
  }
  for (const name of exports) {
    if (name !== 'default' && isIdentifier(name) && !reservedWords.has(name)) {
      statements.push(`export const ${name} = __package[${JSON.stringify(name)}];`);
    }
  }
  return statements.join('\n');
}

function transpile(code: string, path: string, ext: string): string {
  if (ext !== '.ts' && ext !== '.tsx' && ext !== '.js' && ext !== '.jsx') {
    return code;
  }
  return ts.transpileModule(code, {
    fileName: path,
    compilerOptions: {
      allowJs: true,
      experimentalDecorators: false,
      jsx: ts.JsxEmit.Preserve,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      useDefineForClassFields: false,
    },
  }).outputText;
}

function transpiledLoaderFor(ext: string): Loader {
  switch (ext) {
    case '.tsx':
    case '.jsx': return 'jsx';
    default: return 'js';
  }
}

function isIdentifier(value: string): boolean {
  return /^[$A-Z_a-z][$\w]*$/.test(value);
}

function ensureInitialized(): Promise<void> {
  return initialized ??= initialize({ wasmURL: wasmUrl, worker: false });
}

function toDiagnostic(message: Message, severity: PlaygroundDiagnostic['severity']): PlaygroundDiagnostic {
  const notes = message.notes.map(note => note.text).filter(Boolean);
  return {
    file: message.location?.file ?? null,
    line: message.location?.line ?? null,
    column: message.location == null ? null : message.location.column + 1,
    severity,
    message: [message.text, ...notes].join(' — '),
  };
}

function failure(id: number, message: string, file: string | null = null): PlaygroundCompileResponse {
  return {
    type: 'compile-error',
    id,
    diagnostics: [{ file, line: null, column: null, severity: 'error', message }],
  };
}

declare global {
  var __PLAYGROUND_PACKAGES__: Record<string, Record<string, unknown>>;
}
