<script setup>
defineProps({
  show: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: ''
  },
  size: {
    type: String,
    default: ''
  }
})

defineEmits(['close'])
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="modal-backdrop-custom" @click.self="$emit('close')">
      <section :class="['modal-panel', size ? `modal-panel-${size}` : '']" role="dialog" aria-modal="true">
        <header class="modal-panel-header">
          <h2 class="panel-title mb-0">{{ title }}</h2>
          <button type="button" class="btn-close" aria-label="Close" @click="$emit('close')" />
        </header>

        <div class="modal-panel-body">
          <slot />
        </div>

        <footer v-if="$slots.footer" class="modal-panel-footer">
          <slot name="footer" />
        </footer>
      </section>
    </div>
  </Teleport>
</template>
