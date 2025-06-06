import type { User, AuthState } from '~/types'
import { EncryptionService } from '~/utils/encryption'

export const useAuth = () => {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  
  const authState = useState<AuthState>('auth.state', () => ({
    user: null,
    isAuthenticated: false,
    isLoading: false
  }))
  
  const signUp = async (email: string, password: string, username: string, displayName: string) => {
    try {
      authState.value.isLoading = true
      
      // Check if username is available
      const { data: existingUser } = await supabase
        .from('users')
        .select('username')
        .eq('username', username)
        .single()
      
      if (existingUser) {
        throw new Error('Username is already taken')
      }
      
      // Generate encryption keys
      const encryptionService = EncryptionService.getInstance()
      const keyPair = await encryptionService.generateKeyPair()
      const publicKey = await encryptionService.exportPublicKey(keyPair.publicKey!)
      
      // Create Supabase auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password
      })
      
      if (authError) throw authError
      
      // Create user profile
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user!.id,
          email,
          username,
          display_name: displayName,
          public_key: publicKey,
          created_at: new Date().toISOString(),
          last_seen: new Date().toISOString()
        })
      
      if (profileError) throw profileError
      
      // Store keys locally
      await encryptionService.storeKeyPair(keyPair, password)
      
      return { success: true }
    } catch (error: any) {
      console.error('Sign up error:', error)
      throw new Error(error.message || 'Failed to create account')
    } finally {
      authState.value.isLoading = false
    }
  }
  
  const signIn = async (email: string, password: string) => {
    try {
      authState.value.isLoading = true
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (error) throw error
      
      // Load encryption keys
      const encryptionService = EncryptionService.getInstance()
      await encryptionService.loadKeyPair()
      
      return { success: true }
    } catch (error: any) {
      console.error('Sign in error:', error)
      throw new Error(error.message || 'Failed to sign in')
    } finally {
      authState.value.isLoading = false
    }
  }
  
  const signInWithGoogle = async () => {
    try {
      authState.value.isLoading = true
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      })
      
      if (error) throw error
      
      return { success: true }
    } catch (error: any) {
      console.error('Google sign in error:', error)
      throw new Error(error.message || 'Failed to sign in with Google')
    } finally {
      authState.value.isLoading = false
    }
  }
  
  const signOut = async () => {
    try {
      authState.value.isLoading = true
      
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      // Clear local storage
      localStorage.removeItem('chattrKeys')
      
      // Reset state
      authState.value.user = null
      authState.value.isAuthenticated = false
      
      await navigateTo('/auth/login')
    } catch (error: any) {
      console.error('Sign out error:', error)
      throw new Error(error.message || 'Failed to sign out')
    } finally {
      authState.value.isLoading = false
    }
  }
  
  const getCurrentUser = async (): Promise<User | null> => {
    if (!user.value) return null
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.value.id)
        .single()
      
      if (error) throw error
      
      const userData: User = {
        id: data.id,
        email: data.email,
        username: data.username,
        displayName: data.display_name,
        avatar: data.avatar,
        publicKey: data.public_key,
        createdAt: new Date(data.created_at),
        lastSeen: new Date(data.last_seen)
      }
      
      authState.value.user = userData
      authState.value.isAuthenticated = true
      
      return userData
    } catch (error) {
      console.error('Get current user error:', error)
      return null
    }
  }
  
  const updateLastSeen = async () => {
    if (!user.value) return
    
    try {
      await supabase
        .from('users')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', user.value.id)
    } catch (error) {
      console.error('Update last seen error:', error)
    }
  }
  
  // Watch for auth state changes
  watch(user, async (newUser) => {
    if (newUser) {
      await getCurrentUser()
    } else {
      authState.value.user = null
      authState.value.isAuthenticated = false
    }
  }, { immediate: true })
  
  return {
    authState: readonly(authState),
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    getCurrentUser,
    updateLastSeen
  }
}
