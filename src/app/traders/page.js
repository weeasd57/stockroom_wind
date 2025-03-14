'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function TradersPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [traders, setTraders] = useState([]);

  useEffect(() => {
    // Simulate loading traders data
    const timer = setTimeout(() => {
      setTraders(sampleTraders);
      setIsLoading(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Top Traders</h1>
      
      {/* Search and filter */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <input 
              type="text" 
              placeholder="Search traders..." 
              className="w-full px-4 py-2 pl-10 rounded-lg border bg-background"
            />
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <select className="px-4 py-2 rounded-lg border bg-background">
            <option value="profit">Sort by Profit</option>
            <option value="followers">Sort by Followers</option>
            <option value="activity">Sort by Activity</option>
          </select>
        </div>
      </div>
      
      {/* Traders grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {traders.map((trader) => (
          <div key={trader.id} className="bg-card rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow">
            <div 
              className="h-32 bg-cover bg-center" 
              style={{ 
                backgroundImage: `url('${trader.backgroundUrl}')`,
                backgroundColor: 'rgba(var(--card), 0.8)'
              }}
            ></div>
            <div className="p-5">
              <div className="flex items-start">
                <div className="relative -mt-16 mr-4">
                  <Image
                    src={trader.avatarUrl}
                    alt={trader.name}
                    width={70}
                    height={70}
                    className="rounded-full border-4 border-background"
                    unoptimized
                  />
                </div>
                <div className="pt-2">
                  <h2 className="text-xl font-semibold">{trader.name}</h2>
                  <p className="text-sm text-muted-foreground">{trader.title}</p>
                </div>
              </div>
              
              <div className="mt-4">
                <p className="text-sm mb-4">{trader.bio}</p>
                
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="text-center">
                    <p className="text-lg font-semibold">{trader.stats.profit}%</p>
                    <p className="text-xs text-muted-foreground">Profit</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold">{trader.stats.followers}</p>
                    <p className="text-xs text-muted-foreground">Followers</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold">{trader.stats.trades}</p>
                    <p className="text-xs text-muted-foreground">Trades</p>
                  </div>
                </div>
                
                <div className="flex justify-between">
                  <Link 
                    href={`/profile/${trader.id}`}
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    View Profile
                  </Link>
                  <button className="px-4 py-2 rounded-lg border border-border bg-background hover:bg-muted transition-colors text-sm font-medium">
                    Follow
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Sample data
const sampleTraders = [
  {
    id: 1,
    name: "Alex Morgan",
    title: "Day Trader",
    bio: "Specializing in tech stocks with 5+ years of experience. I share daily insights on market trends.",
    avatarUrl: "https://randomuser.me/api/portraits/men/32.jpg",
    backgroundUrl: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    stats: {
      profit: 24.5,
      followers: 1243,
      trades: 156
    }
  },
  {
    id: 2,
    name: "Sarah Chen",
    title: "Swing Trader",
    bio: "Focused on mid-cap growth stocks. I analyze market patterns and share weekly trade ideas.",
    avatarUrl: "https://randomuser.me/api/portraits/women/44.jpg",
    backgroundUrl: "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    stats: {
      profit: 31.2,
      followers: 2567,
      trades: 89
    }
  },
  {
    id: 3,
    name: "Michael Johnson",
    title: "Options Strategist",
    bio: "Options trading specialist with focus on income strategies. I provide educational content.",
    avatarUrl: "https://randomuser.me/api/portraits/men/22.jpg",
    backgroundUrl: "https://images.unsplash.com/photo-1535320903710-d993d3d77d29?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    stats: {
      profit: 18.7,
      followers: 987,
      trades: 210
    }
  },
  {
    id: 4,
    name: "Emma Wilson",
    title: "Value Investor",
    bio: "Long-term value investor focusing on undervalued companies with strong fundamentals.",
    avatarUrl: "https://randomuser.me/api/portraits/women/29.jpg",
    backgroundUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    stats: {
      profit: 15.3,
      followers: 756,
      trades: 42
    }
  },
  {
    id: 5,
    name: "David Kim",
    title: "Crypto Trader",
    bio: "Cryptocurrency specialist with expertise in blockchain technology and DeFi projects.",
    avatarUrl: "https://randomuser.me/api/portraits/men/45.jpg",
    backgroundUrl: "https://images.unsplash.com/photo-1639322537228-f710d846310a?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    stats: {
      profit: 42.8,
      followers: 3421,
      trades: 178
    }
  },
  {
    id: 6,
    name: "Olivia Martinez",
    title: "Technical Analyst",
    bio: "Chart pattern specialist using technical analysis to identify high-probability setups.",
    avatarUrl: "https://randomuser.me/api/portraits/women/17.jpg",
    backgroundUrl: "https://images.unsplash.com/photo-1642543492481-44e81e3914a7?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    stats: {
      profit: 27.1,
      followers: 1876,
      trades: 134
    }
  }
];
