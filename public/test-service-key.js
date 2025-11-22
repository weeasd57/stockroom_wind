// Test if SUPABASE_SERVICE_ROLE_KEY is working
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Testing Service Role Key...\n');
console.log('SUPABASE_URL:', SUPABASE_URL ? '✅ Set' : '❌ Missing');
console.log('SERVICE_KEY:', SERVICE_KEY ? '✅ Set' : '❌ Missing');
console.log('\nFirst 20 chars of SERVICE_KEY:', SERVICE_KEY?.substring(0, 20) + '...');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('\n❌ Missing environment variables!');
  process.exit(1);
}

// Try to create Supabase client
(async () => {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  
  console.log('\n✅ Supabase client created successfully');
  
  // Test query (bypass RLS)
  const { data, error } = await supabase
    .from('contact_conversations')
    .select('id, email, user_id')
    .limit(3);
  
  if (error) {
    console.error('\n❌ Query failed:', error.message);
  } else {
    console.log('\n✅ Query successful! Found', data.length, 'conversations');
    console.log('Sample:', data);
  }
})();
