<script setup>
import ActionButton from '../components/common/ActionButton.vue'
import PageLayout from '../components/common/PageLayout.vue'
import SectionCard from '../components/common/SectionCard.vue'
import StatusBadge from '../components/common/StatusBadge.vue'

const summaries = [
  { label: '오늘 대상 파일', value: '42개', tone: 'blue' },
  { label: '마감 완료율', value: '86%', tone: 'green' },
  { label: '확인 필요', value: '5건', tone: 'amber' }
]

const workflows = [
  '거래처별 마감 데이터 수집',
  '발송 대상 검증 및 큐 등록',
  '엑셀 보고서 생성과 검토'
]
</script>

<template>
  <PageLayout
    eyebrow="Introduction"
    title="소개 페이지"
    description="마감 업무, 발송 큐, 엑셀 보고서 작성을 한 화면 흐름으로 관리하는 Electron 데스크톱 템플릿입니다."
  >
    <template #actions>
      <ActionButton type="secondary">가이드 열기</ActionButton>
    </template>

    <div class="responsive-grid responsive-grid-3">
      <SectionCard v-for="summary in summaries" :key="summary.label">
        <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
          <span class="label-text">{{ summary.label }}</span>
          <StatusBadge :tone="summary.tone">요약</StatusBadge>
        </div>
        <div class="metric-value">{{ summary.value }}</div>
      </SectionCard>
    </div>

    <SectionCard title="기본 업무 흐름">
      <div class="workflow-list">
        <div v-for="(workflow, index) in workflows" :key="workflow" class="workflow-row">
          <span class="workflow-step">{{ index + 1 }}</span>
          <span>{{ workflow }}</span>
        </div>
      </div>
    </SectionCard>
  </PageLayout>
</template>
