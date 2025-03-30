# FireStocks - Social Stock Analysis Platform

## Overview
FireStocks is a modern web application that combines social networking with stock market analysis. It allows users to share insights, post trading ideas, track stocks, and interact with other traders in a community-focused environment.

## Key Features

### Stock Analysis & Trading
- 📊 Real-time stock data and price information
- 🔍 Comprehensive stock search with company information and country data
- 📈 Set and share target prices and stop loss levels
- 📉 Track your favorite stocks and trading strategies

### Social Features
- 📝 Create and share posts about your stock picks and analyses
- 🖼️ Add images to your posts for technical chart analysis
- 👥 Connect with other traders and investors
- 💬 Comment on and discuss trading ideas

### User Experience
- 🌓 Light/Dark mode toggle for comfortable viewing
- 📱 Responsive design that works on all devices
- 🔐 Secure authentication with email/password
- ⚡ Fast, modern UI built with Next.js

## Tech Stack
- **Frontend**: Next.js 14, React 18
- **Database**: Supabase
- **Authentication**: Supabase Auth
- **Styling**: Custom CSS with theming support
- **State Management**: React Hooks and Context
- **API Integration**: Financial data from external APIs

## Getting Started

### Prerequisites
- Node.js 18.x or higher
- NPM or Yarn package manager
- Supabase account (for backend services)

### Installation
1. Clone the repository
   ```bash
   git clone <repository-url>
   cd stockroom
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Set up environment variables (create a `.env.local` file)
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   NEXT_PUBLIC_STOCK_API_KEY=your_stock_api_key
   ```

4. Run the development server
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure
```
stockroom/
├── src/
│   ├── app/                # Next.js 14 app directory
│   ├── components/         # Reusable React components
│   ├── contexts/           # React Context providers
│   ├── hooks/              # Custom React hooks
│   ├── styles/             # CSS modules and global styles
│   └── utils/              # Helper functions and API utilities
├── public/                 # Static assets
├── .env.local              # Environment variables (create this)
└── package.json            # Project dependencies
```

## Features In Detail

### Post Creation
Users can create posts with:
- Rich text descriptions
- Stock symbols with auto-tagging ($AAPL, #NYSE)
- Current price, target price, and stop loss information
- Image uploads for charts and technical analysis
- Trading strategy tags

### Stock Search
- Global search for stocks across multiple exchanges
- Country flags and exchange information
- Real-time stock price data
- Company information and metadata

### User Profiles
- Customizable user profiles
- Trading statistics and performance metrics
- Following/follower relationship system
- Trading history and activity feed

## Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## License
This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements
- Financial data APIs for stock information
- Next.js team for the amazing framework
- Supabase for backend services
- All contributors to this project

## Recent Updates

### Dialog State Management with Zustand

We've implemented a global dialog state management system using Zustand to improve the user experience:

- Created `dialogStore.js` to centrally manage dialog states
- Implemented state variables for dialog open/close, form data persistence, and submission status
- Modified `CreatePostButton` and `CreatePostForm` to use the dialog store
- Simplified the HomePage by extracting post listing logic to a dedicated `PostList` component

### CSS Styling Improvements

Major styling updates include:

- Created a consistent color theme with CSS variables in `globals.css`
- Implemented CSS modules for component styling:
  - `postCard.module.css` for PostCard component styling
  - `home.module.css` for HomePage styling
- Removed inline styles in favor of CSS modules for better maintainability
- Added CSS variables for consistent theming across light and dark modes

## Project Structure

```
src/
├── app/
│   └── home/
│       └── page.js       # Main homepage using PostList component
├── components/
│   └── posts/
│       ├── CreatePostButton.js  # Button with dialog functionality
│       ├── CreatePostForm.js    # Form using dialogStore for state
│       ├── PostCard.js          # Card using CSS modules
│       └── PostList.js          # Extracted list component
├── store/
│   ├── dialogStore.js    # Dialog state management
│   └── postsStore.js     # Posts data management
└── styles/
    ├── globals.css       # Global styles and CSS variables
    ├── home.module.css   # HomePage specific styles
    └── postCard.module.css  # PostCard specific styles
```

## Features

- Global state management with Zustand
- Responsive UI with CSS modules
- Dark mode support
- Modern dialog system for creating posts
- Infinite scrolling post list

## Technologies Used

- Next.js for the frontend framework
- Zustand for state management
- CSS Modules for component styling
- CSS Variables for theming
