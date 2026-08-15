const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.html', '.css'];

export function normalizeVirtualPath(path: string): string {
  const segments: string[] = [];
  for (const segment of path.replace(/\\/g, '/').split('/')) {
    if (segment === '' || segment === '.') {
      continue;
    }
    if (segment === '..') {
      segments.pop();
    } else {
      segments.push(segment);
    }
  }
  return `/${segments.join('/')}`;
}

export function dirname(path: string): string {
  const normalized = normalizeVirtualPath(path);
  const separator = normalized.lastIndexOf('/');
  return separator <= 0 ? '/' : normalized.slice(0, separator);
}

export function resolveVirtualPath(importer: string, specifier: string): string {
  return normalizeVirtualPath(specifier.startsWith('/')
    ? specifier
    : `${dirname(importer)}/${specifier}`);
}

export function resolveProjectFile(
  files: ReadonlyMap<string, string>,
  importer: string,
  specifier: string,
): string | null {
  const path = resolveVirtualPath(importer, specifier);
  if (files.has(path)) {
    return path;
  }
  if (extension(path) !== '') {
    return null;
  }
  for (const candidateExtension of supportedExtensions) {
    const candidate = `${path}${candidateExtension}`;
    if (files.has(candidate)) {
      return candidate;
    }
  }
  for (const candidateExtension of supportedExtensions) {
    const candidate = `${path}/index${candidateExtension}`;
    if (files.has(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function extension(path: string): string {
  const slash = path.lastIndexOf('/');
  const dot = path.lastIndexOf('.');
  return dot > slash ? path.slice(dot) : '';
}
