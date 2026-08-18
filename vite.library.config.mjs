import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';

const aureliaPackages = /^@aurelia\//;
const SOURCE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'router');

/**
 * @param {string} filePath
 */
function isRelevantFile(filePath) {
  return filePath.endsWith('.ts');
}

/**
 * @param {string} directory
 * @returns {string[]}
 */
function collectSourceFiles(directory) {
  /** @type {string[]} */
  const sourceFiles = [];
  const entries = fs.readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
        continue;
      }
      sourceFiles.push(...collectSourceFiles(path.join(directory, entry.name)));
      continue;
    }
    if (entry.isFile()) {
      const filePath = path.join(directory, entry.name);
      if (isRelevantFile(filePath)) {
        sourceFiles.push(filePath);
      }
    }
  }

  return sourceFiles;
}

/**
 * @param {ts.SourceFile} sourceFile
 * @param {Set<string>} members
 */
function collectMembers(sourceFile, members) {
  /** @param {ts.Node} node */
  const walk = (node) => {
    if (ts.isPropertyDeclaration(node) || ts.isMethodDeclaration(node) || ts.isGetAccessor(node) || ts.isSetAccessor(node)) {
      addMemberName(node.name, members);
    } else if (ts.isParameter(node) && ts.isConstructorDeclaration(node.parent) && isClassPropertyParameter(node)) {
      addMemberName(node.name, members);
    }

    ts.forEachChild(node, walk);
  };

  walk(sourceFile);

  return members;

  function isClassPropertyParameter(parameter) {
    return parameter.modifiers?.some(modifier =>
      modifier.kind === ts.SyntaxKind.PrivateKeyword ||
      modifier.kind === ts.SyntaxKind.PublicKeyword ||
      modifier.kind === ts.SyntaxKind.ProtectedKeyword ||
      modifier.kind === ts.SyntaxKind.ReadonlyKeyword
    ) ?? false;
  }

  /**
   * @param {ts.PropertyName | ts.BindingName | ts.MemberName} name
   */
  function addMemberName(name) {
    if (ts.isIdentifier(name) && isPrivateName(name.text)) {
      members.add(name.text);
      return;
    }
    if (ts.isStringLiteral(name) && isPrivateName(name.text)) {
      members.add(name.text);
    }
  }

  function isPrivateName(name) {
    return name.startsWith('_');
  }
}

/**
 * @param {Set<string>} members
 * @returns {Record<string, string>}
 */
function createMangleCacheFromMembers(members) {
  const names = [...members].sort();
  const cache = /** @type {Record<string, string>} */ ({});

  for (let i = 0; i < names.length; i++) {
    cache[names[i]] = shortIdentifier(i);
  }

  return cache;
}

/**
 * @param {number} index
 * @returns {string}
 */
function shortIdentifier(index) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_';
  let remaining = index;
  let identifier = '';

  do {
    const char = alphabet[remaining % alphabet.length];
    identifier = `${char}${identifier}`;
    remaining = Math.floor(remaining / alphabet.length) - 1;
  } while (remaining >= 0);

  return identifier;
}

/** @type {Map<string, number>} */
const sourceFileMtimeCache = new Map();
/** @type {Map<string, Set<string>>} */
const sourceFileMembersCache = new Map();

/** @type {Record<string, string> | undefined} */
let mangleCache;

/** @returns {Record<string, string>} */
function getMangleCache() {
  if (mangleCache == null) {
    refreshMangleCache();
  }

  return mangleCache;
}

/** @param {string} filePath */
function isUnderSourceRoot(filePath) {
  const normalizedPath = path.resolve(filePath);
  return normalizedPath === SOURCE_ROOT || normalizedPath.startsWith(`${SOURCE_ROOT}${path.sep}`);
}

/** @param {string} filePath */
function removeTrackedSourceFile(filePath) {
  sourceFileMembersCache.delete(filePath);
  sourceFileMtimeCache.delete(filePath);
}

/** @param {string} filePath */
function refreshTrackedSourceFile(filePath) {
  const normalizedPath = path.resolve(filePath);
  if (!isUnderSourceRoot(normalizedPath) || !isRelevantFile(normalizedPath)) {
    return false;
  }

  if (!fs.existsSync(normalizedPath)) {
    const tracked = sourceFileMembersCache.has(normalizedPath);
    if (tracked) {
      removeTrackedSourceFile(normalizedPath);
      return true;
    }
    return false;
  }

  const mtime = fs.statSync(normalizedPath).mtimeMs;
  if (sourceFileMtimeCache.get(normalizedPath) === mtime && sourceFileMembersCache.has(normalizedPath)) {
    return false;
  }

  const contents = fs.readFileSync(normalizedPath, 'utf-8');
  const sourceFile = ts.createSourceFile(normalizedPath, contents, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const members = collectMembers(sourceFile, new Set());
  sourceFileMembersCache.set(normalizedPath, members);
  sourceFileMtimeCache.set(normalizedPath, mtime);
  return true;
}

/**
 * @param {string[] | null} [filePaths]
 */
function refreshMangleCache(filePaths = null) {
  let changed = false;

  if (filePaths == null) {
    const sourceFiles = collectSourceFiles(SOURCE_ROOT);
    const sourceFileSet = new Set(sourceFiles);
    for (const trackedFile of sourceFileMembersCache.keys()) {
      if (!sourceFileSet.has(trackedFile)) {
        removeTrackedSourceFile(trackedFile);
        changed = true;
      }
    }

    for (const sourcePath of sourceFiles) {
      changed = refreshTrackedSourceFile(sourcePath) || changed;
    }
  } else {
    for (const filePath of filePaths) {
      changed = refreshTrackedSourceFile(filePath) || changed;
    }
  }

  if (!changed && mangleCache != null) {
    return;
  }

  const members = new Set();
  for (const fileMembers of sourceFileMembersCache.values()) {
    for (const member of fileMembers) {
      members.add(member);
    }
  }

  const nextCache = createMangleCacheFromMembers(members);
  if (mangleCache == null) {
    mangleCache = nextCache;
    return;
  }

  for (const property of Object.keys(mangleCache)) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete mangleCache[property];
  }
  Object.assign(mangleCache, nextCache);
}

/**
 * @returns {import('vite').Plugin}
 */
function refreshMangleCachePlugin() {
  return {
    name: 'aurelia-router-html-mangle-cache-refresh',
    buildStart() {
      refreshMangleCache();
    },
    watchChange(id) {
      refreshMangleCache([id]);
    },
  };
}

export default defineConfig(({ mode }) => ({
  define: {
    __DEV__: JSON.stringify(mode === 'development'),
  },
  build: {
    emptyOutDir: false,
    lib: {
      entry: 'router/index.ts',
      formats: ['es'],
      fileName: () => mode === 'development' ? 'index.dev.mjs' : 'index.mjs',
    },
    minify: mode === 'production',
    rollupOptions: {
      external: aureliaPackages,
    },
    sourcemap: true,
    target: 'es2022',
  },
  esbuild: {
    target: 'es2022',
    mangleProps: /^_/,
    mangleCache: getMangleCache(),
  },
  plugins: [
    refreshMangleCachePlugin(),
  ],
}));
