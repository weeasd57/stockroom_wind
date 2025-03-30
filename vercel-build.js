// This file is used by Vercel to override the default Next.js build command
// to disable static generation and force server-side rendering for all pages

const { execSync } = require('child_process');

// Set environment variables to force dynamic rendering
process.env.NEXT_PUBLIC_RUNTIME_SSR_ONLY = 'true';

try {
  // Log the start of the build process
  console.log('Starting custom Vercel build with SSR-only optimizations...');
  
  // Run the next build with environment variables to disable static page generation
  execSync('npx next build', {
    stdio: 'inherit',
    env: {
      ...process.env,
      // These environment variables tell Next.js to not try static optimization
      NEXT_PUBLIC_RUNTIME_SSR_ONLY: 'true',
      // Disable static generation for all pages
      __NEXT_PRIVATE_PREBUNDLED_REACT: 'next/dist/compiled/react/cjs/react.production.min.js'
    }
  });
  
  console.log('Custom build completed successfully!');
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}
