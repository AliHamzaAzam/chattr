// Security audit logging utility
export class AuditLogger {
  private static instance: AuditLogger
  private supabase: any = null
  
  static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger()
    }
    return AuditLogger.instance
  }
  
  setSupabaseClient(supabase: any): void {
    this.supabase = supabase
  }
  
  // Log security events
  async logSecurityEvent(
    eventType: 'LOGIN_SUCCESS' | 'LOGIN_FAILURE' | 'PASSWORD_CHANGE' | 'KEY_GENERATION' | 'DECRYPTION_FAILURE' | 'RATE_LIMIT_HIT',
    userId: string | null,
    details: Record<string, any> = {}
  ): Promise<void> {
    try {
      const logEntry = {
        event_type: eventType,
        user_id: userId,
        timestamp: new Date().toISOString(),
        ip_address: await this.getClientIP(),
        user_agent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
        details: JSON.stringify(details)
      }
      
      // Log to console in development
      if (process.dev) {
        console.log('🔍 Security Event:', logEntry)
      }
      
      // Store in database if available
      if (this.supabase) {
        await this.supabase
          .from('security_audit_log')
          .insert([logEntry])
      }
    } catch (error) {
      console.error('Failed to log security event:', error)
    }
  }
  
  private async getClientIP(): Promise<string> {
    try {
      if (typeof window !== 'undefined') {
        // Client-side - use a service to get IP (optional)
        return 'client'
      }
      return 'server'
    } catch {
      return 'unknown'
    }
  }
}
