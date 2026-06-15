<script setup>
import { computed, ref } from 'vue'
import ActionButton from '../components/common/ActionButton.vue'
import BaseModal from '../components/common/BaseModal.vue'
import BaseTable from '../components/common/BaseTable.vue'
import PageLayout from '../components/common/PageLayout.vue'
import SectionCard from '../components/common/SectionCard.vue'
import StatusBadge from '../components/common/StatusBadge.vue'

const query = ref('')
const statusFilter = ref('전체')
const statusText = ref('원본 데이터를 조회하고, SQL 저장 전에 검증할 수 있습니다.')
const showActionModal = ref(false)
const actionTitle = ref('')
const actionMessage = ref('')
const storageKey = 'vue-electron-raw-data-snapshot'

const rows = ref([
  { id: 1, customer: '모블상사', product: 'A-패키지', quantity: 12, unitPrice: '1,637,500', amount: '19,650,000', status: '반려', tone: 'red' },
  { id: 2, customer: '그린물류', product: '정산상품', quantity: 20, unitPrice: '2,159,000', amount: '43,180,000', status: '확인 필요', tone: 'amber' },
  { id: 3, customer: '서울컴퍼니', product: '월간정산', quantity: 8, unitPrice: '4,482,500', amount: '35,860,000', status: '정상', tone: 'green' },
  { id: 4, customer: '청담리테일', product: '문구세트', quantity: 10, unitPrice: '1,240,000', amount: '12,400,000', status: '정상', tone: 'green' }
])

const columns = [
  { key: 'customer', label: '거래처', cellClass: 'fw-semibold' },
  { key: 'product', label: '품목' },
  { key: 'quantity', label: '수량' },
  { key: 'unitPrice', label: '단가', headerClass: 'text-end', cellClass: 'text-end' },
  { key: 'amount', label: '금액', headerClass: 'text-end', cellClass: 'text-end' },
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

function addFile() {
  const nextId = Math.max(...rows.value.map((row) => row.id)) + 1

  rows.value.unshift({
    id: nextId,
    customer: '다원문구',
    product: '추가 업로드 품목',
    quantity: 6,
    unitPrice: '1,373,333',
    amount: '8,240,000',
    status: '확인 필요',
    tone: 'amber'
  })
  notify('파일 추가 완료', 'sample_sales_additional.xlsx의 신규 행 1개를 화면에 추가했습니다.')
}

function runValidation() {
  rows.value = rows.value.map((row) => (
    row.status === '확인 필요'
      ? { ...row, status: '정상', tone: 'green' }
      : row
  ))
  notify('검증 실행 완료', '확인 필요 항목을 재검증했고, 정상 저장 가능한 행으로 표시했습니다.')
}

function saveSqlSnapshot() {
  const readyRows = rows.value.filter((row) => row.status !== '반려')
  localStorage.setItem(storageKey, JSON.stringify({ savedAt: new Date().toISOString(), rows: readyRows }))
  notify('SQL 저장 준비 완료', `반려 항목을 제외한 ${readyRows.length}개 행을 저장 대기 상태로 보관했습니다.`)
}

function exportRows() {
  notify('XLSX 내보내기 준비', `현재 필터 결과 ${filteredRows.value.length}개 행을 XLSX로 내보낼 수 있도록 준비했습니다.`)
}
</script>

<template>
  <PageLayout title="원본 데이터 조회" description="업로드한 원본 데이터를 조회하고, 반려 항목이 없는 데이터만 SQL에 저장합니다.">
    <SectionCard>
      <div class="upload-panel">
        <div>
          <p class="label-text text-uppercase">Raw data</p>
          <h3 class="panel-title mb-1">sample_sales_1200.xlsx</h3>
          <p class="body-text mb-0">{{ statusText }}</p>
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
