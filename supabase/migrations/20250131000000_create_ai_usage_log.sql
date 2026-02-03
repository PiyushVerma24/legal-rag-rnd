-- Create AI Usage Log table for comprehensive tracking
CREATE TABLE IF NOT EXISTS hfnai_ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User information
  preceptor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id UUID,

  -- Query information
  query_text TEXT NOT NULL,
  response_preview TEXT,

  -- Model and token tracking
  model_used TEXT NOT NULL,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  token_count INTEGER DEFAULT 0, -- Legacy field, kept for compatibility

  -- Cost tracking
  cost_usd DECIMAL(10, 6) DEFAULT 0,

  -- Document tracking
  documents_used TEXT[], -- Array of document titles used

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', NOW()),

  -- Indexes for performance
  CONSTRAINT ai_usage_log_total_tokens_check CHECK (total_tokens >= 0)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_preceptor_id ON hfnai_ai_usage_log(preceptor_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_created_at ON hfnai_ai_usage_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_model_used ON hfnai_ai_usage_log(model_used);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_session_id ON hfnai_ai_usage_log(session_id);

-- Create RLS policies
ALTER TABLE hfnai_ai_usage_log ENABLE ROW LEVEL SECURITY;

-- Admin can see all logs
CREATE POLICY "Admins can view all AI usage logs"
  ON hfnai_ai_usage_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email LIKE '%admin%'
    )
  );

-- Users can see their own logs
CREATE POLICY "Users can view their own AI usage logs"
  ON hfnai_ai_usage_log
  FOR SELECT
  USING (preceptor_id = auth.uid());

-- Service role can insert (for backend logging)
CREATE POLICY "Service can insert AI usage logs"
  ON hfnai_ai_usage_log
  FOR INSERT
  WITH CHECK (true);

-- Create a view for easy cost analysis
CREATE OR REPLACE VIEW hfnai_ai_usage_summary AS
SELECT
  DATE(created_at) as date,
  model_used,
  COUNT(*) as query_count,
  SUM(total_tokens) as total_tokens,
  SUM(cost_usd) as total_cost_usd,
  AVG(total_tokens) as avg_tokens_per_query,
  AVG(cost_usd) as avg_cost_per_query
FROM hfnai_ai_usage_log
GROUP BY DATE(created_at), model_used
ORDER BY date DESC, total_cost_usd DESC;

-- Grant access to the view
GRANT SELECT ON hfnai_ai_usage_summary TO authenticated;

-- Add helpful comment
COMMENT ON TABLE hfnai_ai_usage_log IS 'Comprehensive AI usage tracking for cost monitoring, analytics, and auditing';
