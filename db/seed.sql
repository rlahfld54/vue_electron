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
template_seed AS (
  INSERT INTO excel_upload_templates (id, title, description, file_name, target_menu, rules, sample_rows)
  VALUES
    (
      'sales-closing-source',
      '매출 마감 원본',
      '월별 매출 원본을 업로드해 금액 재계산, 중복 검사, 단가 검증, 보고서 생성에 사용합니다.',
      '매출_마감_원본_양식',
      '마감 자료',
      '[
        "거래일은 YYYY-MM-DD 형식으로 입력합니다.",
        "금액은 수량 × 단가와 일치해야 합니다.",
        "거래처코드와 품목코드는 기준정보 양식의 코드와 맞아야 합니다.",
        "담당자와 부서는 보고서 작성 및 활동 로그 기준으로 사용됩니다."
      ]'::jsonb,
      '[
        ["2026-05-31", "한빛유통", "CUST-001", "A4 복사용지", "PAPER-A4-001", 12, 24500, 294000, "황주은", "총무팀", "정기 구매", "EV-202605-001", "TX-202605-001", "승인"],
        ["2026-05-31", "세종오피스", "CUST-002", "흑백 토너 2108", "TONER-BLK-2108", 3, 78000, 234000, "황주은", "총무팀", "프린터 소모품", "EV-202605-002", "TX-202605-002", "확인"]
      ]'::jsonb
    ),
    (
      'sales-closing-compare',
      '마감 비교 기준',
      '전월/당월 또는 원본/수정본을 비교해 누락, 증감, 금액 차이를 자동 표시합니다.',
      '매출_마감_비교_기준_양식',
      '매출 마감 비교',
      '[
        "기준월은 YYYY-MM 형식으로 입력합니다.",
        "전월/당월 금액 차이와 증감률 계산에 사용됩니다.",
        "확정상태는 미확정, 확정, 보류 중 하나로 입력합니다.",
        "거래처코드와 품목코드가 비어 있으면 이름 기준으로 비교합니다."
      ]'::jsonb,
      '[
        ["2026-05", "한빛유통", "CUST-001", "A4 복사용지", "PAPER-A4-001", 10, 245000, 12, 294000, "황주은", "수량 증가 확인", "미확정"],
        ["2026-05", "세종오피스", "CUST-002", "흑백 토너 2108", "TONER-BLK-2108", 2, 156000, 3, 234000, "황주은", "정상 증가", "확정"]
      ]'::jsonb
    )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    file_name = EXCLUDED.file_name,
    target_menu = EXCLUDED.target_menu,
    rules = EXCLUDED.rules,
    sample_rows = EXCLUDED.sample_rows,
    updated_at = now()
  RETURNING id
),
template_column_seed AS (
  INSERT INTO excel_upload_template_columns (template_id, column_name, column_role, column_order, data_type)
  SELECT *
  FROM (
    VALUES
      ('sales-closing-source', '거래일', 'REQUIRED', 1, 'DATE'),
      ('sales-closing-source', '거래처명', 'REQUIRED', 2, 'TEXT'),
      ('sales-closing-source', '거래처코드', 'REQUIRED', 3, 'TEXT'),
      ('sales-closing-source', '품목명', 'REQUIRED', 4, 'TEXT'),
      ('sales-closing-source', '품목코드', 'REQUIRED', 5, 'TEXT'),
      ('sales-closing-source', '수량', 'REQUIRED', 6, 'NUMBER'),
      ('sales-closing-source', '단가', 'REQUIRED', 7, 'MONEY'),
      ('sales-closing-source', '금액', 'REQUIRED', 8, 'MONEY'),
      ('sales-closing-source', '담당자', 'REQUIRED', 9, 'TEXT'),
      ('sales-closing-source', '부서', 'REQUIRED', 10, 'TEXT'),
      ('sales-closing-source', '비고', 'OPTIONAL', 11, 'TEXT'),
      ('sales-closing-source', '증빙번호', 'OPTIONAL', 12, 'TEXT'),
      ('sales-closing-source', '세금계산서번호', 'OPTIONAL', 13, 'TEXT'),
      ('sales-closing-source', '승인상태', 'OPTIONAL', 14, 'TEXT'),
      ('sales-closing-compare', '기준월', 'REQUIRED', 1, 'MONTH'),
      ('sales-closing-compare', '거래처명', 'REQUIRED', 2, 'TEXT'),
      ('sales-closing-compare', '거래처코드', 'REQUIRED', 3, 'TEXT'),
      ('sales-closing-compare', '품목명', 'REQUIRED', 4, 'TEXT'),
      ('sales-closing-compare', '품목코드', 'REQUIRED', 5, 'TEXT'),
      ('sales-closing-compare', '전월수량', 'REQUIRED', 6, 'NUMBER'),
      ('sales-closing-compare', '전월금액', 'REQUIRED', 7, 'MONEY'),
      ('sales-closing-compare', '당월수량', 'REQUIRED', 8, 'NUMBER'),
      ('sales-closing-compare', '당월금액', 'REQUIRED', 9, 'MONEY'),
      ('sales-closing-compare', '담당자', 'OPTIONAL', 10, 'TEXT'),
      ('sales-closing-compare', '확인메모', 'OPTIONAL', 11, 'TEXT'),
      ('sales-closing-compare', '확정상태', 'OPTIONAL', 12, 'TEXT')
  ) AS columns(template_id, column_name, column_role, column_order, data_type)
  ON CONFLICT (template_id, column_name) DO UPDATE SET
    column_role = EXCLUDED.column_role,
    column_order = EXCLUDED.column_order,
    data_type = EXCLUDED.data_type
  RETURNING id
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
  SELECT batch_seed.id, customers.id, products.id, row_data.row_number, row_data.transaction_date::date, customers.name, customers.code, products.name, products.code,
    row_data.quantity, row_data.unit_price, row_data.amount, row_data.tax_invoice_amount,
    row_data.owner_name, row_data.department_name, row_data.evidence_number, row_data.tax_invoice_number, row_data.approval_status,
    customers.closing_day, row_data.row_status, row_data.memo
  FROM batch_seed
  JOIN (
    VALUES
      ('C-1024', 'P-A100', 14, '2026-05-31', 12::numeric, 1637500::numeric, 19650000::numeric, 19650000::numeric, '박지훈', '매출관리팀', 'EV-202606-001', 'TX-202606-001', '확인', 'REJECTED', '금액 확인 재연락'),
      ('C-2041', 'P-S200', 37, '2026-05-31', 20::numeric, 2159000::numeric, 43180000::numeric, 42800000::numeric, '박지훈', '매출관리팀', 'EV-202606-002', 'TX-202606-002', '보류', 'REVIEW', '세금계산서 차이 확인'),
      ('C-3077', 'P-O400', 52, '2026-05-31', 10::numeric, 1240000::numeric, 12400000::numeric, 12400000::numeric, '황주은', '영업지원팀', 'EV-202606-003', 'TX-202606-003', '승인', 'READY', '카톡 문구 복사'),
      ('C-4112', 'P-M300', 88, '2026-05-31', 8::numeric, 4482500::numeric, 35860000::numeric, 35860000::numeric, '황주은', '영업지원팀', 'EV-202606-004', 'TX-202606-004', '승인', 'READY', '마감장 최초 발송'),
      ('C-5088', 'P-X500', 103, '2026-05-31', 6::numeric, 1373333::numeric, 8240000::numeric, 8240000::numeric, '박지훈', '매출관리팀', 'EV-202606-005', 'TX-202606-005', '확인', 'REVIEW', '추가 업로드 품목 확인'),
      ('C-6093', 'P-B600', 117, '2026-05-31', 10::numeric, 2890000::numeric, 28900000::numeric, 28900000::numeric, '황주은', '영업지원팀', 'EV-202606-006', 'TX-202606-006', '승인', 'READY', '카톡 문구 복사')
  ) AS row_data(customer_code, product_code, row_number, transaction_date, quantity, unit_price, amount, tax_invoice_amount, owner_name, department_name, evidence_number, tax_invoice_number, approval_status, row_status, memo)
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
