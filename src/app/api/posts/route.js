import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

// Create standard client using anon key
const supabaseServer = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } })
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

    // Get authorization header for authenticated requests
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    // Read and sanitize payload to avoid non-existent DB fields
    let postPayload = stripInvalidPostFields(await request.json());
    // Log incoming sanitized payload keys for debugging (avoid logging sensitive values)
    try {
      console.debug('[API /posts] POST payload keys:', Object.keys(postPayload));
    } catch {}
    // Log only the presence of Authorization header (avoid leaking tokens)
    try {
      const hasAuth = !!request.headers.get('authorization');
      console.debug('[API /posts] Authorization header present:', hasAuth);
    } catch (e) {
      console.debug('[API /posts] Failed to read authorization header', e);
    }

    // Check post creation limit if user is authenticated
    if (postPayload.user_id && token) {
      try {
        // Create authenticated client
        const authClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        });

        // Check if user can create a post
        const { data: canCreate, error: limitError } = await authClient
          .rpc('check_post_limit', { p_user_id: postPayload.user_id });
        
        if (limitError) {
          console.error('Error checking post limit:', limitError);
        } else if (canCreate === false) {
          return NextResponse.json({
            error: 'لقد وصلت إلى الحد الأقصى لإنشاء المنشورات لهذا الشهر. يرجى الترقية إلى Pro للحصول على المزيد.',
            error_en: 'You have reached your monthly post creation limit. Please upgrade to Pro for more.',
            success: false
          }, { status: 403 });
        }
      } catch (err) {
        console.warn('Failed to check post limit:', err);
        // Continue anyway - let database handle the limit
      }
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

    // Determine DB client to use for writes: require user token (never use service role for user content)
    let dbClient;
    const authHeaderForDb = request.headers.get('authorization') || request.headers.get('Authorization');
    if (authHeaderForDb && authHeaderForDb.startsWith('Bearer ')) {
      try {
        dbClient = createClient(supabaseUrl || '', supabaseAnonKey || '', {
          global: {
            headers: {
              Authorization: authHeaderForDb,
            },
          },
        });
        console.debug('[API /posts] per-request client created with user token');
      } catch (e) {
        console.debug('[API /posts] failed to create per-request client with token', e);
        return NextResponse.json({ error: 'Authentication error' }, { status: 401 });
      }
    } else {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { data: post, error } = await dbClient
      .from('posts')
      .insert([postPayload])
      .select(`
        *,
        user:user_id(username, full_name, avatar_url)
      `)
      .single();

    if (error) {
      console.error('[API /posts] Error creating post:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log post creation if successful and user is authenticated
    if (post && postPayload.user_id && token) {
      try {
        const authClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        });
        
        const { error: logError } = await authClient
          .rpc('log_post_creation', { p_user_id: postPayload.user_id });
        
        if (logError) {
          console.warn('Failed to log post creation:', logError);
        }
      } catch (err) {
        console.warn('Error logging post creation:', err);
      }
    }

    return NextResponse.json({ data: post, success: true });
  } catch (error) {
    console.error('Unhandled error in POST /api/posts:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request) {
  // Editing posts is disabled by product rules
  return NextResponse.json({ error: 'Editing posts is disabled.' }, { status: 403 });
}

export async function DELETE(request) {
  // Deleting posts is disabled by product rules
  return NextResponse.json({ error: 'Deleting posts is disabled.' }, { status: 403 });
}
