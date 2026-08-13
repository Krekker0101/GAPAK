import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (relPath: string) => readFileSync(join(process.cwd(), relPath), 'utf8');

/**
 * Contract: alert acknowledgement/dismissal has no backend mutation endpoint.
 * Decision: (a) hide — this is a secondary/administrative action (viewing
 * alerts is the primary UX; acknowledging one is not on the critical path),
 * so the mutating control is removed entirely rather than left clickable.
 * See docs/SECURITY.md "Unsupported action policy" for the full criterion.
 */
test('Security Alerts UI never renders an acknowledge/dismiss control', () => {
  const source = read('src/domains/security/components/AlertsSection.tsx');
  assert.doesNotMatch(source, /<Button|<button/i, 'no mutating control may exist for a backend endpoint that does not exist');
  assert.doesNotMatch(source, /onClick|acknowledgeAlert|dismissAlert/i, 'no click handler may exist for a backend endpoint that does not exist');
  assert.match(source, /exposes no read or dismiss mutation/i, 'the hidden control must be replaced with a clear explanation, not silence');
});

/**
 * Contract: security flags have no backend mutation endpoint.
 * Decision: (a) hide — same reasoning as alerts: flags are informational
 * telemetry, not an action the primary security workflow depends on.
 */
test('Security Flags UI never renders a mutating control', () => {
  const source = read('src/domains/security/components/SecurityFlagsSection.tsx');
  assert.doesNotMatch(source, /<Button|<button|onClick|updateFlag|resolveFlag/i, 'no mutating control may exist for a backend endpoint that does not exist');
  assert.match(source, /exposes no mutation endpoint/i, 'the hidden control must be replaced with a clear explanation, not silence');
});

/**
 * Contract: there is no "reset panic mode" capability anywhere in the
 * frontend, because the backend exposes no reset endpoint. Panic mode
 * *execution* is real (POST /security/panic-mode) and stays active — it is
 * the primary action of this screen — but nothing may claim to undo it
 * locally.
 */
test('Panic Mode UI never claims a local/reset capability that does not exist on the backend', () => {
  const source = read('src/domains/security/components/PanicModeSection.tsx');
  assert.doesNotMatch(source, /resetPanic|clearPanic|undoPanic|<Button[^>]*>\s*(Reset|Undo)/i);
  assert.match(source, /no reset endpoint/i, 'the UI must say plainly why no reset control exists');
  assert.match(source, /does not fabricate or locally reset panic state/i);
});

/**
 * Contract: Panic Mode execution itself is decision (b) — active, and on
 * failure surfaces the backend's own error rather than a fabricated result.
 * It is the primary action of a dedicated screen the user navigated to
 * specifically to trigger it, so hiding it would remove the feature.
 */
test('Panic Mode execute button stays active and surfaces real backend errors, never a fabricated result', () => {
  const source = read('src/domains/security/components/PanicModeSection.tsx');
  assert.match(source, /await SecurityService\.executePanicMode/);
  assert.match(source, /setError\(e instanceof Error \? e\.message : 'Panic mode execution failed\.'\)/);
  assert.doesNotMatch(source, /setResult\(\{[^}]*\}\)(?![\s\S]*await SecurityService)/, 'a result must only ever come from the awaited backend call');
});

/**
 * Contract: SecurityService exposes no client-side method that pretends to
 * acknowledge alerts, mutate flags, or reset panic state locally. This is
 * the regression guard for "fake success" creeping back in at the service
 * layer even if a future UI change re-adds a button.
 */
test('SecurityService exposes no fake mutation for alerts, flags, or panic reset', () => {
  const source = read('src/domains/security/SecurityService.ts');
  assert.doesNotMatch(source, /acknowledgeAlert|dismissAlert|updateFlag|resetPanic|clearPanic/i);
});

test('securityApi defines no request for alert/flag mutation or panic reset', () => {
  const source = read('src/domains/security/api/securityApi.ts');
  assert.doesNotMatch(source, /alerts\/.*(?:acknowledge|dismiss)|flags\/.*(?:update|resolve)|panic.*reset/i);
});
