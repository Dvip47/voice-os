-- Voice Runtime System Persistence Schema
-- PostgreSQL Version 15+

-- Tenants
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  api_key TEXT UNIQUE NOT NULL,
  monthly_quota INTEGER DEFAULT 1000,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Call Jobs Execution Log
CREATE TABLE IF NOT EXISTS call_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  job_id TEXT UNIQUE NOT NULL,
  phone_number TEXT NOT NULL,
  status TEXT DEFAULT 'queued', -- queued, calling, completed, failed
  context JSONB NOT NULL,
  transcript JSONB DEFAULT '[]',
  duration_seconds INTEGER DEFAULT 0,
  cost_estimate DECIMAL(10, 4) DEFAULT 0.00,
  webhook_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for performance
CREATE INDEX idx_job_status ON call_jobs(status);
CREATE INDEX idx_job_tenant ON call_jobs(tenant_id);
