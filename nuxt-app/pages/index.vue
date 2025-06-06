<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
    <div class="text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <h2 class="text-xl font-semibold text-gray-900">Loading chattr...</h2>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: false
})

const user = useSupabaseUser()

watch(user, (newUser) => {
  if (newUser) {
    navigateTo('/chat')
  } else {
    navigateTo('/auth/login')
  }
}, { immediate: true })
</script>
