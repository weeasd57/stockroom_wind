'use client';

import { useState, useEffect } from 'react';
import { useSupabase } from '@/providers/SimpleSupabaseProvider';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { toast } from 'sonner';
import styles from '@/styles/admin/users.module.css';

export default function UserManagement() {
  const { user, loading } = useSupabase();
  const router = useRouter();
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
      
      const response = await fetch('/api/admin/users');
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
            {filteredUsers.map((user) => (
              <tr 
                key={user.id} 
                className={selectedUsers.has(user.id) ? styles.selectedRow : ''}
              >
                <td>
                  <input
                    type="checkbox"
                    checked={selectedUsers.has(user.id)}
                    onChange={() => toggleUserSelection(user.id)}
                  />
                </td>
                <td className={styles.userCell}>
                  <div className={styles.userInfo}>
                    {user.avatar_url && (
                      <img 
                        src={user.avatar_url} 
                        alt={user.username}
                        className={styles.avatar}
                      />
                    )}
                    <span className={styles.username}>
                      {user.username || 'Unknown'}
                    </span>
                  </div>
                </td>
                <td className={styles.emailCell}>{user.email}</td>
                <td className={styles.numberCell}>{user.posts_count || 0}</td>
                <td>
                  <span className={`${styles.planBadge} ${styles[user.subscription_plan || 'free']}`}>
                    {user.subscription_plan || 'free'}
                  </span>
                </td>
                <td>
                  <span className={user.is_active !== false ? styles.activeStatus : styles.inactiveStatus}>
                    {user.is_active !== false ? '✅ Active' : '❌ Inactive'}
                  </span>
                </td>
                <td className={styles.dateCell}>
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className={styles.actionsCell}>
                  <div className={styles.actionButtons}>
                    <button 
                      onClick={() => handleUserAction('view', user.id)}
                      className={styles.viewBtn}
                      title="View Profile"
                    >
                      👁️
                    </button>
                    <button 
                      onClick={() => handleUserAction('edit', user.id)}
                      className={styles.editBtn}
                      title="Edit User"
                    >
                      ✏️
                    </button>
                    <button 
                      onClick={() => handleUserAction('ban', user.id)}
                      className={styles.banBtn}
                      title="Ban User"
                    >
                      🚫
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
      </div>
    </AdminLayout>
  );
}
