'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import styles from '@/styles/admin.module.css';

export default function AdminPage() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  
  // User management state
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' or 'desc'
  
  // Fetch all users
  const fetchUsers = useCallback(async (email) => {
    setUsersLoading(true);
    try {
      const res = await fetch(`/api/admin/users?admin_email=${encodeURIComponent(email)}`);
      const data = await res.json();
      
      if (data.success) {
        setUsers(data.users || []);
      } else {
        toast.error(data.error || 'Failed to fetch users');
      }
    } catch (error) {
      console.error('Fetch users error:', error);
      toast.error('Failed to fetch users');
    } finally {
      setUsersLoading(false);
    }
  }, []);
  
  // Verify admin session
  const verifySession = useCallback(async (email) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    try {
      const res = await fetch(`/api/admin/auth?email=${encodeURIComponent(email)}`, { signal: controller.signal });
      const data = await res.json();
      
      if (data.success) {
        setIsAuthenticated(true);
        fetchUsers(email);
      } else {
        localStorage.removeItem('admin_email');
        setAdminEmail('');
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Session verification failed:', error);
      localStorage.removeItem('admin_email');
      setIsAuthenticated(false);
    } finally {
      clearTimeout(timeoutId);
      setSessionChecked(true);
    }
  }, [fetchUsers]);
  
  // Check for existing session in localStorage (only once)
  useEffect(() => {
    if (!sessionChecked) {
      const storedAdminEmail = localStorage.getItem('admin_email');
      if (storedAdminEmail) {
        setAdminEmail(storedAdminEmail);
        verifySession(storedAdminEmail);
      } else {
        setSessionChecked(true);
      }
    }
  }, [sessionChecked, verifySession]);
  
  // Prevent blocking UI: allow login to render while session is checked
  if (!sessionChecked) {}
  
  // Handle admin login
  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!adminEmail.trim() || !password.trim()) {
      toast.error('Please enter email and password');
      return;
    }
    
    setAuthLoading(true);
    
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail.trim(), password })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setIsAuthenticated(true);
        localStorage.setItem('admin_email', adminEmail.trim());
        setPassword('');
        toast.success('Admin login successful');
        fetchUsers(adminEmail.trim());
      } else {
        toast.error(data.error || 'Invalid credentials');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Login failed');
    } finally {
      setAuthLoading(false);
    }
  };
  
  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('admin_email');
    setIsAuthenticated(false);
    setAdminEmail('');
    setPassword('');
    setUsers([]);
    setSelectedUsers(new Set());
    toast.info('Logged out successfully');
  };
  
  // Toggle user selection
  const toggleUserSelection = (userId) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };
  
  // Select all users
  const toggleSelectAll = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map(u => u.user_id)));
    }
  };
  
  // Delete selected users
  const handleDeleteUsers = async () => {
    if (selectedUsers.size === 0) {
      toast.error('No users selected');
      return;
    }
    
    // Modern confirmation with toast
    toast.warning(
      `⚠️ Delete ${selectedUsers.size} user(s)? This CANNOT be undone!`,
      {
        action: {
          label: '🗑️ Delete',
          onClick: async () => {
            setDeleteLoading(true);
            
            const deletePromise = fetch('/api/admin/users', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                admin_email: adminEmail,
                user_ids: Array.from(selectedUsers)
              })
            }).then(res => res.json());
            
            toast.promise(deletePromise, {
              loading: `Deleting ${selectedUsers.size} user(s)...`,
              success: (data) => {
                setDeleteLoading(false);
                if (data.success) {
                  setSelectedUsers(new Set());
                  fetchUsers(adminEmail);
                  return `✅ Deleted ${data.successful_deletions} user(s)` +
                    (data.failed_deletions > 0 ? ` (${data.failed_deletions} failed)` : '');
                } else {
                  throw new Error(data.error || 'Failed to delete users');
                }
              },
              error: (err) => {
                setDeleteLoading(false);
                return `❌ ${err.message || 'Failed to delete users'}`;
              }
            });
          }
        },
        cancel: {
          label: 'Cancel',
          onClick: () => {}
        },
        duration: 10000
      }
    );
  };
  
  // Handle column sorting
  const handleSort = (column) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
  };
  
  // Filter and sort users
  const filteredUsers = users
    .filter(user => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        user.username?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        user.user_id?.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      let aVal = a[sortColumn];
      let bVal = b[sortColumn];
      
      // Handle null/undefined values
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';
      
      // Handle different data types
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal?.toLowerCase() || '';
      }
      
      // Compare
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  
  // Login screen
  if (!isAuthenticated) {
    return (
      <div className={styles.loginContainer}>
        <div className={styles.loginCard}>
          <div className={styles.loginHeader}>
            <h1 className={styles.loginTitle}>🔐 Admin Login</h1>
            <p className={styles.loginSubtitle}>Enter your credentials to access the admin panel</p>
          </div>
          
          <form onSubmit={handleLogin} className={styles.loginForm}>
            <div className={styles.formGroup}>
              <label htmlFor="email" className={styles.formLabel}>
                📧 Admin Email
              </label>
              <input
                id="email"
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@example.com"
                className={styles.formInput}
                required
                disabled={authLoading}
              />
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="password" className={styles.formLabel}>
                🔑 Password
              </label>
              <div className={styles.passwordInputWrapper}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className={styles.formInput}
                  required
                  disabled={authLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={styles.passwordToggle}
                  disabled={authLoading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            
            <button
              type="submit"
              className={styles.loginButton}
              disabled={authLoading}
            >
              {authLoading ? '⏳ Logging in...' : '🚀 Login'}
            </button>
          </form>
        </div>
      </div>
    );
  }
  
  // Admin dashboard
  return (
    <div className={styles.adminContainer}>
      <div className={styles.adminHeader}>
        <div>
          <h1 className={styles.adminTitle}>🛠️ Admin Dashboard</h1>
          <p className={styles.adminSubtitle}>
            Logged in as: <strong>{adminEmail}</strong>
          </p>
        </div>
        <button onClick={handleLogout} className={styles.logoutButton}>
          🚪 Logout
        </button>
      </div>
      
      <section className={styles.adminSection}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>👥 User Management</h2>
            <p className={styles.sectionDescription}>
              Total Users: <strong>{users.length}</strong> | Selected: <strong>{selectedUsers.size}</strong>
            </p>
          </div>
          
          <div className={styles.actionButtons}>
            <button
              onClick={() => fetchUsers(adminEmail)}
              className={styles.refreshButton}
              disabled={usersLoading}
            >
              {usersLoading ? '⏳' : '🔄'} Refresh
            </button>
            
            {selectedUsers.size > 0 && (
              <button
                onClick={handleDeleteUsers}
                className={styles.deleteButton}
                disabled={deleteLoading}
              >
                {deleteLoading ? '⏳ Deleting...' : `🗑️ Delete ${selectedUsers.size} User(s)`}
              </button>
            )}
          </div>
        </div>
        
        <div className={styles.searchBar}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 Search by username, email, or user ID..."
            className={styles.searchInput}
          />
        </div>
        
        {usersLoading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}></div>
            <p>Loading users...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className={styles.emptyState}>
            <p>📭 No users found</p>
          </div>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.usersTable}>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                      onChange={toggleSelectAll}
                      className={styles.checkbox}
                    />
                  </th>
                  <th onClick={() => handleSort('username')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Username {sortColumn === 'username' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('email')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Email {sortColumn === 'email' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('posts_count')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Posts {sortColumn === 'posts_count' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('comments_count')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Comments {sortColumn === 'comments_count' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('followers_count')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Followers {sortColumn === 'followers_count' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('following_count')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Following {sortColumn === 'following_count' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('subscription_plan')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Plan {sortColumn === 'subscription_plan' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('is_active')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Status {sortColumn === 'is_active' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('created_at')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Joined {sortColumn === 'created_at' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr
                    key={user.user_id}
                    className={selectedUsers.has(user.user_id) ? styles.selectedRow : ''}
                    onClick={() => toggleUserSelection(user.user_id)}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedUsers.has(user.user_id)}
                        onChange={() => toggleUserSelection(user.user_id)}
                        className={styles.checkbox}
                      />
                    </td>
                    <td>
                      <div className={styles.userCell}>
                        {user.avatar_url && (
                          <img
                            src={user.avatar_url}
                            alt={user.username}
                            className={styles.userAvatar}
                          />
                        )}
                        <span className={styles.username}>{user.username || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className={styles.emailCell}>{user.email || 'N/A'}</td>
                    <td className={styles.numberCell}>{user.posts_count || 0}</td>
                    <td className={styles.numberCell}>{user.comments_count || 0}</td>
                    <td className={styles.numberCell}>{user.followers_count || 0}</td>
                    <td className={styles.numberCell}>{user.following_count || 0}</td>
                    <td>
                      <span className={styles.planBadge}>
                        {user.subscription_plan || 'free'}
                      </span>
                    </td>
                    <td>
                      <span className={user.is_active ? styles.activeStatus : styles.inactiveStatus}>
                        {user.is_active ? '✅ Active' : '❌ Inactive'}
                      </span>
                    </td>
                    <td className={styles.dateCell}>
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}