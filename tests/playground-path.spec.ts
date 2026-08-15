import assert from 'node:assert/strict';
import {
  dirname,
  normalizeVirtualPath,
  resolveProjectFile,
  resolveVirtualPath,
} from '../playground/virtual-path';

describe('playground virtual paths', function () {
  it('normalizes every project path to an absolute POSIX path', function () {
    assert.equal(normalizeVirtualPath('src\\cards\\..\\app.ts'), '/src/app.ts');
    assert.equal(normalizeVirtualPath('/src/./components/card.html'), '/src/components/card.html');
  });

  it('resolves relative, dot, extensionless, and index imports', function () {
    const files = new Map([
      ['/src/app.ts', ''],
      ['/src/card.ts', ''],
      ['/src/widgets/index.html', ''],
    ]);

    assert.equal(resolveVirtualPath('/src/app.ts', '.'), '/src');
    assert.equal(resolveProjectFile(files, '/src/app.ts', './card'), '/src/card.ts');
    assert.equal(resolveProjectFile(files, '/src/app.ts', './widgets'), '/src/widgets/index.html');
    assert.equal(resolveProjectFile(files, '/src/app.ts', './missing'), null);
    assert.equal(dirname('/src/widgets/index.html'), '/src/widgets');
  });
});
