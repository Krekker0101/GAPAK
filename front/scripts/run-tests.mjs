import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const root = join(process.cwd(), 'tests');

async function collect(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await collect(full));
    else if (entry.isFile() && entry.name.endsWith('.test.ts')) files.push(full);
  }
  return files;
}

const files = (await collect(root)).sort();
if (!files.length) {
  console.error('No test files found.');
  process.exit(1);
}

const child = spawn(process.execPath, ['--test', '--experimental-strip-types', ...files], {
  stdio: 'inherit',
  shell: false,
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
