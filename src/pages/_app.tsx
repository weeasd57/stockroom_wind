import type { AppProps } from 'next/app';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { PostProvider } from '@/providers';
import { UserProvider } from '@/providers/UserProvider';
import { CommentProvider } from '@/providers';
import '@/styles/globals.css';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary>
      <UserProvider>
        <PostProvider>
          <CommentProvider>
            <LoadingIndicator />
            <Component {...pageProps} />
          </CommentProvider>
        </PostProvider>
      </UserProvider>
    </ErrorBoundary>
  );
}

export default MyApp;
