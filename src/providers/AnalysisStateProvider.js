'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const AnalysisStateContext = createContext(undefined);

const STORAGE_KEYS = {
  VIEW_MODE: 'sharkszone-analysis-viewmode',
  DATE_RANGE: 'sharkszone-analysis-daterange',
  SORT_COLUMN: 'sharkszone-analysis-sortcolumn',
  SORT_DIRECTION: 'sharkszone-analysis-sortdirection',
  VISIBLE_CHARTS: 'sharkszone-analysis-visiblecharts',
  CUSTOM_CHARTS: 'sharkszone-analysis-customcharts',
  CUSTOM_CHARTS_VISIBILITY: 'sharkszone-analysis-customcharts-visibility',
  SHOW_CHARTS: 'sharkszone-analysis-showcharts',
};

const DEFAULT_STATE = {
  viewMode: 'table',
  dateRange: 'all',
  sortColumn: 'created_at',
  sortDirection: 'desc',
  showCharts: true,
  visibleCharts: {
    postsPerMonth: true,
    successRate: true,
    postsByStrategy: true,
    postsByCountry: true,
    postsBySentiment: true,
    engagement: true,
    pieChart: true,
    treemap: true,
    sunburst: true,
  },
  customCharts: [],
  customChartsVisibility: {},
};

export function AnalysisStateProvider({ children }) {
  const [mounted, setMounted] = useState(false);
  const [viewMode, setViewMode] = useState(DEFAULT_STATE.viewMode);
  const [dateRange, setDateRange] = useState(DEFAULT_STATE.dateRange);
  const [sortColumn, setSortColumn] = useState(DEFAULT_STATE.sortColumn);
  const [sortDirection, setSortDirection] = useState(DEFAULT_STATE.sortDirection);
  const [showCharts, setShowCharts] = useState(DEFAULT_STATE.showCharts);
  const [visibleCharts, setVisibleCharts] = useState(DEFAULT_STATE.visibleCharts);
  const [customCharts, setCustomCharts] = useState(DEFAULT_STATE.customCharts);
  const [customChartsVisibility, setCustomChartsVisibility] = useState(DEFAULT_STATE.customChartsVisibility);

  // Load state from localStorage on mount
  useEffect(() => {
    setMounted(true);
    
    try {
      // Load view mode
      const savedViewMode = localStorage.getItem(STORAGE_KEYS.VIEW_MODE);
      if (savedViewMode && ['table', 'grid', 'timeline', 'kanban', 'calendar'].includes(savedViewMode)) {
        setViewMode(savedViewMode);
      }

      // Load date range
      const savedDateRange = localStorage.getItem(STORAGE_KEYS.DATE_RANGE);
      if (savedDateRange) {
        setDateRange(savedDateRange);
      }

      // Load sort settings
      const savedSortColumn = localStorage.getItem(STORAGE_KEYS.SORT_COLUMN);
      if (savedSortColumn) {
        setSortColumn(savedSortColumn);
      }

      const savedSortDirection = localStorage.getItem(STORAGE_KEYS.SORT_DIRECTION);
      if (savedSortDirection && ['asc', 'desc'].includes(savedSortDirection)) {
        setSortDirection(savedSortDirection);
      }

      // Load show charts
      const savedShowCharts = localStorage.getItem(STORAGE_KEYS.SHOW_CHARTS);
      if (savedShowCharts !== null) {
        setShowCharts(savedShowCharts === 'true');
      }

      // Load visible charts
      const savedVisibleCharts = localStorage.getItem(STORAGE_KEYS.VISIBLE_CHARTS);
      if (savedVisibleCharts) {
        setVisibleCharts(JSON.parse(savedVisibleCharts));
      }

      // Load custom charts
      const savedCustomCharts = localStorage.getItem(STORAGE_KEYS.CUSTOM_CHARTS);
      if (savedCustomCharts) {
        const charts = JSON.parse(savedCustomCharts);
        setCustomCharts(charts);

        // Load custom charts visibility
        const savedVisibility = localStorage.getItem(STORAGE_KEYS.CUSTOM_CHARTS_VISIBILITY);
        const visibility = savedVisibility ? JSON.parse(savedVisibility) : {};
        
        // Ensure all charts have visibility state
        const updatedVisibility = {};
        charts.forEach(chart => {
          updatedVisibility[chart.id] = visibility[chart.id] !== false;
        });
        setCustomChartsVisibility(updatedVisibility);
      }
    } catch (error) {
      console.error('[AnalysisStateProvider] Error loading state:', error);
    }
  }, []);

  // Save view mode
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(STORAGE_KEYS.VIEW_MODE, viewMode);
    } catch (error) {
      console.error('[AnalysisStateProvider] Error saving view mode:', error);
    }
  }, [viewMode, mounted]);

  // Save date range
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(STORAGE_KEYS.DATE_RANGE, dateRange);
    } catch (error) {
      console.error('[AnalysisStateProvider] Error saving date range:', error);
    }
  }, [dateRange, mounted]);

  // Save sort settings
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(STORAGE_KEYS.SORT_COLUMN, sortColumn);
      localStorage.setItem(STORAGE_KEYS.SORT_DIRECTION, sortDirection);
    } catch (error) {
      console.error('[AnalysisStateProvider] Error saving sort settings:', error);
    }
  }, [sortColumn, sortDirection, mounted]);

  // Save show charts
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(STORAGE_KEYS.SHOW_CHARTS, showCharts.toString());
    } catch (error) {
      console.error('[AnalysisStateProvider] Error saving show charts:', error);
    }
  }, [showCharts, mounted]);

  // Save visible charts
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(STORAGE_KEYS.VISIBLE_CHARTS, JSON.stringify(visibleCharts));
    } catch (error) {
      console.error('[AnalysisStateProvider] Error saving visible charts:', error);
    }
  }, [visibleCharts, mounted]);

  // Save custom charts
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOM_CHARTS, JSON.stringify(customCharts));
    } catch (error) {
      console.error('[AnalysisStateProvider] Error saving custom charts:', error);
    }
  }, [customCharts, mounted]);

  // Save custom charts visibility
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOM_CHARTS_VISIBILITY, JSON.stringify(customChartsVisibility));
    } catch (error) {
      console.error('[AnalysisStateProvider] Error saving custom charts visibility:', error);
    }
  }, [customChartsVisibility, mounted]);

  // Toggle chart visibility
  const toggleChart = (chartName) => {
    setVisibleCharts(prev => ({
      ...prev,
      [chartName]: !prev[chartName]
    }));
  };

  // Toggle custom chart visibility
  const toggleCustomChart = (chartId) => {
    setCustomChartsVisibility(prev => ({
      ...prev,
      [chartId]: !prev[chartId]
    }));
  };

  // Add custom chart
  const addCustomChart = (chartConfig) => {
    const newChart = {
      id: Date.now().toString(),
      ...chartConfig,
    };
    setCustomCharts(prev => [...prev, newChart]);
    setCustomChartsVisibility(prev => ({
      ...prev,
      [newChart.id]: true
    }));
    return newChart;
  };

  // Delete custom chart
  const deleteCustomChart = (chartId) => {
    setCustomCharts(prev => prev.filter(chart => chart.id !== chartId));
    setCustomChartsVisibility(prev => {
      const newState = { ...prev };
      delete newState[chartId];
      return newState;
    });
  };

  // Reset to defaults
  const resetAnalysisState = () => {
    setViewMode(DEFAULT_STATE.viewMode);
    setDateRange(DEFAULT_STATE.dateRange);
    setSortColumn(DEFAULT_STATE.sortColumn);
    setSortDirection(DEFAULT_STATE.sortDirection);
    setShowCharts(DEFAULT_STATE.showCharts);
    setVisibleCharts(DEFAULT_STATE.visibleCharts);
    setCustomCharts(DEFAULT_STATE.customCharts);
    setCustomChartsVisibility(DEFAULT_STATE.customChartsVisibility);
  };

  const value = {
    // State
    viewMode,
    dateRange,
    sortColumn,
    sortDirection,
    showCharts,
    visibleCharts,
    customCharts,
    customChartsVisibility,
    
    // Setters
    setViewMode,
    setDateRange,
    setSortColumn,
    setSortDirection,
    setShowCharts,
    setVisibleCharts,
    setCustomCharts,
    setCustomChartsVisibility,
    
    // Actions
    toggleChart,
    toggleCustomChart,
    addCustomChart,
    deleteCustomChart,
    resetAnalysisState,
  };

  return (
    <AnalysisStateContext.Provider value={value}>
      {children}
    </AnalysisStateContext.Provider>
  );
}

export function useAnalysisState() {
  const context = useContext(AnalysisStateContext);
  if (context === undefined) {
    throw new Error('useAnalysisState must be used within an AnalysisStateProvider');
  }
  return context;
}
