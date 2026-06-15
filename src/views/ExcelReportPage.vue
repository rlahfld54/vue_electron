<script setup>
import { ref } from 'vue'
import ActionButton from '../components/common/ActionButton.vue'
import BaseModal from '../components/common/BaseModal.vue'
import PageLayout from '../components/common/PageLayout.vue'
import SectionCard from '../components/common/SectionCard.vue'

const reportOptions = [
  '거래처별 시트 분리',
  '미수금 요약 포함',
  '발송용 PDF 같이 생성'
]

const showPreviewModal = ref(false)
</script>

<template>
  <PageLayout
    eyebrow="Report"
    title="엑셀 보고서 작성 기능"
    description="마감 데이터를 기준으로 검토용 엑셀 보고서를 생성하는 작업 화면입니다."
  >
    <template #actions>
      <ActionButton type="add">보고서 생성</ActionButton>
      <ActionButton type="secondary" @click="showPreviewModal = true">미리보기</ActionButton>
    </template>

    <div class="responsive-grid report-grid">
      <SectionCard title="보고서 설정">
        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label label-text" for="reportMonth">마감 월</label>
            <input id="reportMonth" class="form-control" type="month" value="2026-06">
          </div>
          <div class="col-md-6">
            <label class="form-label label-text" for="reportType">보고서 유형</label>
            <select id="reportType" class="form-select">
              <option>월간 정산 보고서</option>
              <option>거래처별 마감 보고서</option>
              <option>내부 검토 보고서</option>
            </select>
          </div>
          <div class="col-12">
            <label class="form-label label-text" for="memo">검토 메모</label>
            <textarea id="memo" class="form-control" rows="4" placeholder="보고서에 포함할 메모를 입력하세요." />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="생성 옵션">
        <div class="vstack gap-3">
          <div v-for="option in reportOptions" :key="option" class="form-check">
            <input :id="option" class="form-check-input" type="checkbox" checked>
            <label class="form-check-label body-text" :for="option">{{ option }}</label>
          </div>
        </div>
      </SectionCard>
    </div>

    <BaseModal :show="showPreviewModal" title="보고서 미리보기" size="lg" @close="showPreviewModal = false">
      <div class="preview-sheet">
        <div class="preview-sheet-row preview-sheet-head">
          <span>거래처</span>
          <span>공급가액</span>
          <span>세액</span>
          <span>합계</span>
        </div>
        <div class="preview-sheet-row">
          <span>그린유통</span>
          <span>12,400,000</span>
          <span>1,240,000</span>
          <span>13,640,000</span>
        </div>
        <div class="preview-sheet-row">
          <span>한빛상사</span>
          <span>8,900,000</span>
          <span>890,000</span>
          <span>9,790,000</span>
        </div>
      </div>

      <template #footer>
        <ActionButton type="secondary" @click="showPreviewModal = false">닫기</ActionButton>
        <ActionButton type="add" @click="showPreviewModal = false">생성 진행</ActionButton>
      </template>
    </BaseModal>
  </PageLayout>
</template>
