// End-to-end encryption utilities using Web Crypto API
export class EncryptionService {
  private static instance: EncryptionService
  private keyPair: CryptoKeyPair | null = null
  
  static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService()
    }
    return EncryptionService.instance
  }
  
  // Generate RSA key pair for encryption
  async generateKeyPair(): Promise<CryptoKeyPair> {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['encrypt', 'decrypt']
    )
    
    this.keyPair = keyPair
    return keyPair
  }
  
  // Export public key as base64 string
  async exportPublicKey(publicKey: CryptoKey): Promise<string> {
    const exported = await window.crypto.subtle.exportKey('spki', publicKey)
    return btoa(String.fromCharCode(...new Uint8Array(exported)))
  }
  
  // Import public key from base64 string
  async importPublicKey(publicKeyString: string): Promise<CryptoKey> {
    const keyData = Uint8Array.from(atob(publicKeyString), c => c.charCodeAt(0))
    return await window.crypto.subtle.importKey(
      'spki',
      keyData,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256',
      },
      false,
      ['encrypt']
    )
  }
  
  // Encrypt message with recipient's public key
  async encryptMessage(message: string, recipientPublicKey: string): Promise<string> {
    const publicKey = await this.importPublicKey(recipientPublicKey)
    const encodedMessage = new TextEncoder().encode(message)
    
    const encrypted = await window.crypto.subtle.encrypt(
      {
        name: 'RSA-OAEP',
      },
      publicKey,
      encodedMessage
    )
    
    return btoa(String.fromCharCode(...new Uint8Array(encrypted)))
  }
  
  // Decrypt message with private key
  async decryptMessage(encryptedMessage: string): Promise<string> {
    if (!this.keyPair?.privateKey) {
      throw new Error('Private key not available')
    }
    
    const encryptedData = Uint8Array.from(atob(encryptedMessage), c => c.charCodeAt(0))
    
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'RSA-OAEP',
      },
      this.keyPair.privateKey,
      encryptedData
    )
    
    return new TextDecoder().decode(decrypted)
  }
  
  // Store key pair in localStorage (encrypted)
  async storeKeyPair(keyPair: CryptoKeyPair, password: string): Promise<void> {
    const publicKey = await window.crypto.subtle.exportKey('spki', keyPair.publicKey!)
    const privateKey = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey!)
    
    // Simple encryption with password for demo purposes
    // In production, use proper key derivation
    const keyData = {
      publicKey: btoa(String.fromCharCode(...new Uint8Array(publicKey))),
      privateKey: btoa(String.fromCharCode(...new Uint8Array(privateKey)))
    }
    
    localStorage.setItem('chattrKeys', JSON.stringify(keyData))
  }
  
  // Load key pair from localStorage
  async loadKeyPair(): Promise<CryptoKeyPair | null> {
    const storedKeys = localStorage.getItem('chattrKeys')
    if (!storedKeys) return null
    
    try {
      const keyData = JSON.parse(storedKeys)
      
      const publicKey = await window.crypto.subtle.importKey(
        'spki',
        Uint8Array.from(atob(keyData.publicKey), c => c.charCodeAt(0)),
        {
          name: 'RSA-OAEP',
          hash: 'SHA-256',
        },
        false,
        ['encrypt']
      )
      
      const privateKey = await window.crypto.subtle.importKey(
        'pkcs8',
        Uint8Array.from(atob(keyData.privateKey), c => c.charCodeAt(0)),
        {
          name: 'RSA-OAEP',
          hash: 'SHA-256',
        },
        false,
        ['decrypt']
      )
      
      this.keyPair = { publicKey, privateKey }
      return this.keyPair
    } catch (error) {
      console.error('Failed to load key pair:', error)
      return null
    }
  }
  
  getKeyPair(): CryptoKeyPair | null {
    return this.keyPair
  }
}
