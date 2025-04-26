# Database Migration Guide

This guide provides instructions for updating your Supabase database schema to add status fields to the posts table.

## Status Fields

The following status fields have been added to the `posts` table:

- `postDateAfterPriceDate` (boolean): Indicates if a post was created after the latest price data
- `postAfterMarketClose` (boolean): Indicates if a post was created after market close
- `noDataAvailable` (boolean): Indicates if no price data was available for the stock
- `status_message` (text): Contains a human-readable message about the post status

These fields are required for proper price checking functionality and post status display.

## Migration Options

You have three options to run the migration:

### Option 1: Run the Migration Script

Run the provided migration script that will add the missing columns to your database:

1. Make sure you have the required environment variables set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (this is the admin key, not the anon key)

2. Run the migration script:
   ```bash
   node src/scripts/update-schema.js
   ```

### Option 2: Use the Admin API Endpoint

1. Add a secure `ADMIN_SECRET_TOKEN` environment variable.

2. First, create the helper functions by making a POST request to:
   ```
   POST /api/admin/check-db-schema
   ```
   With the header: `x-admin-token: YOUR_ADMIN_SECRET_TOKEN`

3. Then check and update the schema by making a GET request to:
   ```
   GET /api/admin/check-db-schema?token=YOUR_ADMIN_SECRET_TOKEN
   ```

### Option 3: Run SQL Directly in Supabase

1. Open the Supabase dashboard and go to the SQL Editor.

2. Run the following SQL:

```sql
-- Add postDateAfterPriceDate field if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='posts' AND column_name='postdateafterpricedate') THEN
    ALTER TABLE posts ADD COLUMN "postDateAfterPriceDate" BOOLEAN DEFAULT FALSE;
    RAISE NOTICE 'Added postDateAfterPriceDate column to posts table';
  ELSE
    RAISE NOTICE 'postDateAfterPriceDate column already exists';
  END IF;
END $$;

-- Add postAfterMarketClose field if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='posts' AND column_name='postaftermarketclose') THEN
    ALTER TABLE posts ADD COLUMN "postAfterMarketClose" BOOLEAN DEFAULT FALSE;
    RAISE NOTICE 'Added postAfterMarketClose column to posts table';
  ELSE
    RAISE NOTICE 'postAfterMarketClose column already exists';
  END IF;
END $$;

-- Add noDataAvailable field if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='posts' AND column_name='nodataavailable') THEN
    ALTER TABLE posts ADD COLUMN "noDataAvailable" BOOLEAN DEFAULT FALSE;
    RAISE NOTICE 'Added noDataAvailable column to posts table';
  ELSE
    RAISE NOTICE 'noDataAvailable column already exists';
  END IF;
END $$;

-- Add status_message field if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='posts' AND column_name='status_message') THEN
    ALTER TABLE posts ADD COLUMN "status_message" TEXT;
    RAISE NOTICE 'Added status_message column to posts table';
  ELSE
    RAISE NOTICE 'status_message column already exists';
  END IF;
END $$;
```

## Verification

After running the migration, you can verify that the columns were added successfully by:

1. Checking the Supabase Table Editor for the `posts` table
2. Running a SQL query:
   ```sql
   SELECT 
     column_name 
   FROM 
     information_schema.columns 
   WHERE 
     table_name = 'posts' AND 
     column_name IN ('postdateafterpricedate', 'postaftermarketclose', 'nodataavailable', 'status_message');
   ```

## Troubleshooting

If you encounter any issues during migration:

1. Make sure you have admin/service role access to your Supabase project
2. Check the Supabase logs for any SQL errors
3. Ensure your environment variables are correctly set
4. If you're using the script or API, make sure you have installed all required npm packages 