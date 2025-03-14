// This script sets up the database schema and storage buckets for the StockRoom application
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase client with hardcoded values for setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mfbgpnpgwmxgxpjnxzrb.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mYmdwbnBnd214Z3hwam54enJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTI2MjA0NTcsImV4cCI6MjAyODE5NjQ1N30.hhPJ9vr0ToIGNvJ_U9WT_zCCXoOc2YeVQTjuQQVCBtw';

console.log('Using Supabase URL:', supabaseUrl);
console.log('Using Supabase Key:', supabaseKey ? 'Key is set' : 'Key is not set');

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupDatabase() {
  console.log('Setting up database schema and storage...');

  try {
    // Create posts storage bucket if it doesn't exist
    const { data: buckets, error: bucketsError } = await supabase
      .storage
      .listBuckets();

    if (bucketsError) {
      throw bucketsError;
    }

    const postsBucketExists = buckets.some(bucket => bucket.name === 'posts');
    
    if (!postsBucketExists) {
      console.log('Creating posts storage bucket...');
      const { error: createBucketError } = await supabase
        .storage
        .createBucket('posts', {
          public: true,
          fileSizeLimit: 10485760, // 10MB
        });
        
      if (createBucketError) {
        throw createBucketError;
      }
      console.log('Posts storage bucket created successfully');
    } else {
      console.log('Posts storage bucket already exists');
    }

    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'src', 'utils', 'setup_schema.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

    // Execute the SQL directly
    console.log('Setting up database tables...');
    const { error: sqlError } = await supabase.sql(sqlContent);
    
    if (sqlError) {
      console.error('Error executing SQL:', sqlError);
      
      // Try to execute the setup_schema function if it exists
      console.log('Trying to call setup_schema function...');
      const { error: rpcError } = await supabase.rpc('setup_schema');
      
      if (rpcError) {
        console.error('Error calling setup_schema function:', rpcError);
        throw rpcError;
      }
    }
    
    console.log('Database setup completed successfully');
  } catch (error) {
    console.error('Error setting up database:', error);
  }
}

// Run the setup function
setupDatabase();
