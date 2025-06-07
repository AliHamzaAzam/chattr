import type { User, AuthState, DbUser } from '~/types' // Import DbUser
import { EncryptionService } from '~/utils/encryption'
import { SecurityUtils } from '~/utils/security'
import { AuditLogger } from '~/utils/audit'
import { ConfigService } from '~/utils/config'

/**
 * Authentication composable providing user registration, login, and session management
 * Integrates with Supabase for authentication and includes encryption key management
 * Features security auditing, password validation, and OAuth support
 */
export const useAuth = () => {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  
  // Initialize configuration
  const config = ConfigService.getInstance()
  const securityConfig = config.getSecurityConfig()
  
  // Initialize encryption service with Supabase client
  const encryptionService = EncryptionService.getInstance()
  encryptionService.setSupabaseClient(supabase)
  
  // Initialize audit logger
  const auditLogger = AuditLogger.getInstance()
  auditLogger.setSupabaseClient(supabase)
  
  const authState = useState<AuthState>('auth.state', () => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    encryptionPassword: undefined,
    passwordExpiration: undefined
  }))
  
  /**
   * Register a new user with email/password authentication
   * @param email - User's email address
   * @param password - User's password (validated for strength)
   * @param username - Unique username
   * @param displayName - User's display name
   * @returns Promise with registration result and email confirmation status
   */
  const signUp = async (email: string, password: string, username: string, displayName: string) => {
    try {
      authState.value.isLoading = true
      
      // Validate inputs for security
      if (!SecurityUtils.validateEmail(email)) {
        throw new Error('Invalid email format')
      }
      
      const passwordValidation = SecurityUtils.validatePasswordStrength(password)
      if (!passwordValidation.isValid) {
        throw new Error(`Password requirements not met: ${passwordValidation.errors.join(', ')}`)
      }
      
      if (SecurityUtils.isCommonPassword(password)) {
        throw new Error('Password is too common. Please choose a more secure password.')
      }
      
      // Sanitize inputs
      username = SecurityUtils.sanitizeInput(username)
      displayName = SecurityUtils.sanitizeInput(displayName)
      
      if (username.length < 3) {
        throw new Error('Username must be at least 3 characters long')
      }
      
      // Check if username is available
      const { data: existingUser } = await supabase
        .from('users')
        .select('username')
        .eq('username', username)
        .single()
      
      if (existingUser) {
        throw new Error('Username is already taken')
      }
      
      // Create Supabase auth user
      console.log('Creating auth user for:', email)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            display_name: displayName
          }
        }
      })
      
      if (authError) {
        console.error('Auth signup error:', authError)
        throw authError
      }
      
      console.log('Auth user created:', authData.user?.id)
      
      if (!authData.user?.id) {
        throw new Error('Failed to create auth user - no user ID returned')
      }
      
      // Check if email confirmation is required
      if (!authData.user.email_confirmed_at) {
        console.log('Email confirmation required - profile will be created after confirmation')
        return { 
          success: true, 
          requiresEmailConfirmation: true,
          message: 'Please check your email and click the confirmation link to complete registration.'
        }
      }
      
      // If email is already confirmed (email confirmation disabled), create profile now
      console.log('Email confirmed - creating profile immediately')
      await createUserProfile(authData.user.id, email, username, displayName, password)
      
      // Store the encryption password securely with expiration after successful profile creation
      const expirationTime = Date.now() + (securityConfig.passwordExpirationMinutes * 60 * 1000)
      authState.value.encryptionPassword = password
      authState.value.passwordExpiration = expirationTime
      console.log('🔐 Encryption password stored securely after signup')
      
      return { success: true, requiresEmailConfirmation: false }
    } catch (error: any) {
      console.error('Sign up error:', error)
      throw new Error(error.message || 'Failed to create account')
    } finally {
      authState.value.isLoading = false
    }
  }
  
  /**
   * Create user profile after successful authentication
   * Generates encryption keys and stores user data in database
   * @param userId - Supabase user ID
   * @param email - User's email address
   * @param username - User's username
   * @param displayName - User's display name
   * @param password - Optional password for key encryption (OAuth users don't provide this)
   */
  const createUserProfile = async (userId: string, email: string, username: string, displayName: string, password?: string) => {
    try {
      // Generate encryption keys
      console.log('Generating encryption keys...')
      const encryptionService = EncryptionService.getInstance()
      encryptionService.setSupabaseClient(supabase)
      const keyPair = await encryptionService.generateKeyPair()
      const publicKey = await encryptionService.exportPublicKey(keyPair.publicKey!)
      console.log('Public key generated, length:', publicKey?.length)
      
      // Store encrypted keys if password is provided
      if (password) {
        console.log('Storing encrypted keys...')
        await encryptionService.storeEncryptedKeyPair(keyPair, password, userId)
        console.log('Keys stored successfully')
      } else {
        console.log('No password provided - keys will be stored in session only for OAuth users')
        // For OAuth users, just keep keys in memory for the session
        // The keyPair is already stored in the service instance from generateKeyPair()
      }
      
      // Check if user profile already exists
      console.log('Checking if user profile exists...')
      const { data: existingProfile } = await supabase
        .from('users')
        .select('id, username, display_name, public_key')
        .eq('id', userId)
        .maybeSingle()
      
      if (existingProfile) {
        console.log('User profile already exists, updating...')
        const { error: updateError } = await (supabase as any)
          .from('users')
          .update({
            username,
            display_name: displayName,
            public_key: publicKey
          })
          .eq('id', userId)
        
        if (updateError) {
          console.error('Failed to update user profile:', updateError)
          throw new Error(`Failed to update user profile: ${updateError.message}`)
        }
        console.log('User profile updated successfully')
      } else {
        console.log('Creating new user profile...')
        const { error: insertError } = await (supabase as any)
          .from('users')
          .insert([{
            id: userId,
            email: email,
            username,
            display_name: displayName,
            public_key: publicKey
          }])
        
        if (insertError) {
          console.error('User profile creation failed:', insertError)
          throw new Error(`Failed to create user profile: ${insertError.message}`)
        }
        console.log('User profile created successfully')
      }
    } catch (error: any) {
      console.error('Create user profile error:', error)
      throw error
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
      
      // Initialize encryption service with password
      const encryptionService = EncryptionService.getInstance()
      encryptionService.setSupabaseClient(supabase)
      
      console.log('🔐 Initializing encryption service universally...')
      
      let keysInitialized = false
      let hasKeys = false
      
      try {
        // Universal initialization with reasonable timeout
        console.log('🔑 Starting encryption initialization...')
        
        // Check if keys exist first
        hasKeys = await encryptionService.hasStoredKeys(data.user!.id)
        console.log('🔑 Has stored keys:', hasKeys)
        
        if (hasKeys) {
          // Keys exist, try to load them with universal timeout
          const initPromise = encryptionService.initializeWithPassword(password, data.user!.id)
          const timeoutPromise = new Promise<boolean>((_, reject) => 
            setTimeout(() => reject(new Error('Encryption initialization timeout')), 12000) // Universal 12s timeout
          )
          
          keysInitialized = await Promise.race([initPromise, timeoutPromise])
        } else {
          console.log('🔑 No keys found - will generate new ones')
          keysInitialized = false
        }
      } catch (initError) {
        console.warn('🔑 Encryption initialization failed:', initError)
        keysInitialized = false
      }
      
      if (!keysInitialized) {
        console.log('🔑 Generating new encryption keys...')
        
        try {
          const keyPair = await encryptionService.generateKeyPair()
          await encryptionService.storeEncryptedKeyPair(keyPair, password, data.user!.id)
          console.log('✅ New encryption keys generated and stored')
        } catch (keyGenError) {
          console.error('❌ Failed to generate new keys:', keyGenError)
          // Continue with login even if key generation fails
        }
      } else {
        console.log('✅ Encryption keys loaded successfully')
      }
      
      // Store the encryption password temporarily and securely
      // Only store if encryption initialization was successful
      if (keysInitialized || !hasKeys) {
        // Set expiration time from config
        const expirationTime = Date.now() + (securityConfig.passwordExpirationMinutes * 60 * 1000)
        authState.value.encryptionPassword = password
        authState.value.passwordExpiration = expirationTime
        console.log('🔐 Encryption password stored securely with expiration')
        
        // Log successful login
        await auditLogger.logSecurityEvent('LOGIN_SUCCESS', data.user!.id, {
          hasStoredKeys: hasKeys,
          keysInitialized
        })
      } else {
        console.error('🔐 Password validation failed - not storing password')
        // Log failed login
        await auditLogger.logSecurityEvent('LOGIN_FAILURE', data.user!.id, {
          reason: 'Key decryption failed'
        })
        throw new Error('Invalid password - unable to decrypt existing keys')
      }
      
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
      
      // Clear keys from EncryptionService instance
      const encryptionService = EncryptionService.getInstance()
      encryptionService.clearKeys()
      
      // Reset state and clear sensitive data
      authState.value.user = null
      authState.value.isAuthenticated = false
      authState.value.encryptionPassword = undefined
      authState.value.passwordExpiration = undefined
      
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
      // Fetch data from Supabase, explicitly type the expected raw data as DbUser
      const { data: dbData, error } = await supabase
        .from('users')
        .select('id, email, username, display_name, avatar, public_key, created_at, last_seen')
        .eq('id', user.value.id)
        .single<DbUser>() // Use DbUser here
      
      if (error) throw error
      if (!dbData) return null
      
      // Map from DbUser (snake_case) to User (camelCase)
      const userData: User = {
        id: dbData.id,
        email: dbData.email,
        username: dbData.username,
        displayName: dbData.display_name,
        avatar: dbData.avatar,
        publicKey: dbData.public_key,
        createdAt: new Date(dbData.created_at),
        lastSeen: new Date(dbData.last_seen)
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
    
    // TODO: Fix TypeScript issue with Supabase update
    /*
    try {
      const { error } = await supabase
        .from('users')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', user.value.id)
      
      if (error) {
        console.error('Update last seen error:', error)
      }
    } catch (error) {
      console.error('Update last seen error:', error)
    }
    */
  }
  
  // Method to update encryption password from other composables
  const updateEncryptionPassword = (password: string | undefined, expiration?: number) => {
    authState.value.encryptionPassword = password
    authState.value.passwordExpiration = expiration || (password ? Date.now() + (securityConfig.passwordExpirationMinutes * 60 * 1000) : undefined)
  }

  // Clear sensitive data from memory (for security plugin)
  const clearSensitiveData = () => {
    authState.value.encryptionPassword = undefined
    authState.value.passwordExpiration = undefined
    console.log('🔐 Sensitive data cleared from auth state')
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
    updateLastSeen,
    createUserProfile,
    updateEncryptionPassword,
    clearSensitiveData
  }
}
