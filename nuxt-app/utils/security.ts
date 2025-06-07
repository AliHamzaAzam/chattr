/**
 * Security utility functions for input validation, sanitization, and password checking
 * Provides static methods for common security operations
 */
export class SecurityUtils {
  /**
   * Validate password strength against security requirements
   * @param password - Password to validate
   * @returns Object with validation result and error messages
   */
  static validatePasswordStrength(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = []
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long')
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter')
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter')
    }
    
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number')
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character')
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }
  
  /**
   * Sanitize user input to prevent XSS and limit length
   * @param input - User input string to sanitize
   * @returns Sanitized string
   */
  static sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove potential XSS characters
      .trim()
      .substring(0, 1000) // Limit length
  }
  
  /**
   * Validate email format using regex
   * @param email - Email address to validate
   * @returns True if email format is valid
   */
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }
  
  /**
   * Generate cryptographically secure random string
   * @param length - Length of the random string (default: 32)
   * @returns Secure random string
   */
  static generateSecureRandom(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    const array = new Uint8Array(length)
    crypto.getRandomValues(array)
    return Array.from(array, byte => chars[byte % chars.length]).join('')
  }
  
  /**
   * Check if password is in the list of commonly used passwords
   * @param password - Password to check
   * @returns True if password is commonly used
   */
  static isCommonPassword(password: string): boolean {
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123',
      'password123', 'admin', 'letmein', 'welcome', 'monkey'
    ]
    return commonPasswords.includes(password.toLowerCase())
  }
}
