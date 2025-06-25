<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
    <div class="text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <h2 class="text-xl font-semibold text-gray-900">Completing sign in...</h2>
      <p class="text-gray-600 mt-2">Please wait while we set up your account.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { EncryptionService } from '~/utils/encryption'

definePageMeta({
  layout: false
})

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const { createUserProfile } = useAuth()

onMounted(async () => {
  // Wait for auth state to be ready
  await nextTick()
  
  if (user.value) {
    try {
      // Check if user profile exists
      const { data: existingProfile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.value.id)
        .single()
      
      if (!existingProfile) {
        // Check if this is an OAuth user or email confirmation
        const isOAuth = user.value.app_metadata?.provider !== 'email'
        
        if (isOAuth) {
          // OAuth user - create profile immediately
          await createOAuthProfile()
        } else {
          // Email confirmation - check if we have signup data
          const signupData = user.value.user_metadata
          
          if (signupData?.username && signupData?.display_name) {
            // Create profile with stored signup data
            await createUserProfile(
              user.value.id,
              user.value.email!,
              signupData.username,
              signupData.display_name
            )
          } else {
            // Fallback - redirect to complete profile
            await navigateTo('/auth/complete-profile')
            return
          }
        }
      } else {
        // For existing users, we'll load keys during the sign-in process
        // The EncryptionService will need to be initialized with their password
      }
      
      // Redirect to chat
      await navigateTo('/chat')
    } catch (error) {
      console.error('Error in auth callback:', error)
      await navigateTo('/auth/login?error=Failed to complete sign in')
    }
  } else {
    // No user, redirect to login
    await navigateTo('/auth/login')
  }
})

// Helper function for OAuth users
const createOAuthProfile = async () => {
  if (!user.value) return
  
  const encryptionService = EncryptionService.getInstance()
  const keyPair = await encryptionService.generateKeyPair()
  const publicKey = await encryptionService.exportPublicKey(keyPair.publicKey!)
  
  // Generate username from email
  const email = user.value.email || ''
  const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '')
  let username = baseUsername
  let counter = 1
  
  // Ensure username is unique
  while (true) {
    const { data: existingUser } = await supabase
      .from('users')
      .select('username')
      .eq('username', username)
      .single()
    
    if (!existingUser) break
    username = `${baseUsername}${counter}`
    counter++
  }
  
  // Create profile
  await supabase
    .from('users')
    .insert({
      id: user.value.id,
      email: user.value.email,
      username,
      display_name: user.value.user_metadata?.full_name || username,
      avatar: user.value.user_metadata?.avatar_url,
      public_key: publicKey,
      created_at: new Date().toISOString(),
      last_seen: new Date().toISOString()
    } as any)
  
  // Store keys locally (with empty password for OAuth users)
  // For OAuth users, keys are kept in memory only for the session
}
</script>
