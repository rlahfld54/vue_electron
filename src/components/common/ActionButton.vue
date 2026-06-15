<script setup>
const props = defineProps({
  type: {
    type: String,
    default: 'primary'
  },
  size: {
    type: String,
    default: 'sm'
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const typeClassMap = {
  add: 'btn-primary',
  edit: 'btn-outline-primary',
  delete: 'btn-outline-danger',
  primary: 'btn-primary',
  secondary: 'btn-outline-secondary'
}
</script>

<template>
  <button
    type="button"
    :class="['btn', `btn-${props.size}`, typeClassMap[props.type] || typeClassMap.primary]"
    :disabled="props.disabled"
  >
    <slot />
  </button>
</template>
