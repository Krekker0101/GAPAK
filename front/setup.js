const { execSync } = require('child_process');
const path = require('path');

console.log('=== Starting Frontend Setup ===');
console.log('Working directory:', __dirname);

try {
  console.log('\n1. Running npm install...');
  execSync('npm install', { 
    cwd: __dirname, 
    stdio: 'inherit',
    shell: process.platform === 'win32' ? 'cmd.exe' : undefined 
  });
  console.log('✓ npm install completed');
} catch (error) {
  console.error('✗ npm install failed:', error.message);
  process.exit(1);
}

try {
  console.log('\n2. Running TypeScript check...');
  execSync('npm run typecheck', { 
    cwd: __dirname, 
    stdio: 'inherit',
    shell: process.platform === 'win32' ? 'cmd.exe' : undefined 
  });
  console.log('✓ TypeScript check passed');
} catch (error) {
  console.error('✗ TypeScript check failed:', error.message);
}

try {
  console.log('\n3. Running linter...');
  execSync('npm run lint', { 
    cwd: __dirname, 
    stdio: 'inherit',
    shell: process.platform === 'win32' ? 'cmd.exe' : undefined 
  });
  console.log('✓ Linter passed');
} catch (error) {
  console.error('✗ Linter issues found:', error.message);
}

console.log('\n4. Starting dev server...');
console.log('npm run dev command ready to execute');
