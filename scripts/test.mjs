import ts from 'typescript';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const files = readdirSync('tests').filter((f) => f.endsWith('.test.ts'));
mkdirSync('.test-build/data', { recursive: true });
mkdirSync('.test-build/data/boundaries', { recursive: true });
writeFileSync(
  '.test-build/data/boundaries/index.json',
  readFileSync('data/boundaries/index.json'),
);
writeFileSync(
  '.test-build/data/instances.json',
  readFileSync('data/instances.json'),
);
for (const folder of ['lib', 'tests']) {
  mkdirSync('.test-build/' + folder, { recursive: true });
  for (const file of readdirSync(folder).filter((f) => f.endsWith('.ts'))) {
    const result = ts.transpileModule(
      readFileSync(folder + '/' + file, 'utf8'),
      {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.CommonJS,
          esModuleInterop: true,
        },
      },
    );
    writeFileSync(
      '.test-build/' + folder + '/' + file.replace(/\.ts$/, '.js'),
      result.outputText,
    );
  }
}
writeFileSync('.test-build/package.json', JSON.stringify({ type: 'commonjs' }));
const result = spawnSync(
  process.execPath,
  [
    '--test',
    ...files.map((f) => '.test-build/tests/' + f.replace(/\.ts$/, '.js')),
  ],
  { stdio: 'inherit' },
);
process.exit(result.status ?? 1);
