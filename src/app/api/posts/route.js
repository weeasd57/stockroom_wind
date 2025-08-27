import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { whatsappService } from '@/services/whatsappService';

// Initialize Supabase clients
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Check if required environment variables are set
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing required Supabase environment variables:', {
    supabaseUrl: !!supabaseUrl,
    supabaseAnonKey: !!supabaseAnonKey
  });
  // Return a fallback response instead of crashing
  const fallbackResponse = {
    error: 'Database configuration not available',
    data: [],
    meta: { page: 1, limit: 10, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
    success: false
  };
}

// Server-side client that can bypass RLS when using the service role key
const serviceRoleKey = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
// Define a service-role client if available (server-only). This fixes usage of an undefined supabaseServer.
const supabaseServer = serviceRoleKey && supabaseUrl
  ? createClient(supabaseUrl, serviceRoleKey)
  : null;

// Minimal payload sanitizer to avoid non-existent columns errors (PGRST204)
function stripInvalidPostFields(input) {
  if (!input || typeof input !== 'object') return input;
  // Destructure to drop forbidden fields, keep the rest intact
  // Note: do not mutate the original object
  const { sentiment, last_price, lastPrice, ...rest } = input;
  return rest;
}

export async function GET(request) {
  try {
    // Check if Supabase is properly configured
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({
        error: 'Database configuration not available',
        data: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
        success: false
      }, { status: 503 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const userId = searchParams.get('userId');
    const country = searchParams.get('country');
    const strategy = searchParams.get('strategy');
    const status = searchParams.get('status');

    const offset = (page - 1) * limit;

    let query = supabase
      .from('posts')
      .select(`
        *,
        user:user_id(username, full_name, avatar_url)
      `, { count: 'exact' });

    if (userId) {
      query = query.eq('user_id', userId);
    }
    if (country) {
      query = query.ilike('country', `%${country}%`);
    }
    if (strategy) {
      query = query.ilike('strategy', `%${strategy}%`);
    }
    if (status) {
      if (status === 'open') {
        query = query.eq('closed', false);
      } else if (status === 'success') {
        query = query.eq('target_reached', true);
      } else if (status === 'loss') {
        query = query.eq('stop_loss_triggered', true);
      }
    }

    query = query.order(sortBy, { ascending: false }); // Latest posts first
    query = query.range(offset, offset + limit - 1);

    const { data: posts, error, count } = await query;

    if (error) {
      console.error('Error fetching posts:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const totalPages = Math.ceil(count / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return NextResponse.json({
      data: posts,
      meta: {
        page,
        limit,
        total: count,
        totalPages,
        hasNext,
        hasPrev,
      },
      success: true,
    });
  } catch (error) {
    console.error('Unhandled error in GET /api/posts:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    // Check if Supabase is properly configured
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({
        error: 'Database configuration not available',
        success: false
      }, { status: 503 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Read and sanitize payload to avoid non-existent DB fields
    let postPayload = stripInvalidPostFields(await request.json());
    // Log incoming sanitized payload keys for debugging (avoid logging sensitive values)
    try {
      console.debug('[API /posts] POST payload keys:', Object.keys(postPayload));
    } catch {}
    // Log auth header for RLS debugging
    try {
      console.debug('[API /posts] Authorization header:', request.headers.get('authorization'));
    } catch (e) {
      console.debug('[API /posts] Failed to read authorization header', e);
    }

    // Basic validation to catch schema issues early
    const missing = [];
    if (!postPayload.user_id) missing.push('user_id');
    if (!postPayload.symbol) missing.push('symbol');
    if (!postPayload.country) missing.push('country');
    if (!postPayload.content && !postPayload.description) missing.push('content/description');
    if (missing.length) {
      // Try to recover missing user_id from Authorization bearer token if available
      const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
      if (missing.includes('user_id') && authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.split(' ')[1];
          const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
          if (payload && payload.sub) {
            postPayload.user_id = payload.sub;
            // remove user_id from missing and continue
            const idx = missing.indexOf('user_id');
            if (idx !== -1) missing.splice(idx, 1);
          }
        } catch (e) {
          console.debug('[API /posts] Failed to extract user id from token', e);
        }
      }

      if (missing.length) {
        console.error('[API /posts] Validation failed, missing fields:', missing);
        return NextResponse.json({ error: `Missing fields: ${missing.join(', ')}` }, { status: 400 });
      }
    }

    // Determine DB client to use:
    // - prefer service role client (bypasses RLS) if configured
    // - otherwise, if request includes Authorization Bearer <token>, create a per-request client
    //   that forwards that token so RLS policies evaluate as the authenticated user
    let dbClient = supabase;
    if (supabaseServer) {
      console.debug('[API /posts] using service role client for insert');
      dbClient = supabaseServer;
    } else {
      const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          // Create a temporary client that forwards the user's JWT in requests
          dbClient = createClient(supabaseUrl || '', supabaseAnonKey || '', {
            global: {
              headers: {
                Authorization: authHeader,
              },
            },
          });
          console.debug('[API /posts] created per-request client using user token');
        } catch (e) {
          console.debug('[API /posts] failed to create per-request client with token', e);
          dbClient = supabase; // fallback
        }
      } else {
        console.debug('[API /posts] no service role and no user token provided; using anon client');
        dbClient = supabase; // ensure dbClient is always defined
      }
    }

    const { data, error } = await dbClient
      .from('posts')
      .insert([postPayload])
      .select(`
        *,
        user:user_id(username, full_name, avatar_url)
      `);

    if (error) {
      // Log full error for debugging
      console.error('[API /posts] Supabase insert error:', JSON.stringify(error));
      return NextResponse.json({ error: error.message || 'Insert failed', supabaseError: error }, { status: 500 });
    }

    const newPost = data[0];
    
    // إرسال إشعارات WhatsApp للمتابعين (بشكل غير متزامن)
    if (newPost && newPost.user) {
      const postData = {
        id: newPost.id,
        user_id: newPost.user_id,
        content: newPost.content,
        symbol: newPost.symbol,
        company_name: newPost.company_name,
        current_price: newPost.current_price,
        target_price: newPost.target_price,
        stop_loss_price: newPost.stop_loss_price,
        strategy: newPost.strategy,
        author_name: newPost.user.full_name || newPost.user.username
      };

      // إرسال الإشعارات في الخلفية (لا ننتظر النتيجة)
      whatsappService.notifyFollowersOfNewPost(postData).catch(error => {
        console.error('[API /posts] WhatsApp notification error:', error);
        // لا نوقف إنشاء المنشور بسبب خطأ في الإشعارات
      });
      
      console.log('[API /posts] WhatsApp notifications triggered for post:', newPost.id);
    }

    return NextResponse.json({ data: newPost, success: true }, { status: 201 });
  } catch (error) {
    console.error('Unhandled error in POST /api/posts:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    // Check if Supabase is properly configured
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({
        error: 'Database configuration not available',
        success: false
      }, { status: 503 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { id, updates } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Post ID is required for PATCH' }, { status: 400 });
    }

    // Sanitize updates to strip any non-existent DB fields
    const safeUpdates = stripInvalidPostFields(updates);

    // Choose the right client (service role > user token client > anon)
    let dbClient = supabase;
    if (supabaseServer) {
      dbClient = supabaseServer;
    } else {
      const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          dbClient = createClient(supabaseUrl || '', supabaseAnonKey || '', {
            global: { headers: { Authorization: authHeader } },
          });
        } catch (e) {
          console.debug('[API /posts] PATCH: failed to create per-request client with token', e);
          dbClient = supabase;
        }
      }
    }

    const { data, error } = await dbClient
      .from('posts')
      .update(safeUpdates)
      .eq('id', id)
      .select(`
        *,
        user:user_id(username, full_name, avatar_url)
      `);

    if (error) {
      console.error('Error updating post:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Post not found or no changes made' }, { status: 404 });
    }

    return NextResponse.json({ data: data[0], success: true }, { status: 200 });
  } catch (error) {
    console.error('Unhandled error in PATCH /api/posts:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    // Check if Supabase is properly configured
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({
        error: 'Database configuration not available',
        success: false
      }, { status: 503 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Post ID is required for DELETE' }, { status: 400 });
    }

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting post:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Post deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('Unhandled error in DELETE /api/posts:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
