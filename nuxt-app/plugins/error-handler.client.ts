// Error handling plugin to prevent worker crashes
export default defineNuxtPlugin({
  name: 'error-handler',
  setup() {
    // Handle unhandled promise rejections
    if (process.client) {
      window.addEventListener('unhandledrejection', (event) => {
        console.warn('Unhandled promise rejection:', event.reason)
        // Prevent the default behavior (which could crash the worker)
        event.preventDefault()
      })
    }
  }
})
