CREATE TABLE IF NOT EXISTS domains (
  id BIGSERIAL PRIMARY KEY,
  raw TEXT NOT NULL,                 -- whatever was in the CSV cell
  domain TEXT NOT NULL,              -- normalized domain
  has_mx BOOLEAN NOT NULL,
  mx JSONB NOT NULL,                 -- array of {exchange, priority}
  spf TEXT,                          -- TXT record that looked like SPF
  dmarc TEXT,                        -- value of _dmarc.<domain>
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Helpful index when you grow
CREATE INDEX IF NOT EXISTS idx_domains_domain ON domains (domain);