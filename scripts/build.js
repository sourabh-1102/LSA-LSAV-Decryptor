const { execSync } = require('child_process');

const isNetlify = process.env.NETLIFY === 'true';
const isCi = process.env.CI === 'true';

try {
  if (isNetlify || isCi) {
    console.log('==================================================');
    console.log('CI/Netlify environment detected.');
    console.log('Building React client only (skipping server build)...');
    console.log('==================================================');
    
    // Build only client on Netlify
    execSync('npm run build --prefix client', { stdio: 'inherit' });
  } else {
    console.log('==================================================');
    console.log('Local offline environment detected.');
    console.log('Building server and client...');
    console.log('==================================================');
    
    // Build both locally
    execSync('npm run build --prefix server', { stdio: 'inherit' });
    execSync('npm run build --prefix client', { stdio: 'inherit' });
  }
} catch (error) {
  console.error('Build step failed:', error);
  process.exit(1);
}
