<script setup>
defineProps({
  title: {
    type: String,
    default: '표시할 내용이 없습니다.'
  },
  description: {
    type: String,
    default: ''
  }
})
</script>

<template>
  <div class="empty-state">
    <div class="empty-state-mark">-</div>
    <h3 class="panel-title mb-1">{{ title }}</h3>
    <p v-if="description" class="body-text mb-0">{{ description }}</p>
  </div>
</template>
