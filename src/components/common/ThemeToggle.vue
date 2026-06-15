<script setup>
import { computed, onMounted, ref } from 'vue'

const STORAGE_KEY = 'vue-electron-theme'
const theme = ref('dark')

const label = computed(() => (theme.value === 'dark' ? '라이트 모드' : '다크 모드'))

function applyTheme(nextTheme) {
  theme.value = nextTheme
  document.documentElement.setAttribute('data-bs-theme', nextTheme)
  localStorage.setItem(STORAGE_KEY, nextTheme)
}

function toggleTheme() {
  applyTheme(theme.value === 'dark' ? 'light' : 'dark')
}

onMounted(() => {
  const savedTheme = localStorage.getItem(STORAGE_KEY)
  applyTheme(savedTheme || 'dark')
})
</script>

<template>
  <button type="button" class="theme-toggle" @click="toggleTheme">
    <span class="theme-toggle-dot" />
    <span>{{ label }}</span>
  </button>
</template>
