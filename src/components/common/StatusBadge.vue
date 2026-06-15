<script setup>
defineProps({
  tone: {
    type: String,
    default: 'gray'
  }
})
</script>

<template>
  <span :class="['status-badge', `status-badge-${tone}`]">
    <slot />
  </span>
</template>
