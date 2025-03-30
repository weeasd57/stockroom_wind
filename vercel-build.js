// This file is used by Vercel to override the default Next.js build command
// to completely disable static generation

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Log the start of the process
console.log('Starting Vercel-specific SSR-only build...');

// Create a temporary .env.production file with strict SSR settings
const envPath = path.join(process.cwd(), '.env.production.local');
fs.writeFileSync(envPath, `
NEXT_RUNTIME=nodejs
NODE_ENV=production
NEXT_RUNTIME_TARGET=server
NEXT_DISABLE_PRERENDER=1
`);
console.log('Created .env.production.local with SSR-only settings');

// Define Next.js 14 specific rendering configuration
const appDirPath = path.join(process.cwd(), 'src', 'app');
console.log('Searching for app directory at:', appDirPath);

try {
  // Force dynamic rendering for all app directory routes by creating
  // a dynamic.js file in each directory that exports a dynamic = "force-dynamic" setting
  if (fs.existsSync(appDirPath)) {
    console.log('App directory found, adding dynamic rendering config to all routes');
    
    // Recursive function to create dynamic.js in all directories
    function addDynamicToDirectories(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      // Skip node_modules and hidden directories
      if (dir.includes('node_modules') || path.basename(dir).startsWith('.')) {
        return;
      }
      
      // Add dynamic.js to the current directory
      const dynamicJsPath = path.join(dir, 'dynamic.js');
      if (!fs.existsSync(dynamicJsPath)) {
        fs.writeFileSync(dynamicJsPath, `export const dynamic = 'force-dynamic';\n`);
        console.log(`Added dynamic.js to ${dir}`);
      }
      
      // Process subdirectories
      for (const entry of entries) {
        if (entry.isDirectory()) {
          addDynamicToDirectories(path.join(dir, entry.name));
        }
      }
    }
    
    // Start the recursive process
    addDynamicToDirectories(appDirPath);
  }

  // Run the standard Next.js build with environment variables to force SSR
  console.log('Running Next.js build with SSR-only settings...');
  execSync('npx next build', {
    stdio: 'inherit',
    env: {
      ...process.env,
      // Critical environment variables to force server-side rendering
      NEXT_DISABLE_PRERENDER: '1',
      NEXT_RUNTIME: 'nodejs',
      NEXT_RUNTIME_TARGET: 'server',
      NODE_ENV: 'production'
    }
  });
  
  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
} finally {
  // Clean up the temporary .env.production.local file
  if (fs.existsSync(envPath)) {
    fs.unlinkSync(envPath);
    console.log('Removed temporary .env.production.local file');
  }
  
  // Clean up dynamic.js files
  if (fs.existsSync(appDirPath)) {
    console.log('Cleaning up dynamic.js files');
    
    function removeDynamicFiles(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      // Skip node_modules and hidden directories
      if (dir.includes('node_modules') || path.basename(dir).startsWith('.')) {
        return;
      }
      
      // Remove dynamic.js from the current directory
      const dynamicJsPath = path.join(dir, 'dynamic.js');
      if (fs.existsSync(dynamicJsPath)) {
        fs.unlinkSync(dynamicJsPath);
        console.log(`Removed dynamic.js from ${dir}`);
      }
      
      // Process subdirectories
      for (const entry of entries) {
        if (entry.isDirectory()) {
          removeDynamicFiles(path.join(dir, entry.name));
        }
      }
    }
    
    // Start the recursive cleanup process
    removeDynamicFiles(appDirPath);
  }
}
