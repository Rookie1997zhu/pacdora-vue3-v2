<template>
  <lord-icon
    class="empty-icon"
    :src="src"
    trigger="loop"
    colors="primary:#006868,secondary:#64748b"
    stroke="regular"
  />
</template>

<script setup lang="ts">
defineProps<{
  src: string
}>()
</script>

<style scoped>
.empty-icon {
  width: 72px;
  height: 72px;
  display: block;
  margin: 0 auto 12px;
}
</style>
