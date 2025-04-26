-- Create a table to log all database operations for debugging purposes
CREATE TABLE IF NOT EXISTS operation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operation_type TEXT NOT NULL,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  status TEXT,
  success BOOLEAN,
  error_message TEXT,
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_operation_logs_post_id ON operation_logs(post_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_operation_type ON operation_logs(operation_type);
CREATE INDEX IF NOT EXISTS idx_operation_logs_created_at ON operation_logs(created_at);

-- RLS policy to allow the service role to insert logs
ALTER TABLE operation_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role can insert logs" ON operation_logs;

-- Create policy for service role to insert logs
CREATE POLICY "Service role can insert logs"
  ON operation_logs FOR INSERT
  WITH CHECK (true);

-- Create policy for authenticated users to view their own logs
CREATE POLICY "Users can view their own logs"
  ON operation_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = operation_logs.post_id
      AND posts.user_id = auth.uid()
    )
  ); 