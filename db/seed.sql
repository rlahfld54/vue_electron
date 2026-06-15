WITH sales_dept AS (
  INSERT INTO departments (name, description)
  VALUES ('매출관리팀', '마감 데이터 수집, 검증, 발송 큐를 관리합니다.')
  ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, updated_at = now()
  RETURNING id
),
support_dept AS (
  INSERT INTO departments (name, description)
  VALUES ('영업지원팀', '거래처 연락과 마감 요청 메일을 지원합니다.')
  ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, updated_at = now()
  RETURNING id
),
manager_user AS (
  INSERT INTO app_users (department_id, name, email, role)
  SELECT sales_dept.id, '박지훈', 'rlahfld54@gmail.com', 'MANAGER'
  FROM sales_dept
  ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, updated_at = now()
  RETURNING id
),
staff_user AS (
  INSERT INTO app_users (department_id, name, email, role)
  SELECT support_dept.id, '황주은', 'closing-support@example.com', 'STAFF'
  FROM support_dept
  ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, updated_at = now()
  RETURNING id
),
customer_seed AS (
  INSERT INTO customers (code, name, manager_name, manager_email, phone, closing_day, default_channel)
  VALUES
    ('C-1024', '모블상사', '강소영 대리', 'admin@moble.example', '02-1000-1024', 10, 'EMAIL'),
    ('C-2041', '그린물류', '서가온 팀장', 'tax@greenlog.example', '02-1000-2041', 25, 'EMAIL'),
    ('C-3077', '청담리테일', '윤나라 과장', 'closing@cheongdam.example', '02-1000-3077', 25, 'KAKAO'),
    ('C-4112', '서울컴퍼니', '문하린 차장', 'finance@seoulcp.example', '02-1000-4112', 30, 'EMAIL'),
    ('C-5088', '다원문구', '최유진 매니저', 'purchase@dawon.example', '02-1000-5088', 10, 'EMAIL'),
    ('C-6093', '코리아비즈', '이현우 팀장', 'account@koreabiz.example', '02-1000-6093', 25, 'KAKAO')
  ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    manager_name = EXCLUDED.manager_name,
    manager_email = EXCLUDED.manager_email,
    phone = EXCLUDED.phone,
    closing_day = EXCLUDED.closing_day,
    default_channel = EXCLUDED.default_channel,
    updated_at = now()
  RETURNING id, code
),
product_seed AS (
  INSERT INTO products (code, name, unit_price)
  VALUES
    ('P-A100', 'A-패키지', 1637500),
    ('P-S200', '정산상품', 2159000),
    ('P-M300', '월간정산', 4482500),
    ('P-O400', '문구세트', 1240000),
    ('P-X500', '추가 업로드 품목', 1373333),
    ('P-B600', 'B2B 정기관리', 2890000)
  ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    unit_price = EXCLUDED.unit_price,
    updated_at = now()
  RETURNING id, code
),
batch_seed AS (
  INSERT INTO closing_batches (batch_no, title, closing_month, status, uploaded_file_name, created_by)
  SELECT 'CL-2026-06-001', '2026년 6월 매출 마감 수집', '2026-06', 'VALIDATING', 'sample_sales_1200.xlsx', manager_user.id
  FROM manager_user
  ON CONFLICT (batch_no) DO UPDATE SET
    title = EXCLUDED.title,
    status = EXCLUDED.status,
    uploaded_file_name = EXCLUDED.uploaded_file_name,
    updated_at = now()
  RETURNING id
),
row_seed AS (
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
  SELECT batch_seed.id, customers.id, products.id, row_data.row_number, customers.name, products.name,
    row_data.quantity, row_data.unit_price, row_data.amount, row_data.tax_invoice_amount,
    customers.closing_day, row_data.row_status, row_data.memo
  FROM batch_seed
  JOIN (
    VALUES
      ('C-1024', 'P-A100', 14, 12::numeric, 1637500::numeric, 19650000::numeric, 19650000::numeric, 'REJECTED', '금액 확인 재연락'),
      ('C-2041', 'P-S200', 37, 20::numeric, 2159000::numeric, 43180000::numeric, 42800000::numeric, 'REVIEW', '세금계산서 차이 확인'),
      ('C-3077', 'P-O400', 52, 10::numeric, 1240000::numeric, 12400000::numeric, 12400000::numeric, 'READY', '카톡 문구 복사'),
      ('C-4112', 'P-M300', 88, 8::numeric, 4482500::numeric, 35860000::numeric, 35860000::numeric, 'READY', '마감장 최초 발송'),
      ('C-5088', 'P-X500', 103, 6::numeric, 1373333::numeric, 8240000::numeric, 8240000::numeric, 'REVIEW', '추가 업로드 품목 확인'),
      ('C-6093', 'P-B600', 117, 10::numeric, 2890000::numeric, 28900000::numeric, 28900000::numeric, 'READY', '카톡 문구 복사')
  ) AS row_data(customer_code, product_code, row_number, quantity, unit_price, amount, tax_invoice_amount, row_status, memo)
    ON true
  JOIN customers ON customers.code = row_data.customer_code
  JOIN products ON products.code = row_data.product_code
  WHERE NOT EXISTS (
    SELECT 1
    FROM sales_closing_rows existing
    WHERE existing.batch_id = batch_seed.id
      AND existing.row_number = row_data.row_number
  )
  RETURNING id, row_number, row_status
),
issue_seed AS (
  INSERT INTO validation_issues (row_id, issue_type, severity, action_type, message)
  SELECT sales_closing_rows.id, issue_data.issue_type, issue_data.severity, issue_data.action_type, issue_data.message
  FROM sales_closing_rows
  JOIN closing_batches ON closing_batches.id = sales_closing_rows.batch_id
  JOIN (
    VALUES
      (14, '금액 확인 재연락', 'AMBER', 'REVIEW', '이전 전달 마감 금액 확인이 아직 완료되지 않았습니다.'),
      (37, '세금계산서 차이 확인', 'RED', 'REJECT', '마감 확정 금액과 세금계산서 금액 차이가 확인되었습니다.'),
      (103, '품목코드 누락', 'AMBER', 'REVIEW', '추가 업로드 품목의 기준정보 매칭 확인이 필요합니다.')
  ) AS issue_data(row_number, issue_type, severity, action_type, message)
    ON issue_data.row_number = sales_closing_rows.row_number
  WHERE closing_batches.batch_no = 'CL-2026-06-001'
    AND NOT EXISTS (
      SELECT 1
      FROM validation_issues existing
      WHERE existing.row_id = sales_closing_rows.id
        AND existing.issue_type = issue_data.issue_type
    )
  RETURNING id
),
mail_seed AS (
  INSERT INTO mail_queue (batch_id, customer_id, recipient_email, subject, body, queue_status, send_channel)
  SELECT
    closing_batches.id,
    customers.id,
    customers.manager_email,
    customers.name || ' ' || sales_closing_rows.memo || ' 의 건',
    customers.name || ' 관리팀 ' || customers.manager_name || E'님\n안녕하세요. 총무팀 황주은 사원입니다.\n마감일: ' || customers.closing_day || E'일\n마감 금액: ' || to_char(sales_closing_rows.amount, 'FM999,999,999') || E'원\n확인 유형: ' || sales_closing_rows.memo || E'\n감사합니다.',
    'READY',
    customers.default_channel
  FROM sales_closing_rows
  JOIN closing_batches ON closing_batches.id = sales_closing_rows.batch_id
  JOIN customers ON customers.id = sales_closing_rows.customer_id
  WHERE closing_batches.batch_no = 'CL-2026-06-001'
    AND NOT EXISTS (
      SELECT 1
      FROM mail_queue existing
      WHERE existing.batch_id = closing_batches.id
        AND existing.customer_id = customers.id
    )
  RETURNING id, customer_id
)
INSERT INTO mail_attachments (mail_queue_id, file_type, file_name, file_path, file_size_bytes)
SELECT mail_queue.id, attachment_data.file_type, named_file.file_name, attachment_data.file_path, attachment_data.file_size_bytes
FROM mail_queue
JOIN customers ON customers.id = mail_queue.customer_id
JOIN (
  VALUES
    ('XLSX', '마감요청.xlsx', 'Exports/ClosingAttachments', 7168::bigint),
    ('PDF', '마감요청.pdf', 'Exports/ClosingAttachments', 27648::bigint)
) AS attachment_data(file_type, suffix, file_path, file_size_bytes)
  ON true
CROSS JOIN LATERAL (
  SELECT customers.name || '_' || customers.closing_day || '일_' || attachment_data.suffix AS file_name
) AS named_file
WHERE NOT EXISTS (
  SELECT 1
  FROM mail_attachments existing
  WHERE existing.mail_queue_id = mail_queue.id
    AND existing.file_type = attachment_data.file_type
);

INSERT INTO sync_outbox (entity_name, entity_id, action_type, payload, sync_status)
SELECT 'closing_batches', closing_batches.id, 'UPSERT',
  jsonb_build_object('batch_no', closing_batches.batch_no, 'status', closing_batches.status),
  'PENDING'
FROM closing_batches
WHERE closing_batches.batch_no = 'CL-2026-06-001'
  AND NOT EXISTS (
    SELECT 1
    FROM sync_outbox
    WHERE sync_outbox.entity_name = 'closing_batches'
      AND sync_outbox.entity_id = closing_batches.id
  );
