'use client';

import { useState, useEffect } from 'react';
import { useSupabase } from '@/providers/SimpleSupabaseProvider';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { toast } from 'sonner';
import styles from '@/styles/admin/users.module.css';
import { useDemoMode } from '@/providers/DemoModeProvider';

export default function UserManagement() {
  const { user, loading } = useSupabase();
  const router = useRouter();
  const { isDemoAdmin } = useDemoMode();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
  const [filterConfig, setFilterConfig] = useState({
    status: 'all', // all, active, inactive, banned
    plan: 'all', // all, free, pro, premium
    dateRange: 'all' // all, today, week, month
  });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, userId: null, userEmail: '' });

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
      fetchUsers();
    }
  }, [user, loading, router]);

  const isAdmin = (user) => {
    return user?.email === 'admin@sharkszone.com' || 
           user?.user_metadata?.role === 'admin' ||
           user?.app_metadata?.role === 'admin';
  };

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      if (isDemoAdmin) {
        const demoUsers = [
          {
            id: 'demo-1',
            username: 'demo_trader',
            email: 'trader@example.com',
            full_name: 'Demo Trader',
            posts_count: 42,
            subscription_plan: 'pro',
            is_active: true,
            is_banned: false,
            created_at: new Date().toISOString(),
            avatar_url: '/default-avatar.svg',
          },
          {
            id: 'demo-2',
            username: 'demo_investor',
            email: 'investor@example.com',
            full_name: 'Demo Investor',
            posts_count: 18,
            subscription_plan: 'free',
            is_active: true,
            is_banned: false,
            created_at: new Date().toISOString(),
            avatar_url: '/default-avatar.svg',
          },
          {
            id: 'demo-3',
            username: 'banned_user',
            email: 'banned@example.com',
            full_name: 'Banned Demo User',
            posts_count: 5,
            subscription_plan: 'free',
            is_active: false,
            is_banned: true,
            created_at: new Date().toISOString(),
            avatar_url: '/default-avatar.svg',
          },
        ];
        setUsers(demoUsers);
        setFilteredUsers(demoUsers);
        setIsLoading(false);
        return;
      }
      
      // Get admin email from localStorage or user
      const adminEmail = localStorage.getItem('admin_email') || user?.email || 'admin@ggg.com';
      const response = await fetch(`/api/admin/users?admin_email=${encodeURIComponent(adminEmail)}`);
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
        setFilteredUsers(data.users || []);
      } else {
        toast.error('Failed to fetch users');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter and search users
  useEffect(() => {
    let filtered = [...users];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(user => 
        user.username?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        user.full_name?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (filterConfig.status !== 'all') {
      filtered = filtered.filter(user => {
        switch (filterConfig.status) {
          case 'active':
            return user.is_active !== false;
          case 'inactive':
            return user.is_active === false;
          case 'banned':
            return user.is_banned === true;
          default:
            return true;
        }
      });
    }

    // Apply plan filter
    if (filterConfig.plan !== 'all') {
      filtered = filtered.filter(user => {
        const userPlan = user.subscription_plan || 'free';
        return userPlan === filterConfig.plan;
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
      
      filtered = filtered.filter(user => 
        new Date(user.created_at) >= filterDate
      );
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

    setFilteredUsers(filtered);
  }, [users, searchQuery, filterConfig, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleUserAction = async (action, userIds) => {
    if (isDemoAdmin) {
      toast.info('Demo admin mode is read-only. No changes will be saved.');
      return;
    }
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          user_ids: Array.isArray(userIds) ? userIds : [userIds]
        })
      });

      if (response.ok) {
        toast.success(`Users ${action}d successfully`);
        fetchUsers();
        setSelectedUsers(new Set());
      } else {
        toast.error(`Failed to ${action} users`);
      }
    } catch (error) {
      console.error(`Error ${action}ing users:`, error);
      toast.error(`Failed to ${action} users`);
    }
  };

  const handleBulkAction = (action) => {
    if (isDemoAdmin) {
      toast.info('Demo admin mode is read-only. No changes will be saved.');
      return;
    }
    if (selectedUsers.size === 0) {
      toast.error('No users selected');
      return;
    }

    const actionText = action === 'delete' ? 'delete permanently' : action;
    
    toast.warning(
      `${actionText.charAt(0).toUpperCase() + actionText.slice(1)} ${selectedUsers.size} user(s)?`,
      {
        action: {
          label: 'Confirm',
          onClick: () => handleUserAction(action, Array.from(selectedUsers))
        },
        cancel: {
          label: 'Cancel',
          onClick: () => {}
        },
        duration: 10000
      }
    );
  };

  const toggleUserSelection = (userId) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
    }
  };

  // Delete user and all their data
  const openDeleteUserModal = (userId, userEmail) => {
    if (isDemoAdmin) {
      toast.info('Demo admin mode is read-only. No changes will be saved.');
      return;
    }
    setDeleteModal({ isOpen: true, userId, userEmail });
  };

  const confirmDeleteUser = async () => {
    if (isDemoAdmin) {
      toast.info('Demo admin mode is read-only. No changes will be saved.');
      return;
    }

    if (!deleteModal.userId) return;

    try {
      const adminEmail = localStorage.getItem('admin_email') || user?.email;
      const response = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: deleteModal.userId,
          admin_email: adminEmail,
          delete_all_data: true
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(`User ${deleteModal.userEmail} and all data deleted successfully`);
        setUsers(prev => prev.filter(u => u.id !== deleteModal.userId));
        setFilteredUsers(prev => prev.filter(u => u.id !== deleteModal.userId));
      } else {
        toast.error(data.error || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    } finally {
      setDeleteModal({ isOpen: false, userId: null, userEmail: '' });
    }
  };

  const cancelDeleteUser = () => {
    setDeleteModal({ isOpen: false, userId: null, userEmail: '' });
  };

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && deleteModal.isOpen) {
        cancelDeleteUser();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [deleteModal.isOpen]);

  if (loading || isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading users...</p>
      </div>
    );
  }

  if ((!user || !isAdmin(user)) && !hasLocalAdmin) {
    return (
      <div className={styles.unauthorized}>
        <h1>🚫 Unauthorized Access</h1>
        <p>You don't have permission to access user management.</p>
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className={styles.userManagement}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>👥 User Management</h1>
          <p className={styles.subtitle}>
            Total: {users.length} | Filtered: {filteredUsers.length} | Selected: {selectedUsers.size}
          </p>
        </div>
        <div className={styles.headerActions}>
          <button onClick={fetchUsers} className={styles.refreshBtn}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filtersRow}>
        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder="🔍 Search users..."
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
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="banned">Banned</option>
          </select>
          
          <select
            value={filterConfig.plan}
            onChange={(e) => setFilterConfig(prev => ({ ...prev, plan: e.target.value }))}
            className={styles.filterSelect}
          >
            <option value="all">All Plans</option>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="premium">Premium</option>
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
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedUsers.size > 0 && (
        <div className={styles.bulkActions}>
          <span className={styles.bulkText}>
            {selectedUsers.size} user(s) selected
          </span>
          <div className={styles.bulkButtons}>
            <button 
              onClick={() => handleBulkAction('activate')}
              className={styles.activateBtn}
            >
              ✅ Activate
            </button>
            <button 
              onClick={() => handleBulkAction('deactivate')}
              className={styles.deactivateBtn}
            >
              ❌ Deactivate
            </button>
            <button 
              onClick={() => handleBulkAction('ban')}
              className={styles.banBtn}
            >
              🚫 Ban
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

      {/* Users Table */}
      <div className={styles.tableContainer}>
        <table className={styles.usersTable}>
          <thead>
            <tr>
              <th className={styles.checkboxHeader}>
                <input
                  type="checkbox"
                  checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                  onChange={toggleSelectAll}
                />
              </th>
              <th onClick={() => handleSort('username')} className={styles.sortableHeader}>
                Username {sortConfig.key === 'username' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('email')} className={styles.sortableHeader}>
                Email {sortConfig.key === 'email' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('posts_count')} className={styles.sortableHeader}>
                Posts {sortConfig.key === 'posts_count' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('subscription_plan')} className={styles.sortableHeader}>
                Plan {sortConfig.key === 'subscription_plan' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('is_active')} className={styles.sortableHeader}>
                Status {sortConfig.key === 'is_active' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('created_at')} className={styles.sortableHeader}>
                Joined {sortConfig.key === 'created_at' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((userData) => (
              <tr 
                key={userData.id} 
                className={selectedUsers.has(userData.id) ? styles.selectedRow : ''}
              >
                <td data-label="">
                  <input
                    type="checkbox"
                    checked={selectedUsers.has(userData.id)}
                    onChange={() => toggleUserSelection(userData.id)}
                  />
                </td>
                <td data-label="Username" className={styles.userCell}>
                  <div className={styles.userInfo}>
                    {userData.avatar_url && (
                      <img 
                        src={userData.avatar_url} 
                        alt={userData.username}
                        className={styles.avatar}
                      />
                    )}
                    <span className={styles.username}>
                      {userData.username || 'Unknown'}
                    </span>
                  </div>
                </td>
                <td data-label="Email" className={styles.emailCell}>{userData.email}</td>
                <td data-label="Posts" className={styles.numberCell}>{userData.posts_count || 0}</td>
                <td data-label="Plan">
                  <span className={`${styles.planBadge} ${styles[userData.subscription_plan || 'free']}`}>
                    {userData.subscription_plan || 'free'}
                  </span>
                </td>
                <td data-label="Status">
                  <span className={userData.is_active !== false ? styles.activeStatus : styles.inactiveStatus}>
                    {userData.is_active !== false ? '✅ Active' : '❌ Inactive'}
                  </span>
                </td>
                <td data-label="Joined" className={styles.dateCell}>
                  {new Date(userData.created_at).toLocaleDateString()}
                </td>
                <td data-label="" className={styles.actionsCell}>
                  <div className={styles.actionButtons}>
                    <button 
                      onClick={() => window.open(`/view-profile/${userData.id}`, '_blank')}
                      className={styles.viewBtn}
                      title="View Profile"
                    >
                      👁️ View
                    </button>
                    <button 
                      onClick={() => openDeleteUserModal(userData.id, userData.email)}
                      className={styles.deleteBtn}
                      title="Delete User & All Data"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredUsers.length === 0 && !isLoading && (
        <div className={styles.emptyState}>
          <p>📭 No users found matching your criteria</p>
        </div>
      )}
      {deleteModal.isOpen && (
        <div className={styles.modalOverlay} onClick={cancelDeleteUser}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 9V13M12 17H12.01M5.07183 19H18.9282C20.4678 19 21.4301 17.3333 20.6603 16L13.7321 4C12.9623 2.66667 11.0377 2.66667 10.2679 4L3.33975 16C2.56995 17.3333 3.53223 19 5.07183 19Z" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className={styles.modalTitle}>Delete User</h3>
            <p className={styles.modalDescription}>
              Are you sure you want to permanently delete this user and all related data?
            </p>
            <div className={styles.modalPostPreview}>
              <strong>{deleteModal.userEmail}</strong>
              <br />
              <br />
              This will permanently delete:
              <br />• User account
              <br />• All posts
              <br />• All comments
              <br />• Profile data
              <br />• Subscription info
            </div>
            <p className={styles.modalWarning}>
              ⚠️ This action cannot be undone.
            </p>
            <div className={styles.modalActions}>
              <button 
                onClick={cancelDeleteUser} 
                className={styles.modalCancelBtn}
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeleteUser} 
                className={styles.modalDeleteBtn}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19 7L18.1327 19.1425C18.0579 20.1891 17.187 21 16.1378 21H7.86224C6.81296 21 5.94208 20.1891 5.86732 19.1425L5 7M10 11V17M14 11V17M15 7V4C15 3.44772 14.5523 3 14 3H10C9.44772 3 9 3.44772 9 4V7M4 7H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </AdminLayout>
  );
}
