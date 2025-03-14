'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/contexts/ProfileContext';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  MessageSquare, 
  Heart, 
  Share2, 
  MoreHorizontal,
  TrendingUp,
  TrendingDown,
  Target
} from 'lucide-react';
import { supabase } from '@/utils/supabase';

export default function PostCard({ post }) {
  const router = useRouter();
  const { user } = useAuth();
  const { getEffectiveAvatarUrl } = useProfile();
  const [liked, setLiked] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('/default-avatar.svg');
  
  useEffect(() => {
    setMounted(true);
    
    // Get avatar URL from Supabase storage
    const fetchAvatarUrl = async () => {
      if (post?.user_id) {
        // Try to get avatar from storage
        const { data: jpgData } = supabase.storage
          .from('avatars')
          .getPublicUrl(`${post.user_id}/avatar.jpg`);
          
        const { data: pngData } = supabase.storage
          .from('avatars')
          .getPublicUrl(`${post.user_id}/avatar.png`);
          
        // Use the first valid URL found, or fall back to the post's avatar_url, or default
        const url = jpgData?.publicUrl || pngData?.publicUrl || post.avatar_url || '/default-avatar.svg';
        setAvatarUrl(url);
      }
    };
    
    fetchAvatarUrl();
  }, [post]);
  
  if (!post) return null;
  
  const {
    id,
    user_id,
    description,
    image_url,
    created_at,
    username,
    symbol,
    company_name,
    current_price,
    target_price,
    stop_loss_price,
    strategy,
  } = post;
  
  // Only format date on client-side to avoid hydration mismatch
  const formattedDate = mounted && created_at 
    ? formatDistanceToNow(new Date(created_at), { addSuffix: true }) 
    : '';
  
  const hasStockInfo = !!symbol;
  const hasTargetPrice = !!target_price;
  const hasStopLossPrice = !!stop_loss_price;
  
  const handleLike = () => {
    setLiked(!liked);
    // TODO: Implement like functionality with backend
  };
  
  const handleComment = () => {
    // TODO: Implement comment functionality
  };
  
  const handleShare = () => {
    // TODO: Implement share functionality
  };
  
  const handleProfileClick = () => {
    router.push(`/profile/${user_id}`);
  };
  
  return (
    <Card className="overflow-hidden">
      <CardHeader className="p-4">
        <div className="flex items-center gap-3">
          <Avatar 
            className="cursor-pointer" 
            onClick={handleProfileClick}
          >
            <AvatarImage 
              src={avatarUrl} 
              alt={username || 'User'} 
            />
            <AvatarFallback>{username?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div 
              className="font-medium cursor-pointer hover:underline"
              onClick={handleProfileClick}
            >
              {username || 'User'}
            </div>
            {mounted && (
              <div className="text-xs text-muted-foreground">{formattedDate}</div>
            )}
          </div>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-4 pt-0">
        {description && (
          <p className="mb-4 whitespace-pre-wrap">{description}</p>
        )}
        
        {hasStockInfo && (
          <div className="mb-4 p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">{symbol}</div>
              {company_name && (
                <div className="text-sm text-muted-foreground">{company_name}</div>
              )}
            </div>
            
            <div className="flex flex-wrap gap-3 mt-2">
              {current_price && (
                <div className="flex items-center gap-1 text-sm">
                  <span className="text-muted-foreground">Current:</span>
                  <span className="font-medium">${current_price}</span>
                </div>
              )}
              
              {hasTargetPrice && (
                <div className="flex items-center gap-1 text-sm">
                  <Target className="h-3 w-3 text-green-500" />
                  <span className="text-muted-foreground">Target:</span>
                  <span className="font-medium text-green-500">${target_price}</span>
                </div>
              )}
              
              {hasStopLossPrice && (
                <div className="flex items-center gap-1 text-sm">
                  <TrendingDown className="h-3 w-3 text-red-500" />
                  <span className="text-muted-foreground">Stop:</span>
                  <span className="font-medium text-red-500">${stop_loss_price}</span>
                </div>
              )}
              
              {strategy && (
                <div className="flex items-center gap-1 text-sm ml-auto">
                  <span className="text-muted-foreground">Strategy:</span>
                  <span className="font-medium">{strategy}</span>
                </div>
              )}
            </div>
          </div>
        )}
        
        {image_url && (
          <div className="relative rounded-lg overflow-hidden mb-4">
            <img
              src={image_url}
              alt="Post image"
              className="w-full object-cover max-h-[400px]"
            />
          </div>
        )}
      </CardContent>
      
      <CardFooter className="p-2 border-t flex justify-between">
        <Button 
          variant="ghost" 
          size="sm" 
          className="flex-1"
          onClick={handleLike}
        >
          <Heart 
            className={`h-4 w-4 mr-2 ${liked ? 'fill-red-500 text-red-500' : ''}`} 
          />
          Like
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          className="flex-1"
          onClick={handleComment}
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          Comment
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          className="flex-1"
          onClick={handleShare}
        >
          <Share2 className="h-4 w-4 mr-2" />
          Share
        </Button>
      </CardFooter>
    </Card>
  );
}
