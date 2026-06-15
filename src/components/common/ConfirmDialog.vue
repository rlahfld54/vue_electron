<script setup>
import ActionButton from './ActionButton.vue'
import BaseModal from './BaseModal.vue'

defineProps({
  show: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: '확인이 필요합니다.'
  },
  message: {
    type: String,
    default: ''
  },
  confirmText: {
    type: String,
    default: '확인'
  },
  cancelText: {
    type: String,
    default: '취소'
  },
  danger: {
    type: Boolean,
    default: false
  }
})

defineEmits(['cancel', 'confirm'])
</script>

<template>
  <BaseModal :show="show" :title="title" @close="$emit('cancel')">
    <p class="body-text mb-0">{{ message }}</p>

    <template #footer>
      <ActionButton type="secondary" @click="$emit('cancel')">{{ cancelText }}</ActionButton>
      <ActionButton :type="danger ? 'delete' : 'primary'" @click="$emit('confirm')">
        {{ confirmText }}
      </ActionButton>
    </template>
  </BaseModal>
</template>
