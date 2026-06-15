<script setup>
import { computed, onMounted, ref } from 'vue'
import ActionButton from '../components/common/ActionButton.vue'
import BaseModal from '../components/common/BaseModal.vue'
import BaseTable from '../components/common/BaseTable.vue'
import PageLayout from '../components/common/PageLayout.vue'
import SectionCard from '../components/common/SectionCard.vue'
import StatusBadge from '../components/common/StatusBadge.vue'

const selectedType = ref('전체')
const activeIssueType = ref('')
const showIssueModal = ref(false)
const showActionModal = ref(false)
const statusText = ref('파일을 선택하면 SQL 저장 전에 반려 항목과 담당자 확인 항목을 먼저 검사합니다.')
const actionTitle = ref('')
const actionMessage = ref('')
const isLoading = ref(false)
const tempStorageKey = 'vue-electron-upload-validation-draft'

const templates = [
  {
    id: 'sales-closing-source',
    targetMenu: '마감 자료',
    title: '매출 마감 원본',
    description: '거래처별 매출, 품목, 수량, 단가, 금액을 업로드하기 위한 표준 양식입니다.',
    requiredColumns: ['거래처명', '품목명', '수량', '단가', '금액', '마감일'],
    optionalColumns: ['거래처코드', '품목코드', '비고']
  },
  {
    id: 'sales-closing-compare',
    targetMenu: '매출 마감 비교',
    title: '마감 비교 기준',
    description: '전월 데이터, 세금계산서 금액, 거래처 확인 상태를 비교하기 위한 검증 양식입니다.',
    requiredColumns: ['거래처명', '마감금액', '세금계산서금액', '확인상태'],
    optionalColumns: ['담당자', '회신일', '차이사유']
  }
]

const detailRows = ref([])

const issueColumns = [
  { key: 'rowNumber', label: '행', cellClass: 'fw-semibold' },
  { key: 'type', label: '구분' },
  { key: 'action', label: '처리' },
  { key: 'message', label: '내용' }
]

const blockingTypes = computed(() => [...new Set(detailRows.value.filter((row) => row.action === '반려').map((row) => row.type))])
const reviewTypes = computed(() => [...new Set(detailRows.value.filter((row) => row.action === '재확인').map((row) => row.type))])
const issueTypes = computed(() => ['전체', ...blockingTypes.value, ...reviewTypes.value])
const counts = computed(() => detailRows.value.reduce((acc, row) => {
  acc[row.type] = (acc[row.type] || 0) + 1
  return acc
}, {}))
const filteredIssues = computed(() => (
  selectedType.value === '전체'
    ? detailRows.value
    : detailRows.value.filter((row) => row.type === selectedType.value)
))
const blockerCount = computed(() => detailRows.value.filter((row) => row.action === '반려').length)
const reviewCount = computed(() => detailRows.value.filter((row) => row.action === '재확인').length)

function getDb() {
  return window.electronAPI?.db
}

async function loadSample() {
  const db = getDb()

  if (!db) {
    notify('Electron DB 연결 필요', '브라우저 미리보기에서는 PostgreSQL IPC를 사용할 수 없습니다. Electron 앱에서 실행해주세요.')
    return
  }

  isLoading.value = true

  try {
    detailRows.value = await db.getValidationIssues()
    statusText.value = `PostgreSQL에서 검증 이슈를 불러왔습니다. 반려 ${blockerCount.value}건, 재확인 ${reviewCount.value}건이 있습니다.`
  } catch (error) {
    detailRows.value = []
    notify('PostgreSQL 연결 실패', error.message || '로컬 PostgreSQL 연결을 확인해주세요.')
  } finally {
    isLoading.value = false
  }
}

function openIssue(type) {
  activeIssueType.value = type
  showIssueModal.value = true
}

function notify(title, message) {
  actionTitle.value = title
  actionMessage.value = message
  showActionModal.value = true
  statusText.value = message
}

function downloadTemplate(template) {
  notify('양식 다운로드 준비', `${template.title} 양식을 내려받을 수 있도록 준비했습니다.`)
}

function downloadAllTemplates() {
  notify('표준 양식 묶음 준비', '매출 마감 원본과 마감 비교 기준 양식 2개를 한 번에 받을 수 있도록 준비했습니다.')
}

function uploadFile() {
  notify('파일 업로드 대기', 'Electron 파일 선택 연결 전이라 샘플 파일을 업로드한 상태로 표시했습니다. 바로 샘플 검증을 실행할 수 있습니다.')
}

function saveDraft() {
  const payload = {
    savedAt: new Date().toISOString(),
    selectedType: selectedType.value,
    statusText: statusText.value,
    issueCount: detailRows.value.length
  }

  localStorage.setItem(tempStorageKey, JSON.stringify(payload))
  notify('임시 저장 완료', '현재 검증 필터와 상태 문구를 임시 저장했습니다.')
}

function loadDraft() {
  const rawDraft = localStorage.getItem(tempStorageKey)

  if (!rawDraft) {
    notify('임시 저장 없음', '불러올 임시 검증본이 없습니다. 샘플 검증 후 임시 저장을 먼저 눌러주세요.')
    return
  }

  const draft = JSON.parse(rawDraft)
  selectedType.value = draft.selectedType || '전체'
  notify('임시 검증본 불러오기', `${new Date(draft.savedAt).toLocaleString('ko-KR')}에 저장한 검증 상태를 불러왔습니다.`)
}

function downloadRejectedRows() {
  notify('반려 데이터 다운로드', `SQL 저장 전 반려해야 할 ${blockerCount.value}개 행을 엑셀로 내려받을 수 있도록 준비했습니다.`)
}

function downloadEditedRows() {
  notify('수정본 다운로드', '담당자 재확인 항목을 포함한 수정 검토본을 내려받을 수 있도록 준비했습니다.')
}

function downloadIssueRows() {
  notify('항목별 엑셀 다운로드', `${activeIssueType.value} 항목 ${counts.value[activeIssueType.value] || 0}건을 엑셀로 내려받을 수 있도록 준비했습니다.`)
}

function revalidateIssueRows() {
  notify('재검증 완료', `${activeIssueType.value} 항목을 다시 검증했습니다. 현재 화면의 검토 결과를 유지합니다.`)
}

function completeIssueReview() {
  showIssueModal.value = false
  notify('검토 완료', `${activeIssueType.value} 항목 검토를 완료했습니다.`)
}

onMounted(loadSample)
</script>

<template>
  <PageLayout
    eyebrow="Pre-insert validation"
    title="업로드 전 검증"
    description="담당자가 받은 엑셀 파일을 SQL에 넣기 전에 반려해야 할 데이터와 한 번 더 확인할 데이터를 분리해서 검토합니다."
  >
    <SectionCard title="표준 엑셀 양식" description="필요한 표준 양식 2개만 제공합니다.">
      <template #actions>
        <ActionButton type="secondary" @click="downloadAllTemplates">두 양식 한 번에 다운로드</ActionButton>
      </template>

      <div class="template-grid">
        <article v-for="template in templates" :key="template.id" class="template-card">
          <div class="template-card-head">
            <div>
              <p class="label-text text-uppercase">{{ template.targetMenu }}</p>
              <h3 class="panel-title mb-1">{{ template.title }}</h3>
              <p class="body-text mb-0">{{ template.description }}</p>
            </div>
            <ActionButton type="secondary" @click="downloadTemplate(template)">양식 다운로드</ActionButton>
          </div>
          <div class="template-columns">
            <div>
              <p class="label-text">필수 컬럼</p>
              <div class="chip-list">
                <span v-for="column in template.requiredColumns" :key="column" class="soft-chip accent">{{ column }}</span>
              </div>
            </div>
            <div>
              <p class="label-text">선택 컬럼</p>
              <div class="chip-list">
                <span v-for="column in template.optionalColumns" :key="column" class="soft-chip">{{ column }}</span>
              </div>
            </div>
          </div>
        </article>
      </div>
    </SectionCard>

    <SectionCard>
      <div class="upload-panel">
        <div class="min-w-0">
          <p class="label-text text-uppercase">Pre-insert validation</p>
          <h3 class="panel-title mb-1">sample_sales_1200.xlsx</h3>
          <p class="body-text mb-0">{{ isLoading ? 'PostgreSQL에서 검증 이슈를 불러오는 중입니다.' : statusText }}</p>
        </div>
        <div class="table-action-group">
          <ActionButton type="add" @click="uploadFile">파일 업로드</ActionButton>
          <ActionButton type="secondary" @click="loadSample">샘플 검증</ActionButton>
          <ActionButton type="secondary" @click="loadDraft">임시 불러오기</ActionButton>
          <ActionButton type="secondary" @click="saveDraft">임시 저장</ActionButton>
          <ActionButton type="secondary" @click="downloadRejectedRows">반려 데이터 다운로드</ActionButton>
          <ActionButton type="secondary" @click="downloadEditedRows">수정본 다운로드</ActionButton>
        </div>
      </div>
    </SectionCard>

    <div class="issue-section-grid">
      <SectionCard title="SQL 저장 전 반려">
        <div class="issue-button-grid">
          <button v-for="type in blockingTypes" :key="type" class="issue-button" type="button" @click="openIssue(type)">
            <span>{{ type }}</span>
            <StatusBadge tone="red">{{ counts[type] }}건</StatusBadge>
          </button>
        </div>
      </SectionCard>

      <SectionCard title="담당자 재확인">
        <div class="issue-button-grid">
          <button v-for="type in reviewTypes" :key="type" class="issue-button" type="button" @click="openIssue(type)">
            <span>{{ type }}</span>
            <StatusBadge tone="amber">{{ counts[type] }}건</StatusBadge>
          </button>
        </div>
      </SectionCard>
    </div>

    <SectionCard title="검증 상세" flush>
      <template #actions>
        <select v-model="selectedType" class="form-select">
          <option v-for="type in issueTypes" :key="type" :value="type">{{ type }}</option>
        </select>
      </template>

      <BaseTable :columns="issueColumns" :rows="filteredIssues" numbered>
        <template #cell-action="{ row }">
          <StatusBadge :tone="row.severity">{{ row.action }}</StatusBadge>
        </template>
      </BaseTable>
    </SectionCard>

    <BaseModal :show="showIssueModal" :title="activeIssueType" size="xl" @close="showIssueModal = false">
      <div class="issue-edit-head">
        <div>
          <p class="label-text text-uppercase">Temporary review</p>
          <p class="body-text mb-0">{{ counts[activeIssueType] || 0 }}개 행을 검토 중입니다. 수정 내용은 임시 검토본에만 반영됩니다.</p>
        </div>
        <div class="table-action-group">
          <ActionButton type="secondary" @click="downloadIssueRows">이 항목 엑셀 다운로드</ActionButton>
          <ActionButton type="secondary" @click="revalidateIssueRows">다시 검증</ActionButton>
          <ActionButton type="add" @click="completeIssueReview">검토 완료</ActionButton>
        </div>
      </div>

      <div class="issue-edit-table">
        <BaseTable
          :columns="[
            { key: 'candidate', label: 'DB 매칭 후보' },
            { key: 'customer', label: '거래처명' },
            { key: 'code', label: '거래처코드' },
            { key: 'product', label: '품목명' },
            { key: 'amount', label: '금액' }
          ]"
          :rows="[
            { id: 1, candidate: '기준정보: 모블상사 / C-1024', customer: '모블상사', code: '', product: 'A-패키지', amount: '19,650,000' },
            { id: 2, candidate: '계산 금액 43,180,000원', customer: '그린물류', code: 'C-2041', product: '정산상품', amount: '43,180,000' }
          ]"
          numbered
        />
      </div>
    </BaseModal>

    <BaseModal :show="showActionModal" :title="actionTitle" @close="showActionModal = false">
      <p class="body-text mb-0">{{ actionMessage }}</p>

      <template #footer>
        <ActionButton type="secondary" @click="showActionModal = false">확인</ActionButton>
      </template>
    </BaseModal>
  </PageLayout>
</template>
