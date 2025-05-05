# User Model

This directory contains TypeScript model definitions that match the database schema.

## User.ts

The `User.ts` file defines the interface for user profiles in the application. The structure matches the `profiles` table in the Supabase database.

### User Interface Fields

```typescript
export interface User {
  id: string;               // Primary key, matches auth.users.id
  username: string;         // User's display name
  full_name: string | null; // User's full name (optional)
  avatar_url: string | null; // URL to user's avatar image
  bio: string | null;       // User's biography or description
  website: string | null;   // User's website URL
  favorite_markets: string[] | null; // Array of favorite market symbols
  created_at: string;       // ISO timestamp of profile creation
  updated_at: string | null; // ISO timestamp of last profile update
  email: string | null;     // User's email address
  last_sign_in: string | null; // ISO timestamp of last login
  success_posts: number;    // Count of successful trade posts
  loss_posts: number;       // Count of unsuccessful trade posts
  background_url: string | null; // URL to user's profile background image
  experience_Score: number; // User's experience score (calculated from posts)
  followers: number | null; // Count of followers
  following: number | null; // Count of users being followed
}
```

### Auto-Profile Creation

When a new user signs up, their profile record is automatically created in three ways:

1. **Database Trigger**: The SQL trigger in `supabase/migrations/20250505_create_profile_trigger.sql` creates profiles automatically when new users are created in `auth.users`.

2. **Client-Side Fallback**: The `signUp` functions in both `src/utils/supabase.js` and `src/providers/SupabaseProvider.tsx` contain logic to create profiles if they don't exist.

3. **Helper Function**: The `createDefaultUser` function in `User.ts` provides a utility to create default user objects.

## Keeping Models in Sync with Database

When you modify the database schema, make sure to update:

1. The `User.ts` interface
2. The SQL trigger in `supabase/migrations/20250505_create_profile_trigger.sql`
3. The profile creation logic in the auth providers

This ensures data consistency across the application. 