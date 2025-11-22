'use client';

import { useState, useEffect } from 'react';
import { useSupabase } from '@/providers/SimpleSupabaseProvider';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { toast } from 'sonner';
import styles from '@/styles/admin/posts.module.css';

export default function PostModeration() {
  const { user, loading } = useSupabase();
  const router = useRouter();
  const [posts, setPosts] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPosts, setSelectedPosts] = useState(new Set());
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
  const [filterConfig, setFilterConfig] = useState({
    status: 'all', // all, pending, approved, rejected, featured
    dateRange: 'all', // all, today, week, month
    hasImage: 'all' // all, with-image, without-image
  });

  const hasLocalAdmin =
    typeof window !== 'undefined'
      ? !!localStorage.getItem('admin_email')
      : false;

  // Check admin permissions
  useEffect(() => {
    if (!loading && !hasLocalAdmin && (!user || !isAdmin(user))) {
      router.push('/admin');
      return;
    }
    
    if ((user && isAdmin(user)) || hasLocalAdmin) {
      fetchPosts();
    }
  }, [user, loading, router]);

  const isAdmin = (user) => {
    return user?.email === 'admin@sharkszone.com' || 
           user?.user_metadata?.role === 'admin' ||
           user?.app_metadata?.role === 'admin';
  };

  const fetchPosts = async () => {
    try {
      setIsLoading(true);
      
      const response = await fetch('/api/admin/posts');
      if (response.ok) {
        const data = await response.json();
        setPosts(data.posts || []);
        setFilteredPosts(data.posts || []);
      } else {
        toast.error('Failed to fetch posts');
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast.error('Failed to fetch posts');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter and search posts
  useEffect(() => {
    let filtered = [...posts];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(post => 
        post.content?.toLowerCase().includes(query) ||
        post.stock_symbol?.toLowerCase().includes(query) ||
        post.profile?.username?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (filterConfig.status !== 'all') {
      filtered = filtered.filter(post => {
        switch (filterConfig.status) {
          case 'pending':
            return post.status === 'pending';
          case 'approved':
            return post.status === 'approved';
          case 'rejected':
            return post.status === 'rejected';
          case 'featured':
            return post.is_featured === true;
          default:
            return true;
        }
      });
    }

    // Apply date range filter
    if (filterConfig.dateRange !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (filterConfig.dateRange) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          break;
      }
      
      filtered = filtered.filter(post => 
        new Date(post.created_at) >= filterDate
      );
    }

    // Apply image filter
    if (filterConfig.hasImage !== 'all') {
      filtered = filtered.filter(post => {
        const hasImage = post.image_url && post.image_url.trim() !== '';
        return filterConfig.hasImage === 'with-image' ? hasImage : !hasImage;
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';
      
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal?.toLowerCase() || '';
      }
      
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredPosts(filtered);
  }, [posts, searchQuery, filterConfig, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handlePostAction = async (action, postIds) => {
    try {
      const response = await fetch('/api/admin/posts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          post_ids: Array.isArray(postIds) ? postIds : [postIds]
        })
      });

      if (response.ok) {
        toast.success(`Posts ${action}d successfully`);
        fetchPosts();
        setSelectedPosts(new Set());
      } else {
        toast.error(`Failed to ${action} posts`);
      }
    } catch (error) {
      console.error(`Error ${action}ing posts:`, error);
      toast.error(`Failed to ${action} posts`);
    }
  };

  const handleBulkAction = (action) => {
    if (selectedPosts.size === 0) {
      toast.error('No posts selected');
      return;
    }

    const actionText = action === 'delete' ? 'delete permanently' : action;
    
    toast.warning(
      `${actionText.charAt(0).toUpperCase() + actionText.slice(1)} ${selectedPosts.size} post(s)?`,
      {
        action: {
          label: 'Confirm',
          onClick: () => handlePostAction(action, Array.from(selectedPosts))
        },
        cancel: {
          label: 'Cancel',
          onClick: () => {}
        },
        duration: 10000
      }
    );
  };

  const togglePostSelection = (postId) => {
    const newSelected = new Set(selectedPosts);
    if (newSelected.has(postId)) {
      newSelected.delete(postId);
    } else {
      newSelected.add(postId);
    }
    setSelectedPosts(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedPosts.size === filteredPosts.length) {
      setSelectedPosts(new Set());
    } else {
      setSelectedPosts(new Set(filteredPosts.map(p => p.id)));
    }
  };

  if (loading || isLoading) {
    return (
      <AdminLayout>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading posts...</p>
        </div>
      </AdminLayout>
    );
  }

  if ((!user || !isAdmin(user)) && !hasLocalAdmin) {
    return (
      <div className={styles.unauthorized}>
        <h1>🚫 Unauthorized Access</h1>
        <p>You don't have permission to access post moderation.</p>
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className={styles.postModeration}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h1 className={styles.title}>📝 Post Moderation</h1>
            <p className={styles.subtitle}>
              Total: {posts.length} | Filtered: {filteredPosts.length} | Selected: {selectedPosts.size}
            </p>
          </div>
          <div className={styles.headerActions}>
            <button onClick={fetchPosts} className={styles.refreshBtn}>
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className={styles.filtersRow}>
          <div className={styles.searchBox}>
            <input
              type="text"
              placeholder="🔍 Search posts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          
          <div className={styles.filterControls}>
            <select
              value={filterConfig.status}
              onChange={(e) => setFilterConfig(prev => ({ ...prev, status: e.target.value }))}
              className={styles.filterSelect}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="featured">Featured</option>
            </select>
            
            <select
              value={filterConfig.dateRange}
              onChange={(e) => setFilterConfig(prev => ({ ...prev, dateRange: e.target.value }))}
              className={styles.filterSelect}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
            
            <select
              value={filterConfig.hasImage}
              onChange={(e) => setFilterConfig(prev => ({ ...prev, hasImage: e.target.value }))}
              className={styles.filterSelect}
            >
              <option value="all">All Posts</option>
              <option value="with-image">With Image</option>
              <option value="without-image">Without Image</option>
            </select>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedPosts.size > 0 && (
          <div className={styles.bulkActions}>
            <span className={styles.bulkText}>
              {selectedPosts.size} post(s) selected
            </span>
            <div className={styles.bulkButtons}>
              <button 
                onClick={() => handleBulkAction('approve')}
                className={styles.approveBtn}
              >
                ✅ Approve
              </button>
              <button 
                onClick={() => handleBulkAction('reject')}
                className={styles.rejectBtn}
              >
                ❌ Reject
              </button>
              <button 
                onClick={() => handleBulkAction('feature')}
                className={styles.featureBtn}
              >
                ⭐ Feature
              </button>
              <button 
                onClick={() => handleBulkAction('delete')}
                className={styles.deleteBtn}
              >
                🗑️ Delete
              </button>
            </div>
          </div>
        )}

        {/* Posts Grid */}
        <div className={styles.postsGrid}>
          {filteredPosts.map((post) => (
            <div 
              key={post.id} 
              className={`${styles.postCard} ${selectedPosts.has(post.id) ? styles.selected : ''}`}
            >
              <div className={styles.postHeader}>
                <input
                  type="checkbox"
                  checked={selectedPosts.has(post.id)}
                  onChange={() => togglePostSelection(post.id)}
                  className={styles.checkbox}
                />
                <div className={styles.postMeta}>
                  <img 
                    src={post.profile?.avatar_url || '/default-avatar.png'} 
                    alt={post.profile?.username}
                    className={styles.avatar}
                  />
                  <div>
                    <p className={styles.username}>{post.profile?.username || 'Unknown'}</p>
                    <p className={styles.timestamp}>
                      {new Date(post.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className={styles.postStatus}>
                  {post.status === 'pending' && <span className={styles.pendingBadge}>⏳ Pending</span>}
                  {post.status === 'approved' && <span className={styles.approvedBadge}>✅ Approved</span>}
                  {post.status === 'rejected' && <span className={styles.rejectedBadge}>❌ Rejected</span>}
                  {post.is_featured && <span className={styles.featuredBadge}>⭐ Featured</span>}
                </div>
              </div>

              {post.image_url && (
                <div className={styles.postImage}>
                  <img src={post.image_url} alt="Post" />
                </div>
              )}

              <div className={styles.postContent}>
                <p>{post.content}</p>
                {post.stock_symbol && (
                  <div className={styles.stockInfo}>
                    <span className={styles.stockSymbol}>{post.stock_symbol}</span>
                    {post.target_price && <span>Target: ${post.target_price}</span>}
                    {post.stop_loss && <span>Stop: ${post.stop_loss}</span>}
                  </div>
                )}
              </div>

              <div className={styles.postStats}>
                <span>👍 {post.likes_count || 0}</span>
                <span>💬 {post.comments_count || 0}</span>
                <span>👁️ {post.views_count || 0}</span>
              </div>

              <div className={styles.postActions}>
                <button 
                  onClick={() => handlePostAction('approve', post.id)}
                  className={styles.actionBtn}
                  title="Approve"
                >
                  ✅
                </button>
                <button 
                  onClick={() => handlePostAction('reject', post.id)}
                  className={styles.actionBtn}
                  title="Reject"
                >
                  ❌
                </button>
                <button 
                  onClick={() => handlePostAction('feature', post.id)}
                  className={styles.actionBtn}
                  title="Feature"
                >
                  ⭐
                </button>
                <button 
                  onClick={() => handlePostAction('delete', post.id)}
                  className={styles.actionBtn}
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredPosts.length === 0 && !isLoading && (
          <div className={styles.emptyState}>
            <p>📭 No posts found matching your criteria</p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
