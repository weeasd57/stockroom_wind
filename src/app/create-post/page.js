'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import CreatePostForm from '@/components/posts/CreatePostForm';
import '@/styles/create-post-page.css';

export default function CreatePostPage() {
  const router = useRouter();
  const { user } = useAuth();

  const handlePostCreated = () => {
    router.push('/posts');  // Redirect to posts page after creation
  };

  const handleCancel = () => {
    router.back();  // Go back to previous page
  };

  return (
    <div className="create-post-container">
      <div className="create-post-wrapper">
        <div className="create-post-header">
          <button 
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            aria-label="Go back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <h1>Create a Post</h1>
        </div>
        <div className="create-post-content">
          <CreatePostForm 
            onPostCreated={handlePostCreated}
            onCancel={handleCancel}
          />
        </div>
      </div>
    </div>
  );
}
