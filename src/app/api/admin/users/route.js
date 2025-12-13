import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/admin/users
 * Get all users with stats
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const adminEmail = searchParams.get('admin_email');

    // Verify admin authentication
    if (!adminEmail) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );

    // Verify admin is active
    const { data: admin, error: adminError } = await supabase
      .from('admin_credentials')
      .select('id')
      .eq('admin_email', adminEmail.toLowerCase().trim())
      .eq('is_active', true)
      .single();

    if (adminError || !admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Get all users using the RPC function
    const { data: users, error: usersError } = await supabase
      .rpc('get_all_users_admin');

    if (usersError) {
      console.error('[Admin Users] Error fetching users:', usersError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch users' },
        { status: 500 }
      );
    }

    // Log activity
    await supabase.rpc('log_admin_activity', {
      p_admin_email: adminEmail,
      p_action_type: 'view_users',
      p_details: { user_count: users?.length || 0 }
    });

    return NextResponse.json({
      success: true,
      users: users || [],
      total: users?.length || 0
    });

  } catch (error) {
    console.error('[Admin Users] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users
 * Delete single or multiple users
 * Body: { admin_email, user_ids: [uuid, uuid, ...] }
 */
export async function DELETE(request) {
  try {
    const body = await request.json();
    const { admin_email, user_id, user_ids: userIdsArray, delete_all_data } = body;
    
    // Support both single user_id and array user_ids
    const user_ids = userIdsArray || (user_id ? [user_id] : []);

    // Validate input
    if (!admin_email || user_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Admin email and user ID(s) required' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );

    // Verify admin is active
    const { data: admin, error: adminError } = await supabase
      .from('admin_credentials')
      .select('id')
      .eq('admin_email', admin_email.toLowerCase().trim())
      .eq('is_active', true)
      .single();

    if (adminError || !admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Delete users using RPC function
    let result;
    
    if (user_ids.length === 1) {
      // Single user deletion
      const { data, error } = await supabase.rpc('delete_user_completely', {
        p_user_id: user_ids[0],
        p_admin_email: admin_email
      });

      if (error) {
        console.error('[Admin Users] Delete error:', error);
        return NextResponse.json(
          { success: false, error: 'Failed to delete user', details: error.message },
          { status: 500 }
        );
      }

      result = {
        success: true,
        total_requested: 1,
        successful_deletions: data?.success ? 1 : 0,
        failed_deletions: data?.success ? 0 : 1,
        results: [data]
      };

    } else {
      // Bulk deletion
      const { data, error } = await supabase.rpc('delete_users_bulk', {
        p_user_ids: user_ids,
        p_admin_email: admin_email
      });

      if (error) {
        console.error('[Admin Users] Bulk delete error:', error);
        return NextResponse.json(
          { success: false, error: 'Failed to delete users', details: error.message },
          { status: 500 }
        );
      }

      result = data;
    }

    // Log the deletion activity
    await supabase.rpc('log_admin_activity', {
      p_admin_email: admin_email,
      p_action_type: 'bulk_delete_users',
      p_details: {
        user_ids,
        result
      }
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('[Admin Users] Delete error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete users' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/users
 * Update user status (activate, deactivate, ban, unban)
 * Body: { action, user_ids: [uuid, uuid, ...] }
 */
export async function PATCH(request) {
  try {
    const { action, user_ids } = await request.json();

    // Validate input
    if (!action || !user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Action and user IDs array required' },
        { status: 400 }
      );
    }

    const validActions = ['activate', 'deactivate', 'ban', 'unban', 'view', 'edit'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );

    let updateData = {};
    let successMessage = '';

    switch (action) {
      case 'activate':
        updateData = { is_active: true, is_banned: false };
        successMessage = 'Users activated successfully';
        break;
      case 'deactivate':
        updateData = { is_active: false };
        successMessage = 'Users deactivated successfully';
        break;
      case 'ban':
        updateData = { is_active: false, is_banned: true };
        successMessage = 'Users banned successfully';
        break;
      case 'unban':
        updateData = { is_banned: false, is_active: true };
        successMessage = 'Users unbanned successfully';
        break;
      case 'view':
        // Handle view action - redirect to profile
        return NextResponse.json({
          success: true,
          action: 'redirect',
          url: `/view-profile/${user_ids[0]}`
        });
      case 'edit':
        // Handle edit action - return user data for editing
        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user_ids[0])
          .single();

        if (userError) {
          return NextResponse.json(
            { success: false, error: 'Failed to fetch user data' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          action: 'edit',
          user: userData
        });
    }

    // Update users in database
    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .in('id', user_ids)
      .select();

    if (error) {
      console.error('[Admin Users] Update error:', error);
      return NextResponse.json(
        { success: false, error: `Failed to ${action} users` },
        { status: 500 }
      );
    }

    // Log the action
    await supabase.rpc('log_admin_activity', {
      p_admin_email: 'admin@system', // You might want to pass actual admin email
      p_action_type: `user_${action}`,
      p_details: {
        user_ids,
        action,
        affected_count: data?.length || 0
      }
    });

    return NextResponse.json({
      success: true,
      message: successMessage,
      affected_count: data?.length || 0,
      users: data
    });

  } catch (error) {
    console.error('[Admin Users] PATCH error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update users' },
      { status: 500 }
    );
  }
}
