import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const violations = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === 'devtools' || entry === 'node_modules') continue;
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry)) {
      const text = readFileSync(full, 'utf8');
      if (/dangerouslySetInnerHTML|\.innerHTML\s*=/.test(text)) violations.push(`${full}: raw HTML sink`);
      if (/btoa\(|atob\(|MockWebSocket|fake crypto|fake token|fake OAuth|fake 2FA/i.test(text)) violations.push(`${full}: forbidden fake/security primitive`);
    }
  }
};
walk('src');
if (violations.length) {
  console.error(violations.join('\n'));
  process.exit(1);
}
console.log('GAPAK static lint: OK');
