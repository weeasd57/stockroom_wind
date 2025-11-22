import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Fetch all posts with profile information
    const { data: posts, error } = await supabase
      .from('posts_with_stats')
      .select(`
        *,
        profile:profiles(
          id,
          username,
          avatar_url,
          full_name
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching posts:', error);
      return NextResponse.json(
        { error: 'Failed to fetch posts' },
        { status: 500 }
      );
    }

    // Add status field if not exists (for moderation)
    const postsWithStatus = posts?.map(post => ({
      ...post,
      status: post.status || 'approved', // Default to approved if no status
      is_featured: post.is_featured || false
    })) || [];

    return NextResponse.json({
      posts: postsWithStatus,
      total: postsWithStatus.length
    });

  } catch (error) {
    console.error('Admin posts API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    const { action, post_ids } = await request.json();

    // Validate input
    if (!action || !post_ids || !Array.isArray(post_ids) || post_ids.length === 0) {
      return NextResponse.json(
        { error: 'Action and post IDs array required' },
        { status: 400 }
      );
    }

    const validActions = ['approve', 'reject', 'feature', 'unfeature', 'delete'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

    const supabase = createRouteHandlerClient({ cookies });

    let result;

    switch (action) {
      case 'approve':
        result = await supabase
          .from('posts')
          .update({ status: 'approved' })
          .in('id', post_ids);
        break;

      case 'reject':
        result = await supabase
          .from('posts')
          .update({ status: 'rejected' })
          .in('id', post_ids);
        break;

      case 'feature':
        result = await supabase
          .from('posts')
          .update({ is_featured: true })
          .in('id', post_ids);
        break;

      case 'unfeature':
        result = await supabase
          .from('posts')
          .update({ is_featured: false })
          .in('id', post_ids);
        break;

      case 'delete':
        // First delete related records (comments, likes, etc.)
        await supabase
          .from('post_comments')
          .delete()
          .in('post_id', post_ids);

        await supabase
          .from('post_likes')
          .delete()
          .in('post_id', post_ids);

        // Then delete the posts
        result = await supabase
          .from('posts')
          .delete()
          .in('id', post_ids);
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    if (result.error) {
      console.error(`Error ${action}ing posts:`, result.error);
      return NextResponse.json(
        { error: `Failed to ${action} posts` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Posts ${action}d successfully`,
      affected_count: post_ids.length
    });

  } catch (error) {
    console.error('Admin posts PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update posts' },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const { post_ids } = await request.json();

    if (!post_ids || !Array.isArray(post_ids) || post_ids.length === 0) {
      return NextResponse.json(
        { error: 'Post IDs array required' },
        { status: 400 }
      );
    }

    const supabase = createRouteHandlerClient({ cookies });

    // Delete related records first
    await supabase
      .from('post_comments')
      .delete()
      .in('post_id', post_ids);

    await supabase
      .from('post_likes')
      .delete()
      .in('post_id', post_ids);

    // Delete the posts
    const { data, error } = await supabase
      .from('posts')
      .delete()
      .in('id', post_ids)
      .select();

    if (error) {
      console.error('Error deleting posts:', error);
      return NextResponse.json(
        { error: 'Failed to delete posts' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Posts deleted successfully',
      deleted_count: data?.length || 0
    });

  } catch (error) {
    console.error('Admin posts DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete posts' },
      { status: 500 }
    );
  }
}
