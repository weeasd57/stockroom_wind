'use client';

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { useSubscription } from '@/providers/SubscriptionProvider';
import { useSupabase } from '@/providers/SimpleSupabaseProvider';
import { useBrokerSubscription } from '@/providers/BrokerSubscriptionProvider';

// Simple spreadsheet-like table for posts with resizable columns and row heights
// No external deps; designed for profile feed usage
export default function PostsTableView({ posts = [], hidePublisher = false }) {
  const router = useRouter();
  const { isPro } = useSubscription();
  const { user } = useSupabase();
  const { isSubscribedToBroker } = useBrokerSubscription();
  const containerRef = useRef(null);
  const toolbarRef = useRef(null);
  const theadRef = useRef(null);
  const isDraggingColRef = useRef(null); // { colId, startX, startWidth }
  const isDraggingRowRef = useRef(null); // { rowId, startY, startHeight }
  const isSelectingRef = useRef(false);
  const [selection, setSelection] = useState(null); // { start: {r,c}, end: {r,c} }

  // Define columns to show (keep it comprehensive but readable)
  const HEADER_STICKY_TOP = 42; // must match styles.th.top
  const baseColumns = useMemo(() => ([
    // Freeze Publisher as first column instead of Created (can be hidden via prop)
    { id: 'publisher', label: 'Publisher', width: 200, accessor: (p) => (p?.profile?.username || '-') },
    { id: 'created_at', label: 'Created', width: 140, accessor: (p) => formatDate(p.created_at) },
    { id: 'symbol', label: 'Symbol', width: 110, accessor: (p) => p.symbol || '-' },
    { id: 'company_name', label: 'Company', width: 220, accessor: (p) => p.company_name || '-' },
    { id: 'country', label: 'Country', width: 90, accessor: (p) => (p.country || '').toUpperCase() || '-' },
    { id: 'exchange', label: 'Exchange', width: 110, accessor: (p) => p.exchange || '-' },
    { id: 'strategy', label: 'Strategy', width: 160, accessor: (p) => p.strategy || '-' },
    { id: 'sentiment', label: 'Sentiment', width: 110, accessor: (p) => p.sentiment || '-' },
    { id: 'initial_price', label: 'Initial', width: 110, accessor: (p) => fmtNum(p.initial_price) },
    { id: 'current_price', label: 'Current', width: 110, accessor: (p) => fmtNum(p.current_price) },
    { id: 'target_price', label: 'Target', width: 110, accessor: (p) => fmtNum(p.target_price) },
    { id: 'stop_loss_price', label: 'Stop Loss', width: 120, accessor: (p) => fmtNum(p.stop_loss_price) },
    { id: 'high_price', label: 'High', width: 110, accessor: (p) => fmtNum(p.high_price) },
    { id: 'target_high_price', label: 'Target High', width: 120, accessor: (p) => fmtNum(p.target_high_price) },
    { id: 'status', label: 'Status', width: 120, accessor: (p) => p.status || deriveStatus(p) },
    { id: 'target_reached', label: 'Target Hit', width: 110, accessor: (p) => yesNo(p.target_reached) },
    { id: 'stop_loss_triggered', label: 'Stopped', width: 110, accessor: (p) => yesNo(p.stop_loss_triggered) },
    { id: 'closed', label: 'Closed', width: 90, accessor: (p) => yesNo(p.closed) },
    { id: 'comment_count', label: 'Comments', width: 110, accessor: (p) => p.comment_count ?? 0 },
    { id: 'buy_count', label: 'Buys', width: 90, accessor: (p) => p.buy_count ?? 0 },
    { id: 'sell_count', label: 'Sells', width: 90, accessor: (p) => p.sell_count ?? 0 },
    { id: 'description', label: 'Description', width: 260, accessor: (p) => p.description || '' },
    { id: 'image_url', label: 'Image URL', width: 280, accessor: (p) => p.image_url || '' },
    // Action column to open post details
    { id: 'open', label: 'Open', width: 80, accessor: (p) => p.id },
  ]), []);
  const columns = useMemo(() => (
    hidePublisher ? baseColumns.filter(c => c.id !== 'publisher') : baseColumns
  ), [hidePublisher, baseColumns]);

  // Column visibility (first column always visible)
  const [visibleCols, setVisibleCols] = useState(() => {
    const init = {};
    columns.forEach(c => { init[c.id] = true; });
    return init;
  });
  const [colsOpen, setColsOpen] = useState(false);
  const [showColsDialog, setShowColsDialog] = useState(false);

  // Sorting and filtering
  const [sortBy, setSortBy] = useState(null); // column id
  const [sortDir, setSortDir] = useState('asc'); // 'asc' | 'desc'
  const [globalFilter, setGlobalFilter] = useState('');

  // Column widths state
  const [colWidths, setColWidths] = useState(() => {
    const w = {};
    columns.forEach(c => { w[c.id] = c.width; });
    return w;
  });

  // Row heights state (default auto -> use minHeight)
  const [rowHeights, setRowHeights] = useState({}); // { postId: px }
  const [firstRowOffset, setFirstRowOffset] = useState(0);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDraggingColRef.current) {
        const { colId, startX, startWidth } = isDraggingColRef.current;
        const delta = e.clientX - startX;
        const next = Math.max(60, startWidth + delta);
        setColWidths(prev => ({ ...prev, [colId]: next }));
      } else if (isDraggingRowRef.current) {
        const { rowId, startY, startHeight } = isDraggingRowRef.current;
        const deltaY = e.clientY - startY;
        const nextH = Math.max(28, startHeight + deltaY);
        setRowHeights(prev => ({ ...prev, [rowId]: nextH }));
      }
    };
    const handleMouseUp = () => {
      isDraggingColRef.current = null;
      isDraggingRowRef.current = null;
      isSelectingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Lock body scroll when dialog is open
  useEffect(() => {
    if (!showColsDialog) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [showColsDialog]);

  // Calculate sticky offset for the first data row (header height + header sticky top)
  useEffect(() => {
    const calc = () => {
      try {
        const th = theadRef.current ? theadRef.current.offsetHeight : 0;
        setFirstRowOffset((th || 0) + HEADER_STICKY_TOP);
      } catch {}
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);

  useEffect(() => {
    // Re-measure when visible columns change
    const id = setTimeout(() => {
      try {
        const th = theadRef.current ? theadRef.current.offsetHeight : 0;
        setFirstRowOffset((th || 0) + HEADER_STICKY_TOP);
      } catch {}
    }, 0);
    return () => clearTimeout(id);
  }, [visibleCols]);

  const startColResize = (e, colId) => {
    e.preventDefault();
    e.stopPropagation();
    const th = e.currentTarget.parentElement;
    const startWidth = th ? th.offsetWidth : (colWidths[colId] || 120);
    isDraggingColRef.current = { colId, startX: e.clientX, startWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const startRowResize = (e, rowId) => {
    e.preventDefault();
    e.stopPropagation();
    const tr = e.currentTarget.closest('tr');
    const startHeight = tr ? tr.offsetHeight : (rowHeights[rowId] || 32);
    isDraggingRowRef.current = { rowId, startY: e.clientY, startHeight };
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  };

  // Visible columns (first column always visible)
  const displayColumns = useMemo(() => {
    const firstId = columns[0]?.id;
    const map = { ...visibleCols, [firstId]: true };
    return columns.filter(c => map[c.id] !== false);
  }, [columns, visibleCols]);

  // Check if user has access to premium post
  const hasAccessToPremium = (post) => {
    const isPremiumPost = post?.is_premium_only === true || post?.isPremiumOnly === true;
    if (!isPremiumPost) return true;
    const isOwner = !!user?.id && (post?.user_id === user.id || post?.profile?.id === user.id);
    const hasSubscription = isSubscribedToBroker(post?.user_id);
    return isOwner || isPro || hasSubscription;
  };

  // Show all posts (don't filter premium), but block content for non-accessible ones
  const accessiblePosts = posts;

  // Check if table view should be blocked (table is a premium feature for broker profiles)
  const shouldBlockTableView = useMemo(() => {
    // Derive brokerId from posts list (profile feed posts should share same owner)
    const sample = posts && posts.find(p => p?.user_id || p?.profile?.id);
    const brokerId = sample?.user_id || sample?.profile?.id;

    // BLOCK if user is not logged in
    if (!user?.id) return true;

    // If brokerId is unknown (no posts yet), allow access to avoid false blocks
    if (!brokerId) return false;

    // Check if user has access (Owner, Pro, or subscribed to this broker)
    const isOwner = user.id === brokerId;
    const hasSubscription = isSubscribedToBroker(brokerId);
    const hasAccess = isOwner || isPro || hasSubscription;

    if (process.env.NODE_ENV === 'development') {
      console.log('[PostsTableView] Premium table access check:', {
        brokerId,
        userId: user.id,
        isOwner,
        isPro,
        hasSubscription,
        hasAccess,
        shouldBlock: !hasAccess
      });
    }

    return !hasAccess;
  }, [posts, user?.id, isPro, isSubscribedToBroker]);

  // Global filter
  const filteredPosts = useMemo(() => {
    if (!globalFilter) return accessiblePosts;
    const needle = String(globalFilter).toLowerCase();
    return accessiblePosts.filter(p => {
      const rowStr = displayColumns.map(col => safeStr(col.accessor(p))).join(' | ').toLowerCase();
      return rowStr.includes(needle);
    });
  }, [accessiblePosts, globalFilter, displayColumns]);

  // Sorting
  const sortedPosts = useMemo(() => {
    if (!sortBy) return filteredPosts;
    const col = displayColumns.find(c => c.id === sortBy) || columns.find(c => c.id === sortBy);
    if (!col) return filteredPosts;
    const arr = [...filteredPosts];
    arr.sort((a, b) => {
      const va = rawVal(col, a);
      const vb = rawVal(col, b);
      const na = toNumberOrString(va);
      const nb = toNumberOrString(vb);
      let cmp = 0;
      if (typeof na === 'number' && typeof nb === 'number') cmp = na - nb; else cmp = String(na).localeCompare(String(nb));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filteredPosts, sortBy, sortDir, displayColumns, columns]);

  const toggleSort = (colId) => {
    setSortBy(prev => {
      if (prev !== colId) { setSortDir('asc'); return colId; }
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
      return colId;
    });
  };

  // Excel-like selection
  const startSelection = (ri, ci) => {
    isSelectingRef.current = true;
    document.body.style.userSelect = 'none';
    setSelection({ start: { r: ri, c: ci }, end: { r: ri, c: ci } });
  };
  const extendSelection = (ri, ci) => {
    if (!isSelectingRef.current) return;
    setSelection(sel => sel ? { ...sel, end: { r: ri, c: ci } } : sel);
  };
  const isCellSelected = (ri, ci) => {
    if (!selection) return false;
    const r1 = Math.min(selection.start.r, selection.end.r);
    const r2 = Math.max(selection.start.r, selection.end.r);
    const c1 = Math.min(selection.start.c, selection.end.c);
    const c2 = Math.max(selection.start.c, selection.end.c);
    return ri >= r1 && ri <= r2 && ci >= c1 && ci <= c2;
  };

  // Block entire table for non-premium viewers
  if (shouldBlockTableView) {
    return (
      <div style={styles.blockedTableContainer}>
        <div style={styles.blockedTableContent}>
          <div style={styles.lockIcon}>🔒</div>
          <h3 style={styles.blockedTitle}>Premium Table View</h3>
          <p style={styles.blockedDescription}>
            {!user?.id
              ? 'Please sign in to access this broker\'s table view.'
              : 'Subscribe to this broker\'s premium plan or upgrade to Pro to view the table.'
            }
          </p>
          <div style={styles.blockedFeatures}>
            <div style={styles.featureItem}>✓ Full table access</div>
            <div style={styles.featureItem}>✓ Export to Excel (Copy)</div>
            <div style={styles.featureItem}>✓ Customize columns</div>
            <div style={styles.featureItem}>✓ Advanced filtering</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Fixed toolbar outside scroll container */}
      <div style={styles.toolbar} ref={toolbarRef}>
        <input
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="Filter..."
          style={styles.filterInput}
        />
        <div style={{ flex: 1 }} />
        {!shouldBlockTableView && (
          <>
            <button style={styles.toolButton} onClick={() => { try { copySelection(displayColumns, sortedPosts, selection); } catch {} }} title="Copy selection or all">
              Copy
            </button>
            <button style={styles.toolButton} onClick={() => setShowColsDialog(true)} title="Show/Hide columns">
              Columns
            </button>
          </>
        )}
        {shouldBlockTableView && (
          <div style={styles.premiumNotice}>
            {!user?.id 
              ? '🔒 Sign in to access export features'
              : '🔒 Subscribe to access export features'
            }
          </div>
        )}
      </div>
      {/* Scrollable table container */}
      <div
        ref={containerRef}
        style={styles.wrapper}
        tabIndex={0}
        onKeyDown={(e) => { if (shouldBlockTableView) return; if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') { e.preventDefault(); try { copySelection(displayColumns, sortedPosts, selection); } catch {} } }}
      >
        <table style={styles.table}>
        <thead ref={theadRef}>
          <tr>
            {displayColumns.map((col, idx) => (
              <th key={col.id} style={{ ...styles.th, width: colWidths[col.id], ...(idx === 0 ? styles.stickyFirstHeader : null) }}>
                <div style={styles.thContent} onClick={() => toggleSort(col.id)}>
                  <span>
                    {col.label}
                    {sortBy === col.id ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </span>
                  <div
                    style={styles.colResizer}
                    onMouseDown={(e) => startColResize(e, col.id)}
                    title="Drag to resize column"
                  />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedPosts.map((p, ri) => {
            const isPremium = p?.is_premium_only === true || p?.isPremiumOnly === true;
            const hasAccess = hasAccessToPremium(p);
            const showBlocked = isPremium && !hasAccess;
            
            return (
            <tr 
              key={p.id} 
              style={{ 
                ...styles.tr, 
                height: rowHeights[p.id] ? `${rowHeights[p.id]}px` : undefined,
                ...(showBlocked ? styles.blockedRow : null)
              }}
            >
              {displayColumns.map((col, ci) => (
                <td
                  key={col.id}
                  style={{
                    ...styles.td,
                    width: colWidths[col.id],
                    ...(ci === 0 ? styles.stickyFirstCell : null),
                    // Remove sticky first data row; keep only sticky header
                    ...(isCellSelected(ri, ci) ? styles.selectedCell : null),
                  }}
                  onMouseDown={() => startSelection(ri, ci)}
                  onMouseEnter={() => extendSelection(ri, ci)}
                >
                  {renderCell(col, p, router, hasAccessToPremium(p))}
                  {ci === 0 && (
                    <div
                      style={styles.rowResizer}
                      onMouseDown={(e) => startRowResize(e, p.id)}
                      title="Drag to resize row"
                    />
                  )}
                </td>
              ))}
            </tr>
            );
          })}
        </tbody>
        </table>
      </div>
      {showColsDialog && typeof window !== 'undefined' && createPortal((
        <div style={styles.dialogBackdrop} onClick={() => setShowColsDialog(false)}>
          <div style={styles.dialog} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div style={styles.dialogHeader}><strong>Columns</strong></div>
            <div style={styles.columnsList}>
              {columns.map((c, idx) => (
                <label key={c.id} style={styles.columnItem}>
                  <input
                    type="checkbox"
                    checked={visibleCols[c.id] !== false}
                    disabled={idx === 0}
                    onChange={(e) => setVisibleCols(prev => ({ ...prev, [c.id]: e.target.checked }))}
                  />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>
            <div style={styles.dialogActions}>
              <button style={styles.toolButton} onClick={() => setShowColsDialog(false)}>Close</button>
              <button style={styles.toolButton} onClick={() => { const reset = {}; columns.forEach(c => { reset[c.id] = true; }); setVisibleCols(reset); }}>Reset</button>
            </div>
          </div>
        </div>
      ), document.body)}
    </div>
  );
}

function renderCell(col, post, router, hasAccess = true) {
  // If no access to premium post, show blocked content (except publisher and open columns)
  if (!hasAccess && col.id !== 'publisher' && col.id !== 'open') {
    return (
      <span style={{
        ...styles.blockedCell,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        🔒 Premium
      </span>
    );
  }

  const val = col.accessor(post);
  if (col.id === 'open') {
    const id = post?.id;
    if (!id) return <span style={styles.muted}>-</span>;
    return (
      <a
        href={`/posts/${id}`}
        style={styles.link}
        title="Open post details"
        onClick={(e) => { e.preventDefault(); try { router.push(`/posts/${id}`); } catch {} }}
      >
        Open
      </a>
    );
  }
  if (col.id === 'publisher') {
    const username = post?.profile?.username;
    const isPremium = post?.is_premium_only === true || post?.isPremiumOnly === true;
    const content = (
      <>
        {isPremium && <span style={{ marginRight: '4px' }}>⭐</span>}
        {String(val)}
      </>
    );
    
    if (username) {
      return (
        <a
          href={`/view-profile/${username}`}
          style={styles.link}
          onClick={(e) => { e.preventDefault(); try { router.push(`/view-profile/${username}`); } catch {} }}
        >
          {content}
        </a>
      );
    }
    return <span>{content}</span>;
  }
  if (col.id.endsWith('_url') && typeof val === 'string' && val.startsWith('http')) {
    return (
      <a href={val} target="_blank" rel="noreferrer" style={styles.link}>
        {truncate(val, 48)}
      </a>
    );
  }
  if (typeof val === 'boolean') return yesNo(val);
  if (val === null || typeof val === 'undefined' || val === '') return <span style={styles.muted}>-</span>;
  return <span>{String(val)}</span>;
}

// Helpers
function yesNo(v) { return v ? 'Yes' : 'No'; }
function fmtNum(n) { if (n === null || typeof n === 'undefined') return '-'; const x = Number(n); return Number.isFinite(x) ? x.toFixed(2) : '-'; }
function formatDate(d) {
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return '-';
    return dt.toLocaleString();
  } catch { return '-'; }
}
function truncate(s, max) { return String(s || '').length > max ? String(s).slice(0, max - 1) + '…' : s; }
function deriveStatus(p) {
  if (p.target_reached) return 'success';
  if (p.stop_loss_triggered) return 'loss';
  if (p.closed) return 'closed';
  return p.status || 'open';
}

function safeStr(v) {
  if (v === null || typeof v === 'undefined') return '';
  return String(v);
}
function rawVal(col, post) {
  try { if (col.id in post) return post[col.id]; } catch {}
  try { return col.accessor(post); } catch { return ''; }
}
function toNumberOrString(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : (v ?? '');
}
async function copySelection(columns, rows, selection) {
  let ri1 = 0, ri2 = rows.length - 1, ci1 = 0, ci2 = columns.length - 1;
  if (selection) {
    ri1 = Math.min(selection.start.r, selection.end.r);
    ri2 = Math.max(selection.start.r, selection.end.r);
    ci1 = Math.min(selection.start.c, selection.end.c);
    ci2 = Math.max(selection.start.c, selection.end.c);
  }
  const header = columns.slice(ci1, ci2 + 1).map(c => c.label).join('\t');
  const lines = rows.slice(ri1, ri2 + 1).map(row =>
    columns.slice(ci1, ci2 + 1).map(c => {
      let v = rawVal(c, row);
      if (v == null) return '';
      if (v instanceof Date) v = v.toISOString();
      return String(v).replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
    }).join('\t')
  );
  const tsv = [header, ...lines].join('\n');
  try { await navigator.clipboard.writeText(tsv); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = tsv; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } finally { document.body.removeChild(ta); }
  }
}

// Inline styles (CSS variables friendly)
const styles = {
  container: {
    width: '100%',
    border: '1px solid hsl(var(--border))',
    borderRadius: 8,
    background: 'hsl(var(--background))',
    display: 'flex',
    flexDirection: 'column',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 10px',
    borderBottom: '1px solid hsl(var(--border))',
    background: 'hsl(var(--background))',
    zIndex: 4,
    flexShrink: 0,
  },
  wrapper: {
    width: '100%',
    overflow: 'auto',
    background: 'hsl(var(--background))',
    flex: 1,
  },
  filterInput: {
    width: 240,
    padding: '6px 8px',
    border: '1px solid hsl(var(--border))',
    borderRadius: 6,
    background: 'hsl(var(--muted))',
    color: 'hsl(var(--foreground))',
  },
  toolButton: {
    padding: '6px 10px',
    border: '1px solid hsl(var(--border))',
    borderRadius: 6,
    background: 'hsl(var(--muted))',
    color: 'hsl(var(--foreground))',
    cursor: 'pointer',
  },
  table: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: 0,
    tableLayout: 'fixed',
    fontSize: 13,
  },
  th: {
    position: 'sticky',
    top: 0,
    zIndex: 2,
    background: 'hsl(var(--muted))',
    color: 'hsl(var(--muted-foreground))',
    textAlign: 'left',
    padding: '8px 10px',
    borderBottom: '1px solid hsl(var(--border))',
    whiteSpace: 'nowrap',
  },
  stickyFirstHeader: {
    left: 0,
    zIndex: 3,
    boxShadow: '2px 0 0 0 hsl(var(--border))',
  },
  thContent: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  colResizer: {
    position: 'absolute',
    right: -3,
    top: 0,
    width: 6,
    height: '100%',
    cursor: 'col-resize',
  },
  tr: {
    borderBottom: '1px solid hsl(var(--border))',
  },
  blockedRow: {
    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(251, 191, 36, 0.05) 100%)',
  },
  td: {
    padding: '6px 10px',
    borderBottom: '1px solid hsl(var(--border))',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  stickyFirstCell: {
    position: 'sticky',
    left: 0,
    background: 'hsl(var(--background))',
    zIndex: 1,
    boxShadow: '2px 0 0 0 hsl(var(--border))',
  },
  selectedCell: {
    background: 'rgba(59,130,246,0.12)',
  },
  rowResizer: {
    position: 'absolute',
    bottom: -3,
    left: 0,
    width: '100%',
    height: 6,
    cursor: 'row-resize',
  },
  link: {
    color: 'hsl(var(--primary))',
    textDecoration: 'underline',
  },
  muted: { color: 'hsl(var(--muted-foreground))' },
  blockedCell: {
    color: 'hsl(var(--muted-foreground))',
    fontStyle: 'italic',
    fontSize: '12px',
    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(251, 191, 36, 0.1) 100%)',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  columnsPanel: {
    position: 'absolute',
    right: 0,
    top: '110%',
    padding: 8,
    background: 'hsl(var(--background))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 6,
    boxShadow: '0 10px 20px rgba(0,0,0,0.1)'
  },
  columnItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 2px',
    whiteSpace: 'nowrap'
  },
  dialogBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  dialog: {
    width: 360,
    maxWidth: '90vw',
    background: 'hsl(var(--background))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 8,
    boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
    padding: 12,
  },
  dialogHeader: {
    fontSize: 16,
    marginBottom: 8,
    color: 'hsl(var(--foreground))',
  },
  columnsList: {
    maxHeight: 260,
    overflow: 'auto',
    padding: 8,
    border: '1px solid hsl(var(--border))',
    borderRadius: 6,
    marginBottom: 10,
  },
  dialogActions: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end'
  },
  blockedTableContainer: {
    width: '100%',
    minHeight: '400px',
    border: '2px solid hsl(var(--border))',
    borderRadius: 12,
    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(251, 191, 36, 0.05) 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem 2rem',
  },
  blockedTableContent: {
    maxWidth: 500,
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1.5rem',
  },
  lockIcon: {
    fontSize: '4rem',
    marginBottom: '0.5rem',
  },
  blockedTitle: {
    fontSize: '1.75rem',
    fontWeight: '700',
    color: 'hsl(var(--foreground))',
    margin: 0,
  },
  blockedDescription: {
    fontSize: '1rem',
    color: 'hsl(var(--muted-foreground))',
    lineHeight: 1.6,
    margin: 0,
  },
  blockedFeatures: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    width: '100%',
    marginTop: '1rem',
  },
  featureItem: {
    padding: '0.75rem 1.25rem',
    background: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    borderRadius: 8,
    fontSize: '0.95rem',
    fontWeight: 600,
    color: 'hsl(var(--foreground))',
  },
  premiumNotice: {
    padding: '6px 12px',
    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(251, 191, 36, 0.15) 100%)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    borderRadius: 6,
    color: 'hsl(var(--foreground))',
    fontSize: 13,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  }
};
