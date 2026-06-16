<script setup>
import { computed, onMounted, ref } from 'vue'
import ActionButton from '../components/common/ActionButton.vue'
import BaseModal from '../components/common/BaseModal.vue'
import BaseTable from '../components/common/BaseTable.vue'
import PageLayout from '../components/common/PageLayout.vue'
import SectionCard from '../components/common/SectionCard.vue'
import StatusBadge from '../components/common/StatusBadge.vue'
import { exportRowsToXlsx } from '../utils/spreadsheetExport'

const query = ref('')
const statusFilter = ref('전체')
const statusText = ref('원본 데이터를 조회하고, SQL 저장 전에 검증할 수 있습니다.')
const showActionModal = ref(false)
const actionTitle = ref('')
const actionMessage = ref('')
const isLoading = ref(false)

const rows = ref([])

const columns = [
  { key: 'transactionDate', label: '거래일' },
  { key: 'customer', label: '거래처', cellClass: 'fw-semibold' },
  { key: 'customerCode', label: '거래처코드' },
  { key: 'product', label: '품목' },
  { key: 'productCode', label: '품목코드' },
  { key: 'quantity', label: '수량' },
  { key: 'unitPrice', label: '단가', headerClass: 'text-end', cellClass: 'text-end' },
  { key: 'amount', label: '금액', headerClass: 'text-end', cellClass: 'text-end' },
  { key: 'owner', label: '담당자' },
  { key: 'department', label: '부서' },
  { key: 'evidenceNumber', label: '증빙번호' },
  { key: 'taxInvoiceNumber', label: '세금계산서번호' },
  { key: 'approvalStatus', label: '승인상태' },
  { key: 'status', label: '상태' }
]

const statusOptions = computed(() => ['전체', ...new Set(rows.value.map((row) => row.status))])
const filteredRows = computed(() => rows.value.filter((row) => {
  const text = Object.values(row).join(' ').toLowerCase()
  return (query.value === '' || text.includes(query.value.toLowerCase()))
    && (statusFilter.value === '전체' || row.status === statusFilter.value)
}))

function notify(title, message) {
  actionTitle.value = title
  actionMessage.value = message
  statusText.value = message
  showActionModal.value = true
}

function getDb() {
  return window.electronAPI?.db
}

async function loadRows() {
  const db = getDb()

  if (!db) {
    notify('Electron DB 연결 필요', '브라우저 미리보기에서는 PostgreSQL IPC를 사용할 수 없습니다. Electron 앱에서 실행해주세요.')
    return
  }

  isLoading.value = true

  try {
    rows.value = await db.getRawRows()
    statusText.value = `PostgreSQL에서 원본 데이터 ${rows.value.length}개 행을 불러왔습니다.`
  } catch (error) {
    rows.value = []
    notify('PostgreSQL 연결 실패', error.message || '로컬 PostgreSQL 연결을 확인해주세요.')
  } finally {
    isLoading.value = false
  }
}

async function addFile() {
  const db = getDb()

  if (!db) {
    notify('DB 연결 필요', 'Electron 앱에서 실행해야 PostgreSQL에 신규 행을 추가할 수 있습니다.')
    return
  }

  try {
    if (window.electronAPI?.files?.selectSpreadsheet) {
      const selected = await window.electronAPI.files.selectSpreadsheet()

      if (selected?.canceled) {
        notify('파일 선택 취소', '추가할 파일 선택이 취소되었습니다.')
        return
      }
    }

    rows.value = await db.addSampleRow()
    notify('파일 추가 완료', 'PostgreSQL에 추가 업로드 샘플 행을 저장하고 다시 조회했습니다.')
  } catch (error) {
    notify('파일 추가 실패', error.message || 'PostgreSQL insert 처리 중 오류가 발생했습니다.')
  }
}

async function runValidation() {
  const db = getDb()

  if (!db) {
    notify('DB 연결 필요', 'Electron 앱에서 실행해야 PostgreSQL 검증 업데이트를 수행할 수 있습니다.')
    return
  }

  try {
    rows.value = await db.runValidation()
    notify('검증 실행 완료', 'PostgreSQL에서 확인 필요 항목을 정상 상태로 업데이트했습니다.')
  } catch (error) {
    notify('검증 실패', error.message || 'PostgreSQL update 처리 중 오류가 발생했습니다.')
  }
}

async function saveSqlSnapshot() {
  const db = getDb()

  if (!db) {
    notify('DB 연결 필요', 'Electron 앱에서 실행해야 PostgreSQL 동기화 대기열에 저장할 수 있습니다.')
    return
  }

  try {
    const result = await db.saveSqlSnapshot()
    notify('SQL 저장 완료', `PostgreSQL sync_outbox에 ${result.savedCount}개 저장 요청을 기록했습니다.`)
  } catch (error) {
    notify('SQL 저장 실패', error.message || 'PostgreSQL 저장 처리 중 오류가 발생했습니다.')
  }
}

async function exportRows() {
  try {
    const result = await exportRowsToXlsx({
      title: '원본_데이터_조회',
      sheetName: '원본 데이터',
      columns,
      rows: filteredRows.value
    })
    notify('XLSX 내보내기 완료', `${result.fileName} 파일을 저장했습니다.`)
  } catch (error) {
    notify('XLSX 내보내기 실패', error.message || '엑셀 파일 생성 중 오류가 발생했습니다.')
  }
}

onMounted(loadRows)
</script>

<template>
  <PageLayout title="원본 데이터 조회" description="업로드한 원본 데이터를 조회하고, 반려 항목이 없는 데이터만 SQL에 저장합니다.">
    <SectionCard>
      <div class="upload-panel">
        <div>
          <p class="label-text text-uppercase">Raw data</p>
          <h3 class="panel-title mb-1">sample_sales_1200.xlsx</h3>
          <p class="body-text mb-0">{{ isLoading ? 'PostgreSQL에서 데이터를 불러오는 중입니다.' : statusText }}</p>
        </div>
        <div class="table-action-group">
          <ActionButton type="add" @click="addFile">파일 추가</ActionButton>
          <ActionButton type="secondary" @click="runValidation">검증 실행</ActionButton>
          <ActionButton type="secondary" @click="saveSqlSnapshot">SQL 저장</ActionButton>
          <ActionButton type="secondary" @click="exportRows">XLSX 내보내기</ActionButton>
        </div>
      </div>
    </SectionCard>

    <SectionCard title="원본 데이터" flush>
      <template #actions>
        <input v-model="query" class="form-control" type="search" placeholder="원본 데이터 검색">
        <select v-model="statusFilter" class="form-select">
          <option v-for="status in statusOptions" :key="status" :value="status">{{ status }}</option>
        </select>
      </template>

      <BaseTable :columns="columns" :rows="filteredRows" numbered>
        <template #cell-status="{ row }">
          <StatusBadge :tone="row.tone">{{ row.status }}</StatusBadge>
        </template>
      </BaseTable>
    </SectionCard>

    <BaseModal :show="showActionModal" :title="actionTitle" @close="showActionModal = false">
      <p class="body-text mb-0">{{ actionMessage }}</p>

      <template #footer>
        <ActionButton type="secondary" @click="showActionModal = false">확인</ActionButton>
      </template>
    </BaseModal>
  </PageLayout>
</template>
