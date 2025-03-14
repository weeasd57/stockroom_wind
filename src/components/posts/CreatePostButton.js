'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/contexts/ProfileContext';
import CreatePostForm from '@/components/posts/CreatePostForm';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export default function CreatePostButton({ onPostCreated }) {
  const { isAuthenticated } = useAuth();
  const { profile, getEffectiveAvatarUrl } = useProfile();
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('/default-avatar.svg');

  // Load avatar URL when component mounts
  useEffect(() => {
    const loadAvatarUrl = async () => {
      try {
        if (isAuthenticated) {
          const url = await getEffectiveAvatarUrl();
          setAvatarUrl(url);
        }
      } catch (error) {
        console.error('Error loading avatar URL:', error);
        setAvatarUrl('/default-avatar.svg');
      }
    };
    
    loadAvatarUrl();
  }, [isAuthenticated, getEffectiveAvatarUrl]);

  // If not authenticated, don't render anything
  if (!isAuthenticated) {
    return null;
  }

  // Handle new post creation
  const handlePostCreated = (newPost) => {
    setCreatePostOpen(false);
    // Call the parent's onPostCreated callback if provided
    if (onPostCreated && typeof onPostCreated === 'function') {
      onPostCreated(newPost);
    }
  };
  
  // Handle dialog close
  const handleClose = () => {
    setCreatePostOpen(false);
  };

  return (
    <>
      {/* Create post button - simplified version */}
      <button 
        onClick={() => setCreatePostOpen(true)}
        className="mb-8 w-full bg-card hover:bg-muted/80 rounded-xl p-4 shadow-md transition-colors flex items-center gap-4 cursor-pointer text-left"
      >
        <Avatar className="h-10 w-10 border-2 border-primary">
          <AvatarImage 
            src={avatarUrl} 
            alt={profile?.username || 'User'} 
            className="object-cover"
          />
          <AvatarFallback className="font-semibold">{profile?.username?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="border rounded-lg p-3 bg-muted/50">
            <p className="text-muted-foreground">What's on your mind?</p>
          </div>
        </div>
      </button>

      {/* Create post dialog */}
      <Dialog 
        open={createPostOpen} 
        onOpenChange={(open) => setCreatePostOpen(open)} 
        className="w-[80%] max-w-[2000px] max-h-[90vh] overflow-y-auto"
      >
        <DialogContent>
          <DialogHeader className="flex justify-between items-center mb-4">
            <DialogTitle className="text-xl font-bold">Create Post</DialogTitle>
            <DialogClose onClick={() => setCreatePostOpen(false)} className="rounded-full h-8 w-8 p-0 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </DialogClose>
          </DialogHeader>
          <CreatePostForm 
            onPostCreated={handlePostCreated} 
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
