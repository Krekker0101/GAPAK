const required = ['GAPAK_E2E_BASE_URL', 'GAPAK_E2E_AUTH_URL'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Mandatory E2E environment is missing: ${missing.join(', ')}`);
  process.exit(1);
}
console.log('Mandatory E2E environment: OK');
