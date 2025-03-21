'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/contexts/ProfileContext';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export default function CreatePostButton() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const { profile } = useProfile();
  
  // If not authenticated, don't render anything
  if (!isAuthenticated) {
    return null;
  }

  const handleCreatePost = () => {
    router.push('/create-post');
  };

  return (
    <div className="create-post-button w-full bg-card hover:bg-card/90 rounded-xl shadow-md transition-all duration-300 mb-6 overflow-hidden">
      <div className="p-4 relative">
        {/* Animated border */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/50 via-blue-500/50 to-primary/50 opacity-0 hover:opacity-100 transition-opacity duration-300 rounded-xl animate-pulse" style={{ padding: '1px' }}>
          <div className="absolute inset-0 bg-card rounded-xl"></div>
        </div>
        
        <div className="flex items-center gap-3 relative z-10">
          <Avatar className="h-10 w-10 border-2 border-primary/20 shadow-sm">
            <AvatarImage 
              src={profile?.avatarUrl || '/default-avatar.svg'} 
              alt={profile?.username || 'User'} 
              className="object-cover"
            />
            <AvatarFallback className="font-semibold">{profile?.username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
          </Avatar>
          
          <div 
            onClick={handleCreatePost}
            className="flex-1 bg-muted hover:bg-muted/80 rounded-full px-4 py-2.5 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
          >
            <p className="truncate">What's on your mind about the markets today?</p>
          </div>
        </div>
        
        <div className="mt-3 pt-3 border-t border-border flex justify-around">
          <Button 
            onClick={handleCreatePost}
            variant="ghost" 
            className="flex-1 rounded-md py-2 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <line x1="10" y1="9" x2="8" y2="9"/>
            </svg>
            Create Post
          </Button>
          <Button 
            onClick={handleCreatePost}
            variant="ghost" 
            className="flex-1 rounded-md py-2 text-muted-foreground hover:text-green-500 hover:bg-green-500/10 transition-all duration-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            Add Photo
          </Button>
        </div>
      </div>
    </div>
  );
}
