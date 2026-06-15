<script setup>
import { computed, ref, watch } from 'vue'
import EmptyState from './EmptyState.vue'

const props = defineProps({
  columns: {
    type: Array,
    required: true
  },
  rows: {
    type: Array,
    default: () => []
  },
  rowKey: {
    type: String,
    default: 'id'
  },
  numbered: {
    type: Boolean,
    default: false
  },
  selectable: {
    type: Boolean,
    default: false
  },
  selectedKeys: {
    type: Array,
    default: () => []
  },
  defaultSelectAll: {
    type: Boolean,
    default: false
  },
  emptyTitle: {
    type: String,
    default: '데이터가 없습니다.'
  },
  emptyDescription: {
    type: String,
    default: '조건을 변경하거나 새 항목을 추가해 주세요.'
  }
})

const emit = defineEmits(['update:selectedKeys'])
const initializedSelection = ref(false)

const rowKeys = computed(() => props.rows.map((row) => row[props.rowKey]))
const selectedKeySet = computed(() => new Set(props.selectedKeys))
const isAllSelected = computed(() => rowKeys.value.length > 0 && props.selectedKeys.length === rowKeys.value.length)
const isPartialSelected = computed(() => props.selectedKeys.length > 0 && !isAllSelected.value)

function updateSelectedKeys(nextKeys) {
  emit('update:selectedKeys', nextKeys)
}

function toggleAll(checked) {
  updateSelectedKeys(checked ? [...rowKeys.value] : [])
}

function toggleRow(key, checked) {
  const nextKeys = new Set(props.selectedKeys)

  if (checked) {
    nextKeys.add(key)
  } else {
    nextKeys.delete(key)
  }

  updateSelectedKeys([...nextKeys])
}

watch(
  () => props.rows,
  () => {
    if (!props.selectable || !props.defaultSelectAll || initializedSelection.value) {
      return
    }

    updateSelectedKeys([...rowKeys.value])
    initializedSelection.value = true
  },
  { immediate: true }
)
</script>

<template>
  <div class="base-table-wrap">
    <table v-if="rows.length" class="table dashboard-table mb-0">
      <thead>
        <tr>
          <th v-if="selectable" class="table-check-cell">
            <input
              class="form-check-input row-check"
              type="checkbox"
              aria-label="전체 선택"
              :checked="isAllSelected"
              :indeterminate="isPartialSelected"
              @change="toggleAll($event.target.checked)"
            >
          </th>
          <th v-if="numbered" class="table-number-cell">순서</th>
          <th v-for="column in columns" :key="column.key" :class="column.headerClass">
            {{ column.label }}
          </th>
          <th v-if="$slots.actions" class="text-end">작업</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, index) in rows" :key="row[rowKey]" :class="{ 'table-row-selected': selectedKeySet.has(row[rowKey]) }">
          <td v-if="selectable" data-label="선택" class="table-check-cell">
            <input
              class="form-check-input row-check"
              type="checkbox"
              :aria-label="`${index + 1}번 행 선택`"
              :checked="selectedKeySet.has(row[rowKey])"
              @change="toggleRow(row[rowKey], $event.target.checked)"
            >
          </td>
          <td v-if="numbered" data-label="순서" class="table-number-cell">{{ index + 1 }}</td>
          <td
            v-for="column in columns"
            :key="column.key"
            :data-label="column.label"
            :class="column.cellClass"
          >
            <slot :name="`cell-${column.key}`" :row="row" :value="row[column.key]">
              {{ row[column.key] }}
            </slot>
          </td>
          <td v-if="$slots.actions" data-label="작업" class="text-end table-actions-cell">
            <slot name="actions" :row="row" />
          </td>
        </tr>
      </tbody>
    </table>

    <EmptyState v-else :title="emptyTitle" :description="emptyDescription" />
  </div>
</template>
