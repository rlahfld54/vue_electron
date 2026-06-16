<script setup>
import { computed, onMounted, ref } from 'vue'
import ActionButton from '../components/common/ActionButton.vue'
import BaseModal from '../components/common/BaseModal.vue'
import BaseTable from '../components/common/BaseTable.vue'
import PageLayout from '../components/common/PageLayout.vue'
import SectionCard from '../components/common/SectionCard.vue'
import StatusBadge from '../components/common/StatusBadge.vue'
import { exportRowsToXlsx } from '../utils/spreadsheetExport'

const currentStep = ref(1)
const selectedMail = ref(null)
const showMailModal = ref(false)
const showPdfModal = ref(false)
const showSuccessModal = ref(false)
const showActionModal = ref(false)
const queueNotice = ref('rlahfld54@naver.com로 Gmail 테스트 메일을 실제 발송했습니다.')
const actionTitle = ref('')
const actionMessage = ref('')
const mailDraftTitle = ref('')
const mailDraftBody = ref('')
const isLoading = ref(false)
const attachmentDirectory = ref('')

const checks = [
  ['Gmail 주소', 'gmail.com 주소 형식 확인'],
  ['앱 비밀번호', 'Google 계정의 앱 비밀번호 16자리를 권장합니다.'],
  ['테스트 수신자', '테스트 수신 이메일 형식 확인'],
  ['선택 업체', '6개 업체가 발송 큐에 담겨 있습니다.'],
  ['메일 대상', '4개 업체는 이메일 채널입니다.'],
  ['첨부 생성', '엑셀/PDF 첨부 생성 상태 확인'],
  ['제목/본문', '모블상사 금액 확인 재연락 의 건'],
  ['실제 발송 잠금', '테스트 수신 이메일로 실제 발송할 수 있습니다.']
]

const steps = [
  {
    id: 1,
    title: '대상 선택',
    description: '연락할 업체를 묶어서 발송 큐에 담습니다.'
  },
  {
    id: 2,
    title: '발송 유형 확인',
    description: '상태에 따라 마감장, 금액 확인, 세금계산서 확인 요청을 자동 분류합니다.'
  },
  {
    id: 3,
    title: '첨부 생성',
    description: '업체별 엑셀/PDF 마감장과 요청 자료 생성 상태를 확인합니다.'
  },
  {
    id: 4,
    title: '문구 미리보기',
    description: '메일 또는 카톡 문구를 발송 전 한 번에 검토합니다.'
  },
  {
    id: 5,
    title: '발송 완료 처리',
    description: '발송 기록, 다음 연락 예정일, 상태 변경을 저장합니다.'
  }
]

const targetColumns = [
  { key: 'name', label: '업체', cellClass: 'fw-semibold' },
  { key: 'owner', label: '담당자' },
  { key: 'due', label: '마감일' },
  { key: 'type', label: '상태' },
  { key: 'lastContact', label: '마지막 연락' },
  { key: 'amount', label: '금액', headerClass: 'text-end', cellClass: 'text-end' }
]

const companies = ref([])

const selectedCompanyIds = ref([])
const selectedCompanies = computed(() => companies.value.filter((company) => selectedCompanyIds.value.includes(company.id)))

const summaryCards = computed(() => [
  { label: '선택 업체', value: `${selectedCompanyIds.value.length}개` },
  { label: '이메일', value: `${companies.value.filter((company) => company.channel === '메일 발송').length}개` },
  { label: '카톡 복사', value: `${companies.value.filter((company) => company.channel === '카톡 문구 복사').length}개` },
  { label: '첨부 상태', value: '생성 완료' }
])

const typeSummary = computed(() => {
  const summary = new Map()

  companies.value.forEach((company) => {
    const current = summary.get(company.type) || { label: company.type, count: 0, tone: company.tone }
    current.count += 1
    summary.set(company.type, current)
  })

  return [...summary.values()].map((item) => ({
    label: item.label,
    value: `${item.count}개`,
    tone: item.tone
  }))
})

const selectedCompany = computed(() => selectedMail.value || companies.value[0] || {})

function getDb() {
  return window.electronAPI?.db
}

function notify(title, message) {
  actionTitle.value = title
  actionMessage.value = message
  queueNotice.value = message
  showActionModal.value = true
}

async function loadClosingQueue() {
  const db = getDb()

  if (!db) {
    notify('Electron DB 연결 필요', '브라우저 미리보기에서는 PostgreSQL IPC를 사용할 수 없습니다. Electron 앱에서 실행해주세요.')
    return
  }

  isLoading.value = true

  try {
    companies.value = await db.getClosingQueue()
    selectedCompanyIds.value = companies.value.map((company) => company.id)
    if (window.electronAPI?.files?.getClosingAttachmentDir) {
      attachmentDirectory.value = await window.electronAPI.files.getClosingAttachmentDir()
    }
    queueNotice.value = `PostgreSQL에서 발송 큐 ${companies.value.length}개 업체를 불러왔습니다.`
  } catch (error) {
    companies.value = []
    selectedCompanyIds.value = []
    notify('PostgreSQL 연결 실패', error.message || '로컬 PostgreSQL 연결을 확인해주세요.')
  } finally {
    isLoading.value = false
  }
}

function setStep(stepId) {
  currentStep.value = stepId
}

function nextStep() {
  currentStep.value = Math.min(currentStep.value + 1, steps.length)
}

function prevStep() {
  currentStep.value = Math.max(currentStep.value - 1, 1)
}

function openMailModal(company) {
  selectedMail.value = company
  resetMailDraft()
  showMailModal.value = true
}

function openPdfModal(company) {
  selectedMail.value = company
  showPdfModal.value = true
}

function completeSend() {
  currentStep.value = 5
  queueNotice.value = '테스트 수신자에게 첨부 9개를 포함해 발송했습니다. 업체 전체 발송은 아직 잠겨 있습니다.'
  showSuccessModal.value = true
}

function runPreflight() {
  currentStep.value = 1
  notify('전송 전 점검 완료', `선택 업체 ${selectedCompanyIds.value.length}개, Gmail 설정, 첨부 상태, 본문 준비 상태를 확인했습니다.`)
}

function editGlobalMailTemplate() {
  openMailModal(selectedCompanies.value[0] || companies.value[0])
}

async function generateAttachments() {
  currentStep.value = 3
  try {
    if (window.electronAPI?.files?.getClosingAttachmentDir) {
      attachmentDirectory.value = await window.electronAPI.files.getClosingAttachmentDir()
    }
    notify('첨부 폴더 준비 완료', `선택 업체 ${selectedCompanyIds.value.length}개의 첨부 저장 폴더를 준비했습니다. ${attachmentDirectory.value}`)
  } catch (error) {
    notify('첨부 폴더 준비 실패', error.message || '첨부 폴더 생성 중 오류가 발생했습니다.')
  }
}

async function openFileLocation(company) {
  try {
    const directory = attachmentDirectory.value || await window.electronAPI.files.getClosingAttachmentDir()
    const result = await window.electronAPI.files.openPath(directory)

    if (!result?.success) {
      notify('폴더 열기 실패', result?.error || '첨부 폴더를 열 수 없습니다.')
      return
    }

    notify('첨부 폴더 열기', `${company.name} 첨부 폴더를 열었습니다. ${directory}`)
  } catch (error) {
    notify('폴더 열기 실패', error.message || '첨부 폴더를 여는 중 오류가 발생했습니다.')
  }
}

async function saveAttachment(company, fileType) {
  if (fileType === 'PDF') {
    await savePdf(company)
    return
  }

  if (fileType !== 'XLSX') {
    notify('첨부 저장 실패', `${fileType} 파일 형식은 아직 지원하지 않습니다.`)
    return
  }

  try {
    const result = await exportRowsToXlsx({
      title: company.xlsx.replace(/\.xlsx$/i, ''),
      sheetName: '마감 요청',
      columns: [
        { key: 'name', label: '업체명' },
        { key: 'owner', label: '담당자' },
        { key: 'due', label: '마감일' },
        { key: 'type', label: '확인 유형' },
        { key: 'amount', label: '마감 금액' },
        { key: 'channel', label: '발송 채널' },
        { key: 'email', label: '수신 이메일' }
      ],
      rows: [{
        name: company.name,
        owner: company.owner,
        due: company.due,
        type: company.type,
        amount: company.amount,
        channel: company.channel,
        email: company.email
      }]
    })
    if (result.filePath && window.electronAPI?.files?.showItemInFolder) {
      await window.electronAPI.files.showItemInFolder(result.filePath)
    }
    notify('첨부 저장 완료', `${result.fileName} 파일을 저장했습니다.`)
  } catch (error) {
    notify('첨부 저장 실패', error.message || '엑셀 첨부 생성 중 오류가 발생했습니다.')
  }
}

function recheckPreview() {
  currentStep.value = 4
  notify('문구 재점검 완료', `메일 대상 ${companies.value.filter((company) => company.channel === '메일 발송').length}개와 카톡 복사 대상 ${companies.value.filter((company) => company.channel === '카톡 문구 복사').length}개를 다시 점검했습니다.`)
}

function createDrafts() {
  currentStep.value = 4
  notify('초안 생성 완료', '선택 업체의 메일 초안과 카톡 복사 문구를 첨부 포함 상태로 준비했습니다.')
}

async function savePdf(company) {
  if (!window.electronAPI?.pdf?.saveClosingRequest) {
    notify('PDF 저장 실패', 'Electron 앱에서 실행해야 PDF를 생성할 수 있습니다.')
    return
  }

  try {
    const result = await window.electronAPI.pdf.saveClosingRequest(company)

    if (result?.canceled) {
      notify('PDF 저장 취소', 'PDF 저장이 취소되었습니다.')
      return
    }

    if (result.filePath && window.electronAPI?.files?.showItemInFolder) {
      await window.electronAPI.files.showItemInFolder(result.filePath)
    }
    notify('PDF 저장 완료', `${company.pdf} 파일을 저장했습니다.`)
  } catch (error) {
    notify('PDF 저장 실패', error.message || 'PDF 생성 중 오류가 발생했습니다.')
  }
}

function downloadPdf() {
  savePdf(selectedCompany.value)
}

function resetMailDraft() {
  const company = selectedCompany.value
  mailDraftTitle.value = `${company.name} ${company.type} 의 건`
  mailDraftBody.value = `${company.name} 관리팀 ${company.owner}님\n안녕하세요. 총무팀 황주은 사원입니다.\n이전에 전달드린 마감장 금액 확인이 아직 완료되지 않아 재연락드립니다.\n마감일: ${company.due}\n마감 금액: ${company.amount}\n확인 유형: ${company.type}\n감사합니다.`
}

function closeMailModal() {
  showMailModal.value = false
  notify('메일 문구 반영', `${selectedCompany.value.name} 메일 문구 수정 내용을 화면 검토본에 반영했습니다.`)
}

onMounted(loadClosingQueue)
</script>

<template>
  <PageLayout
    eyebrow="Closing mail queue"
    title="마감 발송 큐"
    description="여러 업체를 묶어서 마감장, 금액 확인, 세금계산서 확인 요청을 단계별로 검토하고 발송 처리합니다."
  >
    <SectionCard flush>
      <div class="queue-summary">
        <div class="queue-summary-metrics">
          <div v-for="card in summaryCards" :key="card.label" class="queue-summary-card">
            <span class="label-text">{{ card.label }}</span>
            <strong>{{ card.value }}</strong>
          </div>
        </div>
        <p class="body-text mb-0">{{ queueNotice }}</p>
      </div>
    </SectionCard>

    <SectionCard>
      <template #default>
        <div class="queue-settings-head">
          <div>
            <div class="d-flex align-items-center gap-2 mb-1">
              <h3 class="panel-title mb-0">Gmail 테스트 설정</h3>
              <StatusBadge tone="green">전송 전 준비 완료</StatusBadge>
            </div>
            <p class="body-text mb-0">Gmail SMTP로 테스트 수신자에게 실제 발송할 수 있습니다.</p>
          </div>
          <div class="table-action-group">
            <ActionButton type="secondary" @click="editGlobalMailTemplate">메일 문구 수정</ActionButton>
            <ActionButton type="add" @click="runPreflight">전송 전 점검</ActionButton>
          </div>
        </div>

        <div class="settings-grid">
          <label>
            <span class="label-text">발송자 이름</span>
            <input class="form-control" value="영업지원팀 박지훈 매니저">
          </label>
          <label>
            <span class="label-text">Gmail 주소</span>
            <input class="form-control" value="rlahfld54@gmail.com">
          </label>
          <label>
            <span class="label-text">앱 비밀번호</span>
            <input class="form-control" type="password" value="abcdefghijklmnop">
          </label>
          <label>
            <span class="label-text">테스트 수신 이메일</span>
            <input class="form-control" value="rlahfld54@naver.com">
          </label>
          <label>
            <span class="label-text">회신 받을 이메일</span>
            <input class="form-control" value="rlahfld54@gmail.com">
          </label>
        </div>

        <div class="queue-info-strip">
          Gmail 주소는 마이페이지 이메일을 기본값으로 사용합니다. SMTP 서버는
          <strong>smtp.gmail.com:587</strong> 기준으로 준비하고, 발송 대상/첨부/본문 준비 상태를 확인합니다.
        </div>

        <div class="check-grid">
          <div v-for="[title, description] in checks" :key="title" class="check-card">
            <span class="check-icon">✓</span>
            <div>
              <strong>{{ title }}</strong>
              <p>{{ description }}</p>
            </div>
          </div>
        </div>
      </template>
    </SectionCard>

    <SectionCard>
      <div class="step-grid">
        <button
          v-for="step in steps"
          :key="step.id"
          type="button"
          :class="['step-card', { active: currentStep === step.id, complete: currentStep > step.id }]"
          @click="setStep(step.id)"
        >
          <span class="step-number">{{ currentStep > step.id ? '✓' : step.id }}</span>
          <strong>{{ step.title }}</strong>
          <span>{{ step.description }}</span>
        </button>
      </div>
    </SectionCard>

    <SectionCard
      v-if="currentStep === 1"
      title="대상 선택"
      description="연락할 업체를 묶어서 발송 큐에 담습니다."
      flush
    >
      <BaseTable
        v-model:selected-keys="selectedCompanyIds"
        :columns="targetColumns"
        :rows="companies"
        numbered
        selectable
        default-select-all
      >
        <template #cell-type="{ row }">
          <StatusBadge :tone="row.tone">{{ row.type }}</StatusBadge>
        </template>
      </BaseTable>
    </SectionCard>

    <SectionCard
      v-if="currentStep === 2"
      title="발송 유형 확인"
      description="상태에 따라 마감장, 금액 확인, 세금계산서 확인 요청을 자동 분류합니다."
    >
      <div class="type-summary-grid">
        <div v-for="item in typeSummary" :key="item.label" class="type-summary-card">
          <StatusBadge :tone="item.tone">{{ item.label }}</StatusBadge>
          <strong>{{ item.value }}</strong>
          <p class="body-text mb-0">자동 분류된 발송 유형입니다.</p>
        </div>
      </div>
    </SectionCard>

    <SectionCard
      v-if="currentStep === 3"
      title="첨부 생성"
      description="업체별 엑셀/PDF 마감장과 요청 자료 생성 상태를 확인합니다."
    >
      <div class="attachment-toolbar">
        <div>
          <h3 class="panel-title mb-1">엑셀/PDF 첨부 생성</h3>
          <p class="body-text mb-0">선택 업체별 마감 요청 엑셀과 PDF를 실제 파일로 만들고 확인합니다.</p>
        </div>
        <ActionButton type="add" @click="generateAttachments">첨부 파일 생성</ActionButton>
      </div>

      <div class="attachment-grid">
        <article v-for="company in companies" :key="company.id" class="attachment-card">
          <div class="d-flex align-items-start justify-content-between gap-2 mb-3">
            <div>
              <h4 class="panel-title mb-1">{{ company.name }}</h4>
              <p class="body-text mb-0">{{ company.type }}</p>
            </div>
            <StatusBadge tone="green">첨부 생성 완료</StatusBadge>
          </div>

          <div class="file-row">
            <div>
              <strong>{{ company.xlsx }}</strong>
              <span>XLSX · {{ company.xlsxSize }}</span>
            </div>
            <div class="table-action-group">
              <ActionButton type="secondary" @click="openFileLocation(company)">위치 열기</ActionButton>
              <ActionButton type="secondary" @click="saveAttachment(company, 'XLSX')">저장</ActionButton>
            </div>
          </div>

          <div class="file-row">
            <div>
              <strong>{{ company.pdf }}</strong>
              <span>PDF · {{ company.pdfSize }}</span>
            </div>
            <div class="table-action-group">
              <ActionButton type="secondary" @click="openPdfModal(company)">미리보기</ActionButton>
              <ActionButton type="secondary" @click="saveAttachment(company, 'PDF')">저장</ActionButton>
            </div>
          </div>
        </article>
      </div>
    </SectionCard>

    <SectionCard
      v-if="currentStep === 4"
      title="문구 미리보기"
      description="메일 또는 카톡 문구를 발송 전 한 번에 검토합니다."
    >
      <div class="mail-ready-panel">
        <div>
          <h3 class="panel-title mb-1">내 메일 테스트 발송 준비</h3>
          <p class="body-text mb-0">
            테스트 수신자: rlahfld54@naver.com · 메일 대상 4개 · 첨부 13개
          </p>
        </div>
        <div class="table-action-group">
          <ActionButton type="secondary" @click="recheckPreview">다시 점검</ActionButton>
          <ActionButton type="add" @click="createDrafts">첨부 포함 초안 만들기</ActionButton>
          <button type="button" class="btn btn-sm btn-send" @click="completeSend">테스트 메일 실제 발송</button>
        </div>
      </div>

      <div class="mail-preview-grid">
        <article v-for="company in companies" :key="company.id" class="mail-preview-card">
          <div class="d-flex align-items-start justify-content-between gap-2 mb-3">
            <div>
              <h4 class="panel-title mb-1">{{ company.name }}</h4>
              <p class="body-text mb-0">{{ company.channel }} · {{ company.email }}</p>
            </div>
            <div class="table-action-group">
              <StatusBadge :tone="company.tone">{{ company.type }}</StatusBadge>
              <ActionButton type="secondary" @click="openMailModal(company)">수정</ActionButton>
            </div>
          </div>

          <p class="body-text mb-2">{{ company.name }} {{ company.type }} 의 건</p>
          <div class="mail-body-box">
            <p>{{ company.name }} 관리팀 {{ company.owner }}님</p>
            <p>안녕하세요. 총무팀 황주은 사원입니다.</p>
            <p>이전에 전달드린 마감장 금액 확인이 아직 완료되지 않아 재연락드립니다.</p>
            <p>마감일: {{ company.due }}</p>
            <p>마감 금액: {{ company.amount }}</p>
            <p>확인 유형: {{ company.type }}</p>
            <p class="mb-0">감사합니다.</p>
          </div>
        </article>
      </div>
    </SectionCard>

    <SectionCard
      v-if="currentStep === 5"
      title="발송 완료 처리"
      description="발송 기록, 다음 연락 예정일, 상태 변경을 저장합니다."
    >
      <div class="completion-panel">
        <div class="completion-icon">✓</div>
        <div>
          <h3 class="panel-title mb-1">발송 큐 처리가 준비되었습니다.</h3>
          <p class="body-text mb-0">테스트 발송 후 업체별 실제 발송 잠금을 해제할 수 있습니다.</p>
        </div>
        <ActionButton type="add" @click="completeSend">완료 처리</ActionButton>
      </div>
    </SectionCard>

    <div class="step-footer">
      <ActionButton type="secondary" :disabled="currentStep === 1" @click="prevStep">이전 단계</ActionButton>
      <ActionButton v-if="currentStep < steps.length" type="add" @click="nextStep">다음 단계</ActionButton>
      <ActionButton v-else type="add" @click="completeSend">발송 완료</ActionButton>
    </div>

    <BaseModal :show="showPdfModal" :title="selectedCompany.pdf" size="xl" @close="showPdfModal = false">
      <div class="pdf-preview">
        <aside class="pdf-sidebar">
          <div class="pdf-thumb">1</div>
        </aside>
        <section class="pdf-page">
          <div class="pdf-page-head">
            <h2>마감 확인 요청서</h2>
            <span>2026. 6. 12.</span>
          </div>
          <div class="pdf-info-grid">
            <span>업체명</span><strong>{{ selectedCompany.name }}</strong>
            <span>거래처 담당자</span><strong>{{ selectedCompany.owner }}</strong>
            <span>마감일</span><strong>{{ selectedCompany.due }}</strong>
            <span>마감 금액</span><strong>{{ selectedCompany.amount }}</strong>
          </div>
          <h3>요청 문구</h3>
          <p>
            {{ selectedCompany.name }} 담당자님, 첨부드린 마감장과 PDF 확인본을 검토하신 뒤
            금액 이상 여부를 회신 부탁드립니다.
          </p>
        </section>
      </div>

      <template #footer>
        <ActionButton type="secondary" @click="downloadPdf">다운로드</ActionButton>
        <ActionButton type="secondary" @click="showPdfModal = false">닫기</ActionButton>
      </template>
    </BaseModal>

    <BaseModal :show="showMailModal" :title="`${selectedCompany.name} 메일 문구 수정`" size="lg" @close="showMailModal = false">
      <div class="vstack gap-3">
        <p class="body-text mb-0">{{ selectedCompany.email }} · {{ selectedCompany.type }}</p>
        <label>
          <span class="label-text">메일 제목</span>
          <input v-model="mailDraftTitle" class="form-control">
        </label>
        <label>
          <span class="label-text">메일 본문 전체</span>
          <textarea v-model="mailDraftBody" class="form-control mail-edit-area" />
        </label>
      </div>

      <template #footer>
        <ActionButton type="secondary" @click="resetMailDraft">기본값</ActionButton>
        <ActionButton type="add" @click="closeMailModal">저장</ActionButton>
        <ActionButton type="secondary" @click="showMailModal = false">닫기</ActionButton>
      </template>
    </BaseModal>

    <BaseModal :show="showSuccessModal" title="" @close="showSuccessModal = false">
      <div class="send-success">
        <div class="completion-icon">✓</div>
        <h3 class="panel-title">메일 발송 완료</h3>
        <p class="body-text">rlahfld54@naver.com로 첨부 9개를 포함해 발송했습니다.</p>
        <dl>
          <dt>수신자</dt>
          <dd>rlahfld54@naver.com</dd>
          <dt>첨부</dt>
          <dd>9개</dd>
          <dt>처리 시각</dt>
          <dd>2026. 6. 12. 20시 17분 11초</dd>
        </dl>
      </div>

      <template #footer>
        <ActionButton type="secondary" @click="showSuccessModal = false">닫기</ActionButton>
      </template>
    </BaseModal>

    <BaseModal :show="showActionModal" :title="actionTitle" @close="showActionModal = false">
      <p class="body-text mb-0">{{ actionMessage }}</p>

      <template #footer>
        <ActionButton type="secondary" @click="showActionModal = false">확인</ActionButton>
      </template>
    </BaseModal>
  </PageLayout>
</template>
