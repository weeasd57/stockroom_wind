// This file is used by Vercel to override the default Next.js build command
// to use a special SSR-only configuration

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Log the start of the process
console.log('Starting Vercel-specific SSR-only build...');

try {
  // Run next build with environment variables to force SSR
  console.log('Building with Vercel-specific Next.js config...');
  execSync('npx next build --config next.config.vercel.js', {
    stdio: 'inherit',
    env: {
      ...process.env,
      NEXT_DISABLE_PRERENDER: '1',
      NEXT_PUBLIC_RUNTIME_SSR_ONLY: 'true',
    }
  });

  console.log('Build completed successfully with Vercel-specific configuration!');
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}
