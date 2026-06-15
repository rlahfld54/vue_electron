const { Pool } = require('pg')

let pool

function getPool() {
  if (!pool) {
    pool = new Pool({
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT || 5432),
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || undefined,
      database: process.env.PGDATABASE || 'vue_electron',
      max: 5,
      connectionTimeoutMillis: 3000
    })
  }

  return pool
}

function money(value) {
  return `${Number(value || 0).toLocaleString('ko-KR')}원`
}

function plainMoney(value) {
  return Number(value || 0).toLocaleString('ko-KR')
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
  const result = await getPool().query(sql, params)
  return result.rows
}

async function getRawRows() {
  const rows = await runQuery(`
    SELECT
      r.id,
      r.row_number,
      r.customer_name,
      r.product_name,
      r.quantity,
      r.unit_price,
      r.amount,
      r.row_status
    FROM sales_closing_rows r
    JOIN closing_batches b ON b.id = r.batch_id
    WHERE b.batch_no = $1
    ORDER BY r.row_number ASC
  `, ['CL-2026-06-001'])

  return rows.map((row) => ({
    id: row.id,
    rowNumber: row.row_number,
    customer: row.customer_name,
    product: row.product_name,
    quantity: Number(row.quantity),
    unitPrice: plainMoney(row.unit_price),
    amount: plainMoney(row.amount),
    status: statusLabel(row.row_status),
    tone: statusTone(row.row_status)
  }))
}

async function addSampleRow() {
  await runQuery(`
    WITH batch AS (
      SELECT id FROM closing_batches WHERE batch_no = $1
    ),
    customer AS (
      SELECT id, name, closing_day FROM customers WHERE code = $2
    ),
    product AS (
      SELECT id, name, unit_price FROM products WHERE code = $3
    )
    INSERT INTO sales_closing_rows (
      batch_id,
      customer_id,
      product_id,
      row_number,
      customer_name,
      product_name,
      quantity,
      unit_price,
      amount,
      tax_invoice_amount,
      closing_day,
      row_status,
      memo
    )
    SELECT
      batch.id,
      customer.id,
      product.id,
      COALESCE((SELECT MAX(row_number) + 1 FROM sales_closing_rows WHERE batch_id = batch.id), 1),
      customer.name,
      product.name,
      6,
      product.unit_price,
      8240000,
      8240000,
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
  getValidationIssues,
  runValidation,
  saveSqlSnapshot
}
