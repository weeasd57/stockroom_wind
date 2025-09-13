import React, { Component, ReactNode } from 'react';
import { AppError } from '@/types';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
  retryCount: number;
}

interface ErrorBoundaryProps {
  children?: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
  maxRetries?: number;
  showDetails?: boolean;
  level?: 'page' | 'component' | 'feature';
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }
  
  private retryTimeoutId: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Call onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log error to monitoring service
    this.logErrorToService(error, errorInfo);
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  private logErrorToService = (error: Error, errorInfo: any) => {
    const appError: AppError = {
      code: 'COMPONENT_ERROR',
      message: error.message,
      details: {
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        props: this.props,
        level: this.props.level || 'component',
      },
      timestamp: new Date().toISOString(),
    };

    // In a real app, you would send this to your error monitoring service
    // Example: Sentry, LogRocket, Bugsnag, etc.
    if (process.env.NODE_ENV === 'production') {
      // errorMonitoringService.logError(appError);
      console.error('Production Error:', appError);
    }
  };

  private handleRetry = () => {
    const { maxRetries = 3 } = this.props;
    const { retryCount } = this.state;

    if (retryCount < maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1,
      }));
    }
  };

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  private renderErrorUI = () => {
    const { error, errorInfo, retryCount } = this.state;
    const { maxRetries = 3, showDetails = false, level = 'component' } = this.props;
    const canRetry = retryCount < maxRetries;

    // Different UI based on error level
    if (level === 'page') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="max-w-md w-full space-y-8 p-8">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 text-red-500">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
                عذراً، حدث خطأ!
              </h2>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Sorry, something went wrong!
              </p>
            </div>
            
            <div className="space-y-4">
              {canRetry && (
                <button
                  onClick={this.handleRetry}
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  المحاولة مرة أخرى ({maxRetries - retryCount} محاولات متبقية)
                </button>
              )}
              
              <button
                onClick={this.handleReload}
                className="group relative w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600"
              >
                إعادة تحميل الصفحة
              </button>
            </div>

            {showDetails && error && (
              <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">
                  تفاصيل الخطأ:
                </h3>
                <p className="text-sm text-red-700 dark:text-red-400 font-mono break-all">
                  {error.message}
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Component level error UI
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 m-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
              حدث خطأ في هذا المكون
            </h3>
            <p className="mt-1 text-sm text-red-700 dark:text-red-400">
              Something went wrong with this component.
            </p>
            
            <div className="mt-4 space-x-3 space-x-reverse">
              {canRetry && (
                <button
                  onClick={this.handleRetry}
                  className="text-sm bg-red-100 text-red-800 px-3 py-1 rounded hover:bg-red-200 dark:bg-red-800 dark:text-red-100 dark:hover:bg-red-700"
                >
                  المحاولة مرة أخرى ({maxRetries - retryCount})
                </button>
              )}
              
              <button
                onClick={this.handleReload}
                className="text-sm bg-gray-100 text-gray-800 px-3 py-1 rounded hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
              >
                إعادة تحميل
              </button>
            </div>

            {showDetails && error && (
              <div className="mt-4 p-3 bg-red-100 dark:bg-red-800/50 rounded">
                <p className="text-xs text-red-800 dark:text-red-200 font-mono break-all">
                  {error.message}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  render() {
    const { hasError } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      return fallback || this.renderErrorUI();
    }

    return children || null;
  }
}

// HOC for wrapping components with error boundary
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
};

// Hook for error reporting
export const useErrorHandler = () => {
  const handleError = React.useCallback((error: Error, errorInfo?: any) => {
    console.error('Error caught by useErrorHandler:', error);
    
    // Log to monitoring service
    const appError: AppError = {
      code: 'HOOK_ERROR',
      message: error.message,
      details: {
        stack: error.stack,
        errorInfo,
      },
      timestamp: new Date().toISOString(),
    };

    if (process.env.NODE_ENV === 'production') {
      // errorMonitoringService.logError(appError);
    }
  }, []);

  return { handleError };
};

// Async error boundary for handling promise rejections
export const AsyncErrorBoundary: React.FC<ErrorBoundaryProps> = ({ children, ...props }) => {
  React.useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      
      // You could set state here to show an error UI
      // or send to monitoring service
    };

    const handleError = (event: ErrorEvent) => {
      console.error('Global error:', event.error);
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  return <ErrorBoundary {...props}>{children}</ErrorBoundary>;
};

export default ErrorBoundary;