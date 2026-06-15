const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

let pool
let envLoaded = false

function loadLocalEnv() {
  if (envLoaded) return
  envLoaded = true

  const envPath = path.join(__dirname, '..', 'db', 'local.env')
  if (!fs.existsSync(envPath)) return

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
  lines.forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex < 1) return

    const key = trimmed.slice(0, separatorIndex).trim()
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '')

    if (!process.env[key]) {
      process.env[key] = value
    }
  })
}

function getDbConfig() {
  loadLocalEnv()

  return {
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'postgres',
    password: String(process.env.PGPASSWORD ?? ''),
    database: process.env.PGDATABASE || 'vue_electron',
    max: 5,
    connectionTimeoutMillis: 3000
  }
}

function getPool() {
  if (!pool) {
    pool = new Pool(getDbConfig())
  }

  return pool
}

function money(value) {
  return `${Number(value || 0).toLocaleString('ko-KR')}원`
}

function plainMoney(value) {
  return Number(value || 0).toLocaleString('ko-KR')
}

function dateText(value) {
  if (!value) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).slice(0, 10)
}

function statusLabel(status) {
  const labels = {
    REJECTED: '반려',
    REVIEW: '확인 필요',
    READY: '정상',
    SENT: '발송 완료'
  }

  return labels[status] || status
}

function statusTone(status) {
  const tones = {
    REJECTED: 'red',
    REVIEW: 'amber',
    READY: 'green',
    SENT: 'green'
  }

  return tones[status] || 'gray'
}

function severityTone(severity) {
  const tones = {
    RED: 'red',
    AMBER: 'amber',
    GREEN: 'green',
    BLUE: 'blue'
  }

  return tones[severity] || 'gray'
}

async function runQuery(sql, params = []) {
  try {
    const result = await getPool().query(sql, params)
    return result.rows
  } catch (error) {
    if (error.message?.includes('SASL') || error.message?.includes('password authentication failed')) {
      throw new Error('PostgreSQL 인증에 실패했습니다. db/local.env 파일의 PGUSER, PGPASSWORD, PGDATABASE 값을 확인해주세요.')
    }

    throw error
  }
}

async function getRawRows() {
  const rows = await runQuery(`
    SELECT
      r.id,
      r.row_number,
      r.transaction_date,
      r.customer_name,
      r.customer_code,
      r.product_name,
      r.product_code,
      r.quantity,
      r.unit_price,
      r.amount,
      r.owner_name,
      r.department_name,
      r.evidence_number,
      r.tax_invoice_number,
      r.approval_status,
      r.row_status
    FROM sales_closing_rows r
    JOIN closing_batches b ON b.id = r.batch_id
    WHERE b.batch_no = $1
    ORDER BY r.row_number ASC
  `, ['CL-2026-06-001'])

  return rows.map((row) => ({
    id: row.id,
    rowNumber: row.row_number,
    transactionDate: dateText(row.transaction_date),
    customer: row.customer_name,
    customerCode: row.customer_code,
    product: row.product_name,
    productCode: row.product_code,
    quantity: Number(row.quantity),
    unitPrice: plainMoney(row.unit_price),
    amount: plainMoney(row.amount),
    owner: row.owner_name,
    department: row.department_name,
    evidenceNumber: row.evidence_number,
    taxInvoiceNumber: row.tax_invoice_number,
    approvalStatus: row.approval_status,
    status: statusLabel(row.row_status),
    tone: statusTone(row.row_status)
  }))
}

async function getUploadTemplates() {
  const rows = await runQuery(`
    SELECT
      t.id,
      t.title,
      t.description,
      t.file_name,
      t.target_menu,
      t.rules,
      t.sample_rows,
      c.column_name,
      c.column_role,
      c.column_order
    FROM excel_upload_templates t
    LEFT JOIN excel_upload_template_columns c ON c.template_id = t.id
    WHERE t.status = 'ACTIVE'
    ORDER BY t.id, c.column_order ASC
  `)

  const templates = new Map()

  rows.forEach((row) => {
    if (!templates.has(row.id)) {
      templates.set(row.id, {
        id: row.id,
        title: row.title,
        description: row.description,
        fileName: row.file_name,
        targetMenu: row.target_menu,
        requiredColumns: [],
        optionalColumns: [],
        rules: Array.isArray(row.rules) ? row.rules : [],
        sampleRows: Array.isArray(row.sample_rows) ? row.sample_rows : []
      })
    }

    const template = templates.get(row.id)
    if (row.column_name && row.column_role === 'REQUIRED') {
      template.requiredColumns.push(row.column_name)
    }
    if (row.column_name && row.column_role === 'OPTIONAL') {
      template.optionalColumns.push(row.column_name)
    }
  })

  return [...templates.values()]
}

async function addSampleRow() {
  await runQuery(`
    WITH batch AS (
      SELECT id FROM closing_batches WHERE batch_no = $1
    ),
    customer AS (
      SELECT id, code, name, closing_day FROM customers WHERE code = $2
    ),
    product AS (
      SELECT id, code, name, unit_price FROM products WHERE code = $3
    )
    INSERT INTO sales_closing_rows (
      batch_id,
      customer_id,
      product_id,
      row_number,
      transaction_date,
      customer_name,
      customer_code,
      product_name,
      product_code,
      quantity,
      unit_price,
      amount,
      tax_invoice_amount,
      owner_name,
      department_name,
      evidence_number,
      tax_invoice_number,
      approval_status,
      closing_day,
      row_status,
      memo
    )
    SELECT
      batch.id,
      customer.id,
      product.id,
      COALESCE((SELECT MAX(row_number) + 1 FROM sales_closing_rows WHERE batch_id = batch.id), 1),
      CURRENT_DATE,
      customer.name,
      customer.code,
      product.name,
      product.code,
      6,
      product.unit_price,
      8240000,
      8240000,
      '박지훈',
      '매출관리팀',
      'EV-202606-ADD',
      'TX-202606-ADD',
      '확인',
      customer.closing_day,
      'REVIEW',
      '추가 업로드 품목 확인'
    FROM batch, customer, product
  `, ['CL-2026-06-001', 'C-5088', 'P-X500'])

  return getRawRows()
}

async function runValidation() {
  await runQuery(`
    UPDATE sales_closing_rows
    SET row_status = 'READY', updated_at = now()
    WHERE row_status = 'REVIEW'
      AND batch_id = (SELECT id FROM closing_batches WHERE batch_no = $1)
  `, ['CL-2026-06-001'])

  return getRawRows()
}

async function saveSqlSnapshot() {
  const rows = await runQuery(`
    INSERT INTO sync_outbox (entity_name, entity_id, action_type, payload, sync_status)
    SELECT
      'sales_closing_rows',
      r.id,
      'UPSERT',
      jsonb_build_object(
        'customer_name', r.customer_name,
        'product_name', r.product_name,
        'amount', r.amount,
        'row_status', r.row_status
      ),
      'PENDING'
    FROM sales_closing_rows r
    JOIN closing_batches b ON b.id = r.batch_id
    WHERE b.batch_no = $1
      AND r.row_status <> 'REJECTED'
    RETURNING id
  `, ['CL-2026-06-001'])

  return { savedCount: rows.length }
}

async function getValidationIssues() {
  const rows = await runQuery(`
    SELECT
      i.id,
      r.row_number,
      i.issue_type,
      i.action_type,
      i.severity,
      i.message
    FROM validation_issues i
    JOIN sales_closing_rows r ON r.id = i.row_id
    JOIN closing_batches b ON b.id = r.batch_id
    WHERE b.batch_no = $1
    ORDER BY r.row_number ASC
  `, ['CL-2026-06-001'])

  return rows.map((row) => ({
    id: row.id,
    rowNumber: row.row_number,
    type: row.issue_type,
    action: row.action_type === 'REJECT' ? '반려' : '재확인',
    severity: severityTone(row.severity),
    message: row.message
  }))
}

async function getClosingQueue() {
  const rows = await runQuery(`
    SELECT
      c.id,
      c.name,
      c.manager_name,
      c.closing_day,
      c.default_channel,
      c.manager_email,
      r.memo,
      r.amount,
      r.row_status,
      mq.queue_status,
      mq.sent_at,
      COALESCE(
        json_agg(
          json_build_object(
            'fileType', a.file_type,
            'fileName', a.file_name,
            'fileSizeBytes', a.file_size_bytes
          )
          ORDER BY a.file_type
        ) FILTER (WHERE a.id IS NOT NULL),
        '[]'
      ) AS attachments
    FROM mail_queue mq
    JOIN customers c ON c.id = mq.customer_id
    JOIN closing_batches b ON b.id = mq.batch_id
    LEFT JOIN sales_closing_rows r ON r.batch_id = b.id AND r.customer_id = c.id
    LEFT JOIN mail_attachments a ON a.mail_queue_id = mq.id
    WHERE b.batch_no = $1
    GROUP BY c.id, c.name, c.manager_name, c.closing_day, c.default_channel, c.manager_email,
      r.memo, r.amount, r.row_status, mq.queue_status, mq.sent_at
    ORDER BY c.closing_day ASC, c.name ASC
  `, ['CL-2026-06-001'])

  return rows.map((row) => {
    const attachments = row.attachments || []
    const xlsx = attachments.find((item) => item.fileType === 'XLSX')
    const pdf = attachments.find((item) => item.fileType === 'PDF')

    return {
      id: row.id,
      name: row.name,
      owner: row.manager_name,
      due: `${row.closing_day}일`,
      type: row.memo || statusLabel(row.row_status),
      tone: statusTone(row.row_status),
      lastContact: row.sent_at ? new Date(row.sent_at).toLocaleString('ko-KR') : '없음',
      amount: money(row.amount),
      channel: row.default_channel === 'KAKAO' ? '카톡 문구 복사' : '메일 발송',
      email: row.manager_email,
      xlsx: xlsx?.fileName || `${row.name}_${row.closing_day}일_마감요청.xlsx`,
      pdf: pdf?.fileName || `${row.name}_${row.closing_day}일_마감요청.pdf`,
      xlsxSize: `${Math.round((xlsx?.fileSizeBytes || 0) / 1024)} KB`,
      pdfSize: `${Math.round((pdf?.fileSizeBytes || 0) / 1024)} KB`
    }
  })
}

async function closePool() {
  if (pool) {
    await pool.end()
    pool = undefined
  }
}

module.exports = {
  addSampleRow,
  closePool,
  getClosingQueue,
  getRawRows,
  getUploadTemplates,
  getValidationIssues,
  runValidation,
  saveSqlSnapshot
}
