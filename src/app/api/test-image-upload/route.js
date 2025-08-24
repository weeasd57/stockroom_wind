import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Test endpoint to verify image_url insertion works
export async function POST(request) {
  try {
    const { image_url, user_id } = await request.json();
    
    console.log('[TEST API] Received data:', { image_url, user_id });
    
    // Create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    
    // Get a valid user_id from profiles table if not provided
    let validUserId = user_id;
    if (!validUserId) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);
      
      if (profiles && profiles.length > 0) {
        validUserId = profiles[0].id;
        console.log('[TEST API] Using profile ID:', validUserId);
      } else {
        throw new Error('No profiles found in database');
      }
    }
    
    // Test post data with ALL required fields matching database schema
    const testPost = {
      user_id: validUserId,
      content: 'Test post with image',
      image_url: image_url || 'https://example.com/test-image.jpg',
      symbol: 'TEST',
      company_name: 'Test Company',
      country: 'USA',
      exchange: 'TEST',
      current_price: 100,
      target_price: 120,
      stop_loss_price: 90,
      strategy: 'BUY',
      description: 'Test post to verify image_url is saved',
      initial_price: 100,
      status_message: 'Active', // Required field
      created_at: new Date().toISOString()
    };
    
    console.log('[TEST API] Inserting test post:', testPost);
    console.log('[TEST API] image_url value:', testPost.image_url);
    
    // Insert directly
    const { data, error } = await supabase
      .from('posts')
      .insert(testPost)
      .select()
      .single();
    
    if (error) {
      console.error('[TEST API] Insert error:', error);
      return NextResponse.json({ 
        success: false, 
        error: error.message,
        details: error
      }, { status: 400 });
    }
    
    console.log('[TEST API] Insert successful:', data);
    console.log('[TEST API] Returned image_url:', data?.image_url);
    
    // Verify by fetching the post again
    const { data: verifyData, error: verifyError } = await supabase
      .from('posts')
      .select('id, image_url, content')
      .eq('id', data.id)
      .single();
    
    console.log('[TEST API] Verification result:', verifyData);
    
    return NextResponse.json({ 
      success: true, 
      data,
      verified: verifyData,
      image_url_saved: !!verifyData?.image_url
    });
    
  } catch (error) {
    console.error('[TEST API] Unexpected error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// Test GET endpoint to check if posts have image_urls
export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    
    const { data, error } = await supabase
      .from('posts')
      .select('id, content, image_url')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      return NextResponse.json({ 
        success: false, 
        error: error.message 
      }, { status: 400 });
    }
    
    const withImages = data.filter(p => p.image_url);
    const withoutImages = data.filter(p => !p.image_url);
    
    return NextResponse.json({ 
      success: true,
      total: data.length,
      withImages: withImages.length,
      withoutImages: withoutImages.length,
      posts: data
    });
    
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
