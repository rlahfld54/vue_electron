<script setup>
defineProps({
  title: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  flush: {
    type: Boolean,
    default: false
  }
})
</script>

<template>
  <section :class="['dashboard-card', { 'dashboard-card-flush': flush }]">
    <div v-if="title || description || $slots.actions" class="section-card-header">
      <div>
        <h3 v-if="title" class="panel-title mb-1">{{ title }}</h3>
        <p v-if="description" class="body-text mb-0">{{ description }}</p>
      </div>
      <div v-if="$slots.actions" class="section-card-actions">
        <slot name="actions" />
      </div>
    </div>

    <slot />
  </section>
</template>
