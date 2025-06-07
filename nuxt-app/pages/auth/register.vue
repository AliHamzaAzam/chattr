<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
    <div class="max-w-md w-full space-y-8">
      <div class="text-center">
        <h1 class="text-4xl font-bold text-gray-900 mb-2">chattr</h1>
        <p class="text-gray-600">Create your secure messaging account</p>
      </div>
      
      <div class="bg-white rounded-lg shadow-lg p-8">
        <h2 class="text-2xl font-semibold text-gray-900 mb-6 text-center">Sign Up</h2>
        
        <form @submit.prevent="handleSignUp" class="space-y-6">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="displayName" class="block text-sm font-medium text-gray-700 mb-2">
                Display Name
              </label>
              <input
                id="displayName"
                v-model="displayName"
                type="text"
                required
                class="input-field"
                placeholder="John Doe"
              />
            </div>
            
            <div>
              <label for="username" class="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                id="username"
                v-model="username"
                type="text"
                required
                pattern="[a-zA-Z0-9_]+"
                class="input-field"
                placeholder="johndoe"
                @input="validateUsername"
              />
              <p class="text-xs text-gray-500 mt-1">Letters, numbers, and underscores only</p>
            </div>
          </div>
          
          <div>
            <label for="email" class="block text-sm font-medium text-gray-700 mb-2">
              Email address
            </label>
            <input
              id="email"
              v-model="email"
              type="email"
              required
              class="input-field"
              placeholder="john@example.com"
            />
          </div>
          
          <div>
            <label for="password" class="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              id="password"
              v-model="password"
              type="password"
              required
              minlength="8"
              class="input-field"
              placeholder="Create a strong password"
            />
            <p class="text-xs text-gray-500 mt-1">At least 8 characters</p>
          </div>
          
          <div>
            <label for="confirmPassword" class="block text-sm font-medium text-gray-700 mb-2">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              v-model="confirmPassword"
              type="password"
              required
              class="input-field"
              placeholder="Confirm your password"
            />
          </div>
          
          <div v-if="error" class="text-red-600 text-sm text-center">
            {{ error }}
          </div>
          
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div class="flex">
              <svg class="w-5 h-5 text-blue-400 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
              </svg>
              <div class="text-sm text-blue-800">
                <p class="font-medium">End-to-end encryption</p>
                <p>Your messages are encrypted on your device and can only be read by you and the recipient.</p>
              </div>
            </div>
          </div>
          
          <button
            type="submit"
            :disabled="loading || !isFormValid"
            class="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="loading">Creating account...</span>
            <span v-else>Create account</span>
          </button>
        </form>
        
        <div class="mt-6">
          <div class="relative">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-gray-300" />
            </div>
            <div class="relative flex justify-center text-sm">
              <span class="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>
          
          <button
            @click="handleGoogleSignIn"
            :disabled="loading"
            class="mt-4 w-full btn-secondary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>
        </div>
        
        <div class="mt-6 text-center">
          <p class="text-sm text-gray-600">
            Already have an account?
            <NuxtLink to="/auth/login" class="text-blue-600 hover:text-blue-500 font-medium">
              Sign in
            </NuxtLink>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: false,
  middleware: 'guest'
})

const { signUp, signInWithGoogle, authState } = useAuth()

const displayName = ref('')
const username = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')

const loading = computed(() => authState.value.isLoading)

const isFormValid = computed(() => {
  return displayName.value.trim() &&
         username.value.trim() &&
         email.value.trim() &&
         password.value.length >= 8 &&
         password.value === confirmPassword.value
})

const validateUsername = () => {
  username.value = username.value.replace(/[^a-zA-Z0-9_]/g, '')
}

const handleSignUp = async () => {
  error.value = ''
  
  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match'
    return
  }
  
  try {
    const result = await signUp(email.value, password.value, username.value, displayName.value)
    
    if (result.requiresEmailConfirmation) {
      await navigateTo('/auth/login?message=' + encodeURIComponent(result.message || 'Please check your email for verification.'))
    } else {
      // Email confirmation is disabled, user is immediately active
      await navigateTo('/chat')
    }
  } catch (err: any) {
    error.value = err.message
  }
}

const handleGoogleSignIn = async () => {
  error.value = ''
  
  try {
    await signInWithGoogle()
  } catch (err: any) {
    error.value = err.message
  }
}
</script>
