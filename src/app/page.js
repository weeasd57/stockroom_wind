"use client";

import { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { useAuth } from "@/hooks/useAuth";
import Image from "next/image";
import Link from "next/link";
import { getPosts } from "@/utils/supabase";
import PostCard from "@/components/posts/PostCard";
import { Button } from "@/components/ui/button";
import CreatePostButton from "@/components/posts/CreatePostButton";

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Fetch posts when authenticated
  const fetchPosts = async (pageNum = 1) => {
    try {
      setIsLoading(true);
      const { data, error, hasMorePages } = await getPosts(pageNum);
      
      if (error) {
        console.error('Error fetching posts:', error);
        return;
      }
      
      if (pageNum === 1) {
        setPosts(data || []);
      } else {
        setPosts(prev => [...prev, ...(data || [])]);
      }
      
      setHasMore(hasMorePages || false);
      setPage(pageNum);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle new post creation
  const handlePostCreated = (newPost) => {
    setPosts(prevPosts => [newPost, ...(prevPosts || [])]);
  };

  // Handle load more
  const handleLoadMore = () => {
    if (hasMore && !isLoading) {
      fetchPosts(page + 1);
    }
  };

  useEffect(() => {
    // Only fetch posts if authenticated
    if (!loading && isAuthenticated) {
      fetchPosts();
    }
  }, [isAuthenticated, loading]);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-t-2 border-b-2 border-primary rounded-full"></div>
      </div>
    );
  }

  // If user is authenticated, show posts feed
  if (isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Your Feed</h1>
        
        {/* Create post button */}
        <div className="mb-8">
          <CreatePostButton onPostCreated={handlePostCreated} />
        </div>
        
        {/* Posts list */}
        <div className="space-y-6">
          {posts && posts.length === 0 && !isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No posts yet. Be the first to post!</p>
            </div>
          ) : (
            posts && posts.map(post => (
              <PostCard key={post.id} post={post} />
            ))
          )}
          
          {isLoading && (
            <div className="flex justify-center py-4">
              <div className="animate-spin h-6 w-6 border-t-2 border-b-2 border-primary rounded-full"></div>
            </div>
          )}
          
          {hasMore && !isLoading && posts && posts.length > 0 && (
            <div className="flex justify-center py-4">
              <Button onClick={handleLoadMore} variant="outline">
                Load More
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const features = [
    {
      title: "Social Trading",
      description: "Connect with other traders, share insights, and follow top performers.",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      ),
    },
    {
      title: "Technical Analysis",
      description: "Access powerful charting tools and technical indicators for better decisions.",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10"></line>
          <line x1="12" y1="20" x2="12" y2="4"></line>
          <line x1="6" y1="20" x2="6" y2="14"></line>
          <line x1="2" y1="20" x2="22" y2="20"></line>
        </svg>
      ),
    },
    {
      title: "Market Insights",
      description: "Get real-time market data, news, and personalized insights.",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
      ),
    },
    {
      title: "Portfolio Tracking",
      description: "Track your investments and analyze your performance over time.",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
          <line x1="8" y1="21" x2="16" y2="21"></line>
          <line x1="12" y1="17" x2="12" y2="21"></line>
        </svg>
      ),
    },
  ];

  return (
    <div className={`flex flex-col min-h-screen transition-opacity duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      {/* Hero Section */}
      <section className="relative py-20 md:py-32 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-background z-0"></div>
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10 z-0"></div>
        
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-block animate-fade-in-up">
                <div className="flex items-center px-3 py-1 text-sm rounded-full bg-primary/10 text-primary mb-4 w-fit">
                  <span className="relative flex h-2 w-2 mr-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  Social Trading Platform
                </div>
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight animate-fade-in-up animation-delay-150">
                Trade Smarter with <span className="text-primary">StockRoom</span>
              </h1>
              
              <p className="text-lg text-muted-foreground animate-fade-in-up animation-delay-300">
                Connect with traders, share insights, and make better investment decisions with our social trading platform.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 animate-fade-in-up animation-delay-450">
                <Link 
                  href="/login" 
                  className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
                >
                  Get Started
                </Link>
                <Link 
                  href="/traders" 
                  className="px-6 py-3 rounded-lg border border-border bg-background hover:bg-muted transition-colors font-medium"
                >
                  Explore Traders
                </Link>
              </div>
            </div>
            
            <div className="relative h-[400px] md:h-[500px] animate-fade-in-up animation-delay-600">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent rounded-2xl"></div>
              <div className="absolute top-8 right-8 bottom-8 left-8 bg-card rounded-xl shadow-2xl overflow-hidden border border-border">
                <div className="h-12 bg-muted border-b border-border flex items-center px-4">
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 rounded-full bg-destructive"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                  </div>
                </div>
                <div className="p-4">
                  <div className="h-8 w-1/2 bg-muted rounded mb-4"></div>
                  <div className="h-64 bg-muted/50 rounded mb-4 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                    </svg>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="h-8 bg-muted rounded"></div>
                    <div className="h-8 bg-muted rounded"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Platform Features</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Everything you need to make informed trading decisions and connect with other traders.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div 
                key={feature.title}
                className="bg-card border border-border rounded-xl p-6 hover:shadow-md transition-all hover:-translate-y-1 animate-fade-in-up"
                style={{ animationDelay: `${(index + 1) * 150}ms` }}
              >
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-lg flex items-center justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-background z-0"></div>
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 animate-fade-in-up">
            Ready to elevate your trading experience?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto animate-fade-in-up animation-delay-150">
            Join thousands of traders who are already using StockRoom to make better investment decisions.
          </p>
          <div className="animate-fade-in-up animation-delay-300">
            <Link 
              href="/signup" 
              className="px-8 py-4 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors text-lg"
            >
              Sign Up Now
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
