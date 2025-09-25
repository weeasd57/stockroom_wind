// This script sets up the database schema and storage buckets for the StockRoom application
import { createClient } from '@supabase/supabase-js';

// Lazily initialize client at call-time to avoid build-time env access
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL for setupDatabase');
  }
  if (!anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY for setupDatabase');
  }
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export default async function setupDatabase() {
  console.log('Setting up database schema and storage...');

  try {
    const supabase = getSupabaseClient();
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
    throw error;
  }
}
