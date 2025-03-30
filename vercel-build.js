// This file is used by Vercel to override the default Next.js build command
// to completely disable static generation

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Log the start of the process
console.log('Starting Vercel-specific SSR-only build...');

try {
  // Copy the Vercel-specific Next.js config to the main config file temporarily
  const vercelConfigPath = path.join(process.cwd(), 'next.config.vercel.js');
  const mainConfigPath = path.join(process.cwd(), 'next.config.js');
  
  // Back up the original config
  let originalConfig = '';
  if (fs.existsSync(mainConfigPath)) {
    originalConfig = fs.readFileSync(mainConfigPath, 'utf8');
    console.log('Backed up original Next.js config');
  }
  
  // Use the Vercel-specific config as the main config
  if (fs.existsSync(vercelConfigPath)) {
    const vercelConfig = fs.readFileSync(vercelConfigPath, 'utf8');
    fs.writeFileSync(mainConfigPath, vercelConfig);
    console.log('Applied Vercel-specific Next.js config');
  } else {
    console.log('Vercel-specific config not found, using original config');
  }
  
  // Run next build with environment variables to force SSR
  console.log('Building with SSR-only settings...');
  execSync('npx next build', {
    stdio: 'inherit',
    env: {
      ...process.env,
      NEXT_DISABLE_PRERENDER: '1',
      NEXT_PUBLIC_RUNTIME_SSR_ONLY: 'true'
    }
  });
  
  console.log('Build completed successfully!');
  
  // Restore the original config
  if (originalConfig) {
    fs.writeFileSync(mainConfigPath, originalConfig);
    console.log('Restored original Next.js config');
  }
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}
