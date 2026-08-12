import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist/assets';
if (!existsSync(dist)) {
  console.error('Performance audit requires a production build in dist/.');
  process.exit(2);
}
const files = readdirSync(dist).filter((file) => /\.(js|css)$/.test(file)).map((file) => ({ file, bytes: statSync(join(dist, file)).size })).sort((a, b) => b.bytes - a.bytes);
const jsBytes = files.filter((f) => f.file.endsWith('.js')).reduce((sum, f) => sum + f.bytes, 0);
const largest = files.slice(0, 5);
console.table(largest.map((f) => ({ file: f.file, KiB: Math.round(f.bytes / 1024) })));
console.log(`Total JS: ${Math.round(jsBytes / 1024)} KiB`);
const maxAppChunk = 400 * 1024;
const maxMediaVendorChunk = 600 * 1024;
const oversized = files.filter((f) => {
  if (!f.file.endsWith('.js')) return false;
  const limit = /(^|[-_])hls[-_]/i.test(f.file) ? maxMediaVendorChunk : maxAppChunk;
  return f.bytes > limit;
});
if (oversized.length) {
  console.error('Performance budget exceeded: application JS chunk > 400 KiB or HLS vendor chunk > 600 KiB.');
  process.exit(1);
}
