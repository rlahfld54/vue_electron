<script setup>
defineProps({
  eyebrow: {
    type: String,
    default: ''
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  }
})
</script>

<template>
  <section class="page-layout">
    <header class="page-layout-header">
      <div class="page-layout-copy">
        <p v-if="eyebrow" class="label-text text-uppercase mb-1">{{ eyebrow }}</p>
        <h2 class="page-title mb-2">{{ title }}</h2>
        <p v-if="description" class="body-text mb-0">{{ description }}</p>
      </div>

      <div v-if="$slots.actions" class="page-layout-actions">
        <slot name="actions" />
      </div>
    </header>

    <slot />
  </section>
</template>
