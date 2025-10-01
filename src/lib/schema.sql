-- Create domains table if it doesn't exist
CREATE TABLE IF NOT EXISTS domains (
  id BIGSERIAL PRIMARY KEY,
  raw TEXT NOT NULL,                 -- whatever was in the CSV cell
  domain TEXT NOT NULL,              -- normalized domain
  has_mx BOOLEAN NOT NULL DEFAULT FALSE,
  mx JSONB NOT NULL DEFAULT '[]'::jsonb,  -- array of {exchange, priority}
  spf TEXT,                          -- TXT record that looked like SPF
  dmarc TEXT,                        -- value of _dmarc.<domain>
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index if it doesn't exist (for faster domain lookups)
CREATE INDEX IF NOT EXISTS idx_domains_domain ON domains (domain);
CREATE INDEX IF NOT EXISTS idx_domains_created_at ON domains (created_at);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS update_domains_updated_at ON domains;
CREATE TRIGGER update_domains_updated_at
    BEFORE UPDATE ON domains
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();