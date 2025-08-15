import { supabase } from './supabase';

/**
 * Get comments for a post using the comments_with_user_info view
 * @param {string} postId - Post ID
 * @returns {Promise<object>} - Comments data and error
 */
export const getPostComments = async (postId) => {
  if (!postId) {
    return { data: [], error: { message: 'Post ID is required' } };
  }

  try {
    // Use the comments_with_user_info view from SQL schema
    const { data, error } = await supabase
      .from('comments_with_user_info')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Group comments by parent_comment_id for nested structure
    const topLevelComments = data.filter(comment => !comment.parent_comment_id);
    const replies = data.filter(comment => comment.parent_comment_id);
    
    // Add replies to their parent comments
    const commentsWithReplies = topLevelComments.map(comment => ({
      ...comment,
      replies: replies.filter(reply => reply.parent_comment_id === comment.id)
    }));

    return { data: commentsWithReplies, error: null };
  } catch (error) {
    console.error('Error fetching comments:', error);
    return { data: [], error };
  }
};

/**
 * Create a new comment
 * @param {string} postId - Post ID
 * @param {string} userId - User ID
 * @param {string} content - Comment content
 * @param {string} parentCommentId - Parent comment ID (optional for replies)
 * @returns {Promise<object>} - Created comment data and error
 */
export const createComment = async (postId, userId, content, parentCommentId = null) => {
  if (!postId || !userId || !content?.trim()) {
    return { data: null, error: { message: 'Post ID, User ID, and content are required' } };
  }

  try {
    const { data, error } = await supabase
      .from('comments')
      .insert({
        post_id: postId,
        user_id: userId,
        content: content.trim(),
        parent_comment_id: parentCommentId
      })
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Error creating comment:', error);
    return { data: null, error };
  }
};

/**
 * Update a comment
 * @param {string} commentId - Comment ID
 * @param {string} content - New comment content
 * @returns {Promise<object>} - Updated comment data and error
 */
export const updateComment = async (commentId, content) => {
  if (!commentId || !content?.trim()) {
    return { data: null, error: { message: 'Comment ID and content are required' } };
  }

  try {
    const { data, error } = await supabase
      .from('comments')
      .update({ 
        content: content.trim(),
        is_edited: true,
        edited_at: new Date().toISOString()
      })
      .eq('id', commentId)
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Error updating comment:', error);
    return { data: null, error };
  }
};

/**
 * Delete a comment
 * @param {string} commentId - Comment ID
 * @returns {Promise<object>} - Deletion result and error
 */
export const deleteComment = async (commentId) => {
  if (!commentId) {
    return { data: null, error: { message: 'Comment ID is required' } };
  }

  try {
    const { data, error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId)
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Error deleting comment:', error);
    return { data: null, error };
  }
};

/**
 * Get comment count for a post
 * @param {string} postId - Post ID
 * @returns {Promise<number>} - Comment count
 */
export const getPostCommentCount = async (postId) => {
  if (!postId) return 0;

  try {
    const { count, error } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId);

    if (error) throw error;

    return count || 0;
  } catch (error) {
    console.error('Error getting comment count:', error);
    return 0;
  }
};

/**
 * Get nested comments using the recursive function from SQL schema
 * @param {string} postId - Post ID
 * @returns {Promise<object>} - Nested comments data and error
 */
export const getNestedComments = async (postId) => {
  if (!postId) {
    return { data: [], error: { message: 'Post ID is required' } };
  }

  try {
    // Use the get_nested_comments function from SQL schema
    const { data, error } = await supabase
      .rpc('get_nested_comments', { p_post_id: postId });

    if (error) throw error;

    return { data: data || [], error: null };
  } catch (error) {
    console.error('Error fetching nested comments:', error);
    // Fallback to regular comment fetching if RPC function doesn't exist
    return await getPostComments(postId);
  }
};