// This file is used by Vercel to override the default Next.js build command
// to skip static generation and force server-side rendering only

const { execSync } = require('child_process');

// Set environment variables to force dynamic rendering
process.env.NEXT_SKIP_STATIC_GENERATION = 'true';
process.env.NEXT_FORCE_DYNAMIC = 'true';

try {
  // Run the Next.js build without static optimization
  execSync('npx next build', {
    stdio: 'inherit',
    env: {
      ...process.env,
      // These environment variables will be picked up by Next.js
      NEXT_SKIP_STATIC_GENERATION: 'true',
      NEXT_FORCE_DYNAMIC: 'true'
    }
  });
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}
