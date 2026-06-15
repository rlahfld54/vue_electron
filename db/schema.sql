CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(80) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID REFERENCES departments(id),
  name VARCHAR(80) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  role VARCHAR(40) NOT NULL DEFAULT 'STAFF',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  manager_name VARCHAR(80),
  manager_email VARCHAR(180),
  phone VARCHAR(40),
  closing_day SMALLINT NOT NULL CHECK (closing_day BETWEEN 1 AND 31),
  default_channel VARCHAR(30) NOT NULL DEFAULT 'EMAIL',
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  unit_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS closing_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_no VARCHAR(40) NOT NULL UNIQUE,
  title VARCHAR(160) NOT NULL,
  closing_month CHAR(7) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  uploaded_file_name VARCHAR(240),
  created_by UUID REFERENCES app_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS sales_closing_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES closing_batches(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  product_id UUID REFERENCES products(id),
  row_number INTEGER NOT NULL,
  customer_name VARCHAR(120) NOT NULL,
  product_name VARCHAR(120) NOT NULL,
  quantity NUMERIC(14, 2) NOT NULL,
  unit_price NUMERIC(14, 2) NOT NULL,
  amount NUMERIC(16, 2) NOT NULL,
  tax_invoice_amount NUMERIC(16, 2),
  closing_day SMALLINT,
  row_status VARCHAR(30) NOT NULL DEFAULT 'READY',
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS validation_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  row_id UUID NOT NULL REFERENCES sales_closing_rows(id) ON DELETE CASCADE,
  issue_type VARCHAR(80) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  action_type VARCHAR(30) NOT NULL,
  message TEXT NOT NULL,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES app_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mail_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES closing_batches(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id),
  recipient_email VARCHAR(180) NOT NULL,
  subject VARCHAR(240) NOT NULL,
  body TEXT NOT NULL,
  queue_status VARCHAR(30) NOT NULL DEFAULT 'READY',
  send_channel VARCHAR(30) NOT NULL DEFAULT 'EMAIL',
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mail_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mail_queue_id UUID NOT NULL REFERENCES mail_queue(id) ON DELETE CASCADE,
  file_type VARCHAR(20) NOT NULL,
  file_name VARCHAR(240) NOT NULL,
  file_path TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sync_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_name VARCHAR(80) NOT NULL,
  entity_id UUID NOT NULL,
  action_type VARCHAR(30) NOT NULL,
  payload JSONB NOT NULL,
  sync_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sales_closing_rows_batch ON sales_closing_rows(batch_id);
CREATE INDEX IF NOT EXISTS idx_sales_closing_rows_customer ON sales_closing_rows(customer_id);
CREATE INDEX IF NOT EXISTS idx_validation_issues_row ON validation_issues(row_id);
CREATE INDEX IF NOT EXISTS idx_mail_queue_batch ON mail_queue(batch_id);
CREATE INDEX IF NOT EXISTS idx_mail_queue_status ON mail_queue(queue_status);
CREATE INDEX IF NOT EXISTS idx_sync_outbox_status ON sync_outbox(sync_status);
