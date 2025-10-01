-- Create domains table if it doesn't exist
CREATE TABLE IF NOT EXISTS domains (
  id BIGSERIAL PRIMARY KEY,
  raw TEXT NOT NULL,                 -- whatever was in the CSV cell
  domain TEXT NOT NULL,              -- normalized domain
  has_mx BOOLEAN NOT NULL DEFAULT FALSE,
  mx JSONB NOT NULL DEFAULT '[]'::jsonb,  -- array of {exchange, priority}
  spf TEXT,                          -- TXT record that looked like SPF
  dmarc TEXT,                        -- value of _dmarc.<domain>
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index if it doesn't exist (for faster domain lookups)
CREATE INDEX IF NOT EXISTS idx_domains_domain ON domains (domain);