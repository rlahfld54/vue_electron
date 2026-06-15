<script setup>
import ActionButton from './components/common/ActionButton.vue'
import StatusBadge from './components/common/StatusBadge.vue'
import ThemeToggle from './components/common/ThemeToggle.vue'

const navGroups = [
  {
    title: '마감 워크스페이스',
    items: [
      { label: '마감 워크스페이스', to: '/', badge: 'Home' },
      { label: '발송 큐', to: '/closing-queue', badge: 'Queue' }
    ]
  },
  {
    title: '데이터 취합',
    items: [
      { label: '업로드 전 검증', to: '/collect/upload-validation', badge: 'Check' },
      { label: '파일 관리', to: '/collect/file-manager', badge: 'Files' },
      { label: '원본 데이터 조회', to: '/collect/data-table', badge: 'Raw' }
    ]
  },
  {
    title: '보고서',
    items: [
      { label: '보고서 작성', to: '/excel-report', badge: 'Report' }
    ]
  }
]
</script>

<template>
  <div class="dashboard-layout">
    <aside class="dashboard-sidebar">
      <div class="brand-area">
        <img class="brand-mark" src="/icon.svg" alt="" aria-hidden="true">
        <div>
          <div class="brand-title">Vue Electron</div>
          <div class="brand-subtitle">Closing Workspace</div>
        </div>
      </div>

      <nav class="dashboard-nav" aria-label="주요 메뉴">
        <section v-for="group in navGroups" :key="group.title" class="dashboard-nav-group">
          <p class="dashboard-nav-title">{{ group.title }}</p>
          <RouterLink
            v-for="item in group.items"
            :key="item.to"
            :to="item.to"
            class="dashboard-nav-link"
          >
            <span>{{ item.label }}</span>
            <span class="nav-badge">{{ item.badge }}</span>
          </RouterLink>
        </section>
      </nav>
    </aside>

    <div class="dashboard-main">
      <header class="dashboard-topbar">
        <div>
          <p class="label-text text-uppercase mb-1">Desktop dashboard</p>
          <h1 class="page-title mb-0">마감 업무 대시보드</h1>
        </div>

        <div class="dashboard-topbar-actions">
          <ThemeToggle />
          <StatusBadge tone="green">동기화 정상</StatusBadge>
          <ActionButton type="add">새 작업</ActionButton>
        </div>
      </header>

      <main class="dashboard-content">
        <RouterView />
      </main>
    </div>
  </div>
</template>
