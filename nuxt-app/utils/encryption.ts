/**
 * Universal end-to-end encryption service using Web Crypto API
 * Works consistently across all browsers without browser-specific detection
 * Implements RSA-OAEP for key encryption and AES-GCM for message encryption
 * Includes rate limiting, secure key storage, and password-based key derivation
 */
import { ConfigService } from './config'

export class EncryptionService {
  private static instance: EncryptionService
  private keyPair: CryptoKeyPair | null = null
  private supabase: any = null
  private failedAttempts: Map<string, { count: number; lastAttempt: number }> = new Map()
  private config: ConfigService

  constructor() {
    this.config = ConfigService.getInstance()
    const securityConfig = this.config.getSecurityConfig()
    this.MAX_ATTEMPTS = securityConfig.maxLoginAttempts
    this.LOCKOUT_DURATION = securityConfig.lockoutDurationMinutes * 60 * 1000
  }

  private readonly MAX_ATTEMPTS: number
  private readonly LOCKOUT_DURATION: number

  static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService()
    }
    return EncryptionService.instance
  }

  /**
   * Check rate limiting for password attempts to prevent brute force attacks
   * @param userId - User ID to check rate limiting for
   * @throws Error if user is rate limited
   */
  private checkRateLimit(userId: string): void {
    const attempts = this.failedAttempts.get(userId)
    if (attempts) {
      const timeSinceLastAttempt = Date.now() - attempts.lastAttempt
      if (attempts.count >= this.MAX_ATTEMPTS && timeSinceLastAttempt < this.LOCKOUT_DURATION) {
        const remainingTime = Math.ceil((this.LOCKOUT_DURATION - timeSinceLastAttempt) / 60000)
        throw new Error(`Too many failed attempts. Please try again in ${remainingTime} minutes.`)
      }
      // Reset if lockout period has passed
      if (timeSinceLastAttempt >= this.LOCKOUT_DURATION) {
        this.failedAttempts.delete(userId)
      }
    }
  }

  /**
   * Record a failed decryption attempt for rate limiting
   * @param userId - User ID to record failed attempt for
   */
  private recordFailedAttempt(userId: string): void {
    const attempts = this.failedAttempts.get(userId) || { count: 0, lastAttempt: 0 }
    attempts.count++
    attempts.lastAttempt = Date.now()
    this.failedAttempts.set(userId, attempts)
    console.warn(`🚨 Failed decryption attempt ${attempts.count}/${this.MAX_ATTEMPTS} for user ${userId}`)
  }

  /**
   * Clear failed attempts on successful authentication
   * @param userId - User ID to clear failed attempts for
   */
  private clearFailedAttempts(userId: string): void {
    this.failedAttempts.delete(userId)
  }

  /**
   * Set Supabase client for database operations
   * @param supabase - Supabase client instance
   */
  setSupabaseClient(supabase: any): void {
    this.supabase = supabase
  }

  /**
   * Derive AES key from password using PBKDF2 for encrypting/decrypting RSA private key
   * @param password - User password
   * @param salt - Cryptographic salt
   * @returns Derived AES key for encryption/decryption
   */
  private async deriveAESKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder()
    const passwordBuffer = encoder.encode(password)

    try {
      const importedPasswordKey = await crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      )

      const derivedKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: this.config.getSecurityConfig().keyDerivationIterations,
          hash: 'SHA-256'
        },
        importedPasswordKey,
        { 
          name: 'AES-GCM', 
          length: 256 
        },
        false,
        ['encrypt', 'decrypt']
      )
      
      return derivedKey
    } catch (error) {
      throw new Error(`Key derivation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  /**
   * Generate RSA key pair for encryption/decryption operations
   * @returns Generated RSA key pair (2048-bit)
   */
  async generateKeyPair(): Promise<CryptoKeyPair> {
    try {
      const keyPair = await crypto.subtle.generateKey(
        {
          name: 'RSA-OAEP',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256'
        },
        true,
        ['encrypt', 'decrypt']
      )
      
      this.keyPair = keyPair
      return keyPair
    } catch (error) {
      throw new Error(`Key generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  /**
   * Export public key as base64 string for storage/transmission
   * @param publicKey - RSA public key to export
   * @returns Base64 encoded public key
   */
  async exportPublicKey(publicKey: CryptoKey): Promise<string> {
    try {
      const exported = await crypto.subtle.exportKey('spki', publicKey)
      return btoa(String.fromCharCode(...new Uint8Array(exported)))
    } catch (error) {
      throw new Error(`Public key export failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  // Import public key from base64 string
  async importPublicKey(publicKeyString: string): Promise<CryptoKey> {
    try {
      const keyData = Uint8Array.from(atob(publicKeyString), c => c.charCodeAt(0))
      return await crypto.subtle.importKey(
        'spki',
        keyData,
        {
          name: 'RSA-OAEP',
          hash: 'SHA-256',
        },
        false,
        ['encrypt']
      )
    } catch (error) {
      throw new Error(`Public key import failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  // Encrypt message with recipient's public key
  async encryptMessage(message: string, recipientPublicKey: string): Promise<string> {
    try {
      const publicKey = await this.importPublicKey(recipientPublicKey)
      const encodedMessage = new TextEncoder().encode(message)
      
      const encrypted = await crypto.subtle.encrypt(
        { name: 'RSA-OAEP' },
        publicKey,
        encodedMessage
      )
      
      return btoa(String.fromCharCode(...new Uint8Array(encrypted)))
    } catch (error) {
      throw new Error(`Message encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  // Decrypt message with private key
  async decryptMessage(encryptedMessage: string): Promise<string> {
    if (!this.keyPair?.privateKey) {
      throw new Error('Private key not available. Ensure keys are loaded with password after login.')
    }
    
    try {
      const encryptedData = Uint8Array.from(atob(encryptedMessage), c => c.charCodeAt(0))
      
      const decrypted = await crypto.subtle.decrypt(
        { name: 'RSA-OAEP' },
        this.keyPair.privateKey,
        encryptedData
      )
      
      return new TextDecoder().decode(decrypted)
    } catch (error) {
      throw new Error(`Message decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  // Store key pair on server (encrypted with password-derived key)
  async storeEncryptedKeyPair(keyPair: CryptoKeyPair, password: string, userId: string): Promise<void> {
    if (!this.supabase) {
      throw new Error('Supabase client not initialized. Call setSupabaseClient() first.')
    }

    try {
      const publicKeySpki = await crypto.subtle.exportKey('spki', keyPair.publicKey!)
      const privateKeyPkcs8 = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey!)
      
      const salt = crypto.getRandomValues(new Uint8Array(16))
      const iv = crypto.getRandomValues(new Uint8Array(12))

      const aesKey = await this.deriveAESKeyFromPassword(password, salt)
      
      const encryptedPrivateKey = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        aesKey,
        privateKeyPkcs8 
      )
      
      const { error } = await this.supabase
        .from('users')
        .update({
          public_key: btoa(String.fromCharCode(...new Uint8Array(publicKeySpki))),
          encrypted_private_key: btoa(String.fromCharCode(...new Uint8Array(encryptedPrivateKey))),
          key_salt: btoa(String.fromCharCode(...salt)),
          key_iv: btoa(String.fromCharCode(...iv))
        })
        .eq('id', userId)

      if (error) {
        throw new Error(`Failed to store encrypted keys: ${error.message}`)
      }

      this.keyPair = keyPair
    } catch (error) {
      throw new Error(`Key storage failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  // Load key pair from server (decrypted with password-derived key)
  async loadAndDecryptKeyPair(password: string, userId: string): Promise<CryptoKeyPair | null> {
    if (!this.supabase) {
      throw new Error('Supabase client not initialized. Call setSupabaseClient() first.')
    }

    // Check rate limiting
    this.checkRateLimit(userId)

    try {
      const { data: userData, error } = await this.supabase
        .from('users')
        .select('public_key, encrypted_private_key, key_salt, key_iv')
        .eq('id', userId)
        .single()

      if (error || !userData?.encrypted_private_key || !userData?.key_salt || !userData?.key_iv) {
        return null
      }
      
      const salt = Uint8Array.from(atob(userData.key_salt), c => c.charCodeAt(0))
      const iv = Uint8Array.from(atob(userData.key_iv), c => c.charCodeAt(0))
      const encryptedPrivateKeyBytes = Uint8Array.from(atob(userData.encrypted_private_key), c => c.charCodeAt(0))
      
      const aesKey = await this.deriveAESKeyFromPassword(password, salt)
      
      const decryptedPrivateKeyPkcs8 = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        aesKey,
        encryptedPrivateKeyBytes
      )
      
      const publicKey = await crypto.subtle.importKey(
        'spki',
        Uint8Array.from(atob(userData.public_key), c => c.charCodeAt(0)),
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        true,
        ['encrypt']
      )
      
      const privateKey = await crypto.subtle.importKey(
        'pkcs8',
        decryptedPrivateKeyPkcs8,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        true,
        ['decrypt']
      )
      
      this.keyPair = { publicKey, privateKey }
      // Clear failed attempts on successful decryption
      this.clearFailedAttempts(userId)
      console.log('✅ Keys successfully decrypted and loaded')
      return this.keyPair
    } catch (error) {
      // Record failed attempt for rate limiting
      this.recordFailedAttempt(userId)
      console.error('❌ Key decryption failed:', error instanceof Error ? error.message : 'Unknown error')
      return null // Invalid password or corrupted data
    }
  }

  // Encrypt message for dual storage (sender + receiver can both read)
  async encryptMessageDual(message: string, recipientPublicKey: string, senderPublicKey: string): Promise<{
    forRecipient: string,
    forSender: string
  }> {
    try {
      const recipientKey = await this.importPublicKey(recipientPublicKey)
      const senderKey = await this.importPublicKey(senderPublicKey)
      const encodedMessage = new TextEncoder().encode(message)
      
      const [encryptedForRecipient, encryptedForSender] = await Promise.all([
        crypto.subtle.encrypt({ name: 'RSA-OAEP' }, recipientKey, encodedMessage),
        crypto.subtle.encrypt({ name: 'RSA-OAEP' }, senderKey, encodedMessage)
      ])
      
      return {
        forRecipient: btoa(String.fromCharCode(...new Uint8Array(encryptedForRecipient))),
        forSender: btoa(String.fromCharCode(...new Uint8Array(encryptedForSender)))
      }
    } catch (error) {
      throw new Error(`Dual encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Check if keys exist on server
  async hasStoredKeys(userId: string): Promise<boolean> {
    if (!this.supabase || !userId) {
      return false
    }

    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('encrypted_private_key')
        .eq('id', userId)
        .single()

      if (error) return false
      return Boolean(data?.encrypted_private_key)
    } catch {
      return false
    }
  }

  // Clear keys from the service instance
  clearKeys(): void {
    this.keyPair = null
    console.log('🔐 Encryption keys cleared from memory')
  }

  // Initialize encryption service by loading existing keys with password
  async initializeWithPassword(password: string, userId: string): Promise<boolean> {
    if (this.keyPair) {
      return true // Already initialized
    }
    
    try {
      const loadedKeyPair = await this.loadAndDecryptKeyPair(password, userId)
      return Boolean(loadedKeyPair)
    } catch (error) {
      return false
    }
  }
}
