/**
 * Security plugin to handle sensitive data cleanup
 * Automatically clears encryption passwords and keys from memory
 * on browser events and password expiration
 */
import { EncryptionService } from '~/utils/encryption'

export default defineNuxtPlugin(() => {
  // Clear sensitive data on page unload/refresh for security
  if (process.client) {
    const { authState, clearSensitiveData } = useAuth()
    
    /**
     * Clear passwords when user navigates away or closes tab
     * Prevents sensitive data from staying in memory
     */
    const clearSensitiveDataOnBrowserEvent = () => {
      if (authState.value.encryptionPassword) {
        clearSensitiveData()
        
        // Clear encryption service keys
        const encryptionService = EncryptionService.getInstance()
        encryptionService.clearKeys()
      }
    }

    // Set up event listeners for automatic security cleanup
    window.addEventListener('beforeunload', clearSensitiveDataOnBrowserEvent)
    window.addEventListener('pagehide', clearSensitiveDataOnBrowserEvent)
    
    /**
     * Periodic cleanup of expired passwords
     * Checks if stored passwords have exceeded their expiration time
     */
    const checkPasswordExpiration = () => {
      if (authState.value.passwordExpiration && 
          Date.now() > authState.value.passwordExpiration) {
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
