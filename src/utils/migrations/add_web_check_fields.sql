-- Migration to add web check fields to posts table
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS last_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS last_price_check TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS price_checks JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS target_reached BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS target_reached_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS stop_loss_triggered BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stop_loss_triggered_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS closed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS closed_date TIMESTAMP WITH TIME ZONE;

-- Create indexes for the new fields
CREATE INDEX IF NOT EXISTS idx_posts_target_reached ON posts(target_reached);
CREATE INDEX IF NOT EXISTS idx_posts_stop_loss_triggered ON posts(stop_loss_triggered);
CREATE INDEX IF NOT EXISTS idx_posts_closed ON posts(closed); 