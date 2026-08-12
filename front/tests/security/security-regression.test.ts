import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root=join(process.cwd(),'src'); const files:string[]=[];
const walk=(dir:string)=>{for(const e of readdirSync(dir)){const p=join(dir,e); if(e==='devtools') continue; if(statSync(p).isDirectory()) walk(p); else if(/\.(ts|tsx)$/.test(e)) files.push(p);}}; walk(root);

test('production source does not log secrets or plaintext E2EE content', () => {
  for(const f of files){ const s=readFileSync(f,'utf8'); assert.doesNotMatch(s,/console\.(log|warn|error)\([^\n]*(password|accessToken|refreshToken|privateKey|sessionSecret|plaintext)/i); }
});

test('production source contains no obvious fake security implementations', () => {
  for(const f of files){ const s=readFileSync(f,'utf8'); assert.doesNotMatch(s,/MockWebSocket|fake crypto|fake token|fake OAuth|fake 2FA/i); }
});

test('E2EE protocol remains explicitly non-Signal', () => {
  const s=readFileSync(join(root,'domains/chats/crypto/CryptoProtocol.ts'),'utf8');
  assert.match(s,/custom protocol/i); assert.match(s,/NOT Signal Protocol \/ Double Ratchet/);
});
