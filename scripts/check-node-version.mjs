#!/usr/bin/env node
/**
 * Check if the current Node.js version meets our requirements
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = join(__dirname, '..', 'package.json');

try {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const requiredVersion = packageJson.engines?.node;
  
  if (!requiredVersion) {
    console.log('⚠️  No Node.js version requirement found in package.json');
    process.exit(1);
  }

  const currentVersion = process.version;
  const currentMajor = parseInt(currentVersion.slice(1).split('.')[0]);
  const requiredMajor = parseInt(requiredVersion.replace('>=', '').split('.')[0]);

  console.log(`📋 Node.js Version Check`);
  console.log(`   Current version: ${currentVersion}`);
  console.log(`   Required: ${requiredVersion}`);
  console.log('');

  if (currentMajor >= requiredMajor) {
    console.log('✅ Node.js version meets requirements!');
    
    if (currentMajor > requiredMajor) {
      console.log(`🚀 You're using Node.js ${currentMajor}, which is newer than required. Great!`);
    }
    
    process.exit(0);
  } else {
    console.log('❌ Node.js version does not meet requirements');
    console.log('');
    console.log('🔧 To upgrade Node.js:');
    console.log('');
    console.log('   Option 1 - Using Node Version Manager (nvm):');
    console.log('   $ nvm install --lts');
    console.log('   $ nvm use --lts');
    console.log('');
    console.log('   Option 2 - Using Homebrew (macOS):');
    console.log('   $ brew install node');
    console.log('');
    console.log('   Option 3 - Download from nodejs.org:');
    console.log('   $ open https://nodejs.org/');
    console.log('');
    console.log('   Then run: yarn install && yarn build');
    
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Error checking Node.js version:', error.message);
  process.exit(1);
}
