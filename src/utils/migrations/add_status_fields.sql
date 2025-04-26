-- Migration script to add status fields to posts table
-- Run this script if you have an existing database without these fields

-- Add postDateAfterPriceDate field if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='posts' AND column_name='postdateafterpricedate') THEN
    ALTER TABLE posts ADD COLUMN postDateAfterPriceDate BOOLEAN DEFAULT FALSE;
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
    ALTER TABLE posts ADD COLUMN postAfterMarketClose BOOLEAN DEFAULT FALSE;
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
    ALTER TABLE posts ADD COLUMN noDataAvailable BOOLEAN DEFAULT FALSE;
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
    ALTER TABLE posts ADD COLUMN status_message TEXT;
    RAISE NOTICE 'Added status_message column to posts table';
  ELSE
    RAISE NOTICE 'status_message column already exists';
  END IF;
END $$; 