"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

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
                {isAuthenticated ? (
                  <Link 
                    href="/profile" 
                    className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
                  >
                    Go to Profile
                  </Link>
                ) : (
                  <Link 
                    href="/login" 
                    className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
                  >
                    Get Started
                  </Link>
                )}
                <Link 
                  href="/explore" 
                  className="px-6 py-3 rounded-lg border border-border bg-background hover:bg-muted transition-colors font-medium"
                >
                  Explore Platform
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
          <p className="text-lg text-muted-foreground mb-8 animate-fade-in-up animation-delay-150">
            Join thousands of traders who are already using StockRoom to connect, share insights, and make better trading decisions.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up animation-delay-300">
            {isAuthenticated ? (
              <Link 
                href="/profile" 
                className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
              >
                Go to Profile
              </Link>
            ) : (
              <Link 
                href="/login" 
                className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
              >
                Sign Up Now
              </Link>
            )}
            <Link 
              href="/explore" 
              className="px-6 py-3 rounded-lg border border-border bg-background hover:bg-muted transition-colors font-medium"
            >
              Learn More
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-6 md:mb-0">
              <Image 
                src="/logo.svg" 
                alt="StockRoom Logo" 
                width={32} 
                height={32}
                className="mr-2"
              />
              <span className="text-xl font-bold">StockRoom</span>
            </div>
            
            <div className="flex flex-wrap gap-6 justify-center">
              <Link href="/about" className="text-muted-foreground hover:text-foreground transition-colors">
                About
              </Link>
              <Link href="/features" className="text-muted-foreground hover:text-foreground transition-colors">
                Features
              </Link>
              <Link href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </Link>
              <Link href="/blog" className="text-muted-foreground hover:text-foreground transition-colors">
                Blog
              </Link>
              <Link href="/contact" className="text-muted-foreground hover:text-foreground transition-colors">
                Contact
              </Link>
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-muted-foreground mb-4 md:mb-0">
              {new Date().getFullYear()} StockRoom. All rights reserved.
            </p>
            
            <div className="flex gap-4">
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
                </svg>
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path>
                </svg>
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                </svg>
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                  <rect x="2" y="9" width="4" height="12"></rect>
                  <circle cx="4" cy="4" r="2"></circle>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
