const { execSync } = require('child_process');

const isNetlify = process.env.NETLIFY === 'true';
const isCi = process.env.CI === 'true';

try {
  if (isNetlify || isCi) {
    console.log('==================================================');
    console.log('CI/Netlify environment detected.');
    console.log('Installing client dependencies only (skipping server to prevent OOM)...');
    console.log('==================================================');
    
    // Install only client dependencies to build the frontend
    execSync('npm install --prefix client', { stdio: 'inherit' });
  } else {
    console.log('==================================================');
    console.log('Local offline environment detected.');
    console.log('Installing client and server dependencies...');
    console.log('==================================================');
    
    // Install both client and server dependencies locally
    execSync('npm install --prefix client', { stdio: 'inherit' });
    execSync('npm install --prefix server', { stdio: 'inherit' });
  }
} catch (error) {
  console.error('Postinstall dependency installation failed:', error);
  process.exit(1);
}
