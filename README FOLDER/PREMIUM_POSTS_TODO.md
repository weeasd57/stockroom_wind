# Premium Posts Feature — TODO Plan

This document tracks the implementation plan, current status, and app state inventory for the Premium Posts feature.

## Scope
- Add premium-only visibility to posts (owner and Pro users only).
- UI: premium toggle on Create Post (Pro only), premium badge on PostCard.
- Filtering: All / Free / Premium in Home feed, and a Premium tab in Profile (Pro only).
- Data: persist `is_premium_only` in DB and pass through providers.

---

## Status Summary

### Completed
- [x] Model: Add `is_premium_only: boolean` to `Post` and `PostModel` with default `false`.
  - File: `src/models/Post.ts`
- [x] Create Post form: Add `isPremiumOnly` state to provider and a Pro-only checkbox in the form.
  - Files: `src/providers/CreatePostFormProvider.tsx`, `src/components/posts/CreatePostForm.js`
- [x] Include `is_premium_only` in `postData` sent to creation flow.
  - File: `src/components/posts/CreatePostForm.js`
- [x] Premium badge in PostCard header when `post.is_premium_only === true`.
  - File: `src/components/posts/PostCard.js`

### In Progress
- [ ] Supabase persistence: `createPost` pass-through is ready; requires DB column and policies applied.
  - File: `src/providers/SimpleSupabaseProvider.tsx` (insert passthrough)
  - Action: Apply SQL migration (see below) and verify `posts_with_stats` view exposes the column.

### Pending
- [ ] PostsFeed: Add `premiumFilter` state (`'all'|'free'|'premium'`) and filter buttons (Home mode).
  - File: `src/components/home/PostsFeed.js`
  - Implement visibility rules:
    - Premium posts hidden from non-Pro users.
    - Exception: post owner always sees their own premium posts.
- [ ] PostsFeed: Support `showOnlyPremium` prop for Profile premium tab.
- [ ] Profile page: Add "Premium Posts" tab (visible only to Pro users) that renders a `PostsFeed` with `showOnlyPremium={true}`.
  - File: `src/app/profile/page.js`
- [ ] Styling: Ensure CSS classes for premium badge exist (e.g., `.premiumBadge`, `.headerBadges`).
  - File: `src/styles/home/PostsFeed.module.css`
- [ ] Tests (light): creation, visibility (Free vs Pro vs Owner), filter behavior, and UI states.

---

## File Changes & References
- `src/models/Post.ts`: Added `is_premium_only` to `Post` and `PostModel` (constructor defaults to `false`).
- `src/providers/CreatePostFormProvider.tsx`: Added `isPremiumOnly` boolean to form state and `initialState`.
- `src/components/posts/CreatePostForm.js`:
  - UI checkbox (Pro-only) to toggle `isPremiumOnly`.
  - `postData` includes `is_premium_only: Boolean(isPremiumOnly)`.
- `src/components/posts/PostCard.js`: Show Premium badge when `post.is_premium_only` is `true`.
- `src/providers/SimpleSupabaseProvider.tsx`: `createPost` inserts `postData` as-is (requires DB column).

---

## App State Inventory (Premium Feature)

### Data Model
- `Post.is_premium_only: boolean` (default `false`)
  - File: `src/models/Post.ts`

### Create Post (Provider/Component)
- `CreatePostFormProvider` state
  - `isPremiumOnly: boolean` — premium-only flag for the new post
  - File: `src/providers/CreatePostFormProvider.tsx`
- `CreatePostForm` local/derived
  - `isPublic: boolean` (local UI state)
  - `isPremiumOnly: boolean` (from provider, bound to checkbox)
  - `subscription?.plan_name: 'free'|'pro'|...` (from Subscription context)
  - `isPro: boolean` convenience flag (from Subscription context)
  - File: `src/components/posts/CreatePostForm.js`

### Subscription Context
- `subscriptionInfo.plan_name: string` (e.g., 'free' or 'pro')
- `isPro: boolean` — computed from `plan_name === 'pro'`
- `isProPlan(): boolean` — helper function
- File: `src/providers/SubscriptionProvider.js`

### Post Card
- Uses `post.is_premium_only` to render the premium badge
- File: `src/components/posts/PostCard.js`

### Posts Feed (to be added)
- `premiumFilter: 'all'|'free'|'premium'` — state to filter the feed
- `showOnlyPremium?: boolean` — prop for Profile premium tab
- Exception rule: owner sees their own premium posts regardless of plan
- File: `src/components/home/PostsFeed.js`

### Profile Page (to be added)
- `activeTab: 'posts'|'strategies'|'telegram'|...` — existing; add "premium" for Pro users
- File: `src/app/profile/page.js`

### Background Creation Flow
- Pass-through of `postData` including `is_premium_only`:
  - `CreatePostForm` → `BackgroundPostCreationProvider` → `PostProvider` → `SimpleSupabaseProvider.createPost`
- Files: `src/components/posts/CreatePostForm.js`, `src/providers/BackgroundPostCreationProvider.tsx`, `src/providers/PostProvider.tsx`, `src/providers/SimpleSupabaseProvider.tsx`

---

## Database Migration Checklist
- Apply SQL script to add column and policies:
  - File: `SQL _CODE/premium_posts BROKER/premium_posts_feature.sql`
  - Includes:
    - `ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_premium_only BOOLEAN DEFAULT FALSE;`
    - Index on `is_premium_only` for premium filtering
    - RLS policy: premium visible to owner and active Pro subscribers
- Verify `posts_with_stats` (if view) includes `is_premium_only` so UI can read it from the feed query.

---

## Filtering Rules (Required)
- Free users:
  - See public (non-premium) posts only
  - Do NOT see other users' premium posts
- Pro users:
  - See all posts including premium
- Post owner:
  - Always sees their own posts (free and premium)

---

## Test Plan (Light)
- Create a free post as Free user; verify visibility for all
- Create a premium post as Pro; verify owner sees it, Pro users see it, Free users do not
- Home feed filter buttons: All / Free / Premium switch datasets correctly
- Profile Premium tab shows only premium posts for the profile owner (Pro only)
- Badge renders on premium posts only

---

## Notes
- The `createPost` integration already passes any provided fields; the DB column and RLS must exist to avoid insert errors.
- Consider adding minimal CSS for premium badge:
  - `.headerBadges { display: flex; gap: 8px; align-items: center; }`
  - `.premiumBadge { background: #fef3c7; color: #f59e0b; padding: 4px 8px; border-radius: 6px; font-weight: 600; display: inline-flex; gap: 6px; align-items: center; }`
