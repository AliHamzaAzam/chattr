<template>
  <div class="min-h-screen bg-gray-50">
    <slot />
  </div>
</template>

<script setup lang="ts">
// Auto-update last seen for authenticated users
const { authState, updateLastSeen } = useAuth()

onMounted(() => {
  if (authState.value.isAuthenticated) {
    updateLastSeen()
    
    // Update last seen every 5 minutes
    setInterval(updateLastSeen, 5 * 60 * 1000)
  }
})
</script>
