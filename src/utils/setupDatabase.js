// This script sets up the database schema and storage buckets for the StockRoom application
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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

    // Execute SQL schema
    console.log('Setting up database tables...');
    const { error: schemaError } = await supabase.rpc('setup_schema');
    
    if (schemaError) {
      throw schemaError;
    }
    
    console.log('Database setup completed successfully');
  } catch (error) {
    console.error('Error setting up database:', error);
  }
}

// Run the setup function
setupDatabase();
