// Security plugin to handle sensitive data cleanup
import { EncryptionService } from '~/utils/encryption'

export default defineNuxtPlugin(() => {
  // Clear sensitive data on page unload/refresh
  if (process.client) {
    const { authState, clearSensitiveData } = useAuth()
    
    // Clear passwords when user navigates away or closes tab
    const clearSensitiveDataOnBrowserEvent = () => {
      if (authState.value.encryptionPassword) {
        console.log('🔐 Clearing encryption password due to browser event')
        clearSensitiveData()
        
        // Clear encryption service keys
        const encryptionService = EncryptionService.getInstance()
        encryptionService.clearKeys()
      }
    }

    // Set up event listeners for security cleanup
    window.addEventListener('beforeunload', clearSensitiveDataOnBrowserEvent)
    window.addEventListener('pagehide', clearSensitiveDataOnBrowserEvent)
    
    // Periodic cleanup of expired passwords
    const checkPasswordExpiration = () => {
      if (authState.value.passwordExpiration && 
          Date.now() > authState.value.passwordExpiration) {
        console.log('🔐 Password expired - clearing from memory')
        clearSensitiveData()
        
        const encryptionService = EncryptionService.getInstance()
        encryptionService.clearKeys()
      }
    }
    
    // Check every 5 minutes for expired passwords
    const intervalId = setInterval(checkPasswordExpiration, 5 * 60 * 1000)
    
    // Cleanup interval on app unmount
    onBeforeUnmount(() => {
      clearInterval(intervalId)
      window.removeEventListener('beforeunload', clearSensitiveDataOnBrowserEvent)
      window.removeEventListener('pagehide', clearSensitiveDataOnBrowserEvent)
    })
  }
})
