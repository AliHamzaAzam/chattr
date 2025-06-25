/**
 * Security audit logging utility for tracking security events
 * Implements singleton pattern for centralized logging
 */
export class AuditLogger {
  private static instance: AuditLogger
  private supabase: any = null
  
  static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger()
    }
    return AuditLogger.instance
  }
  
  /**
   * Set the Supabase client for database operations
   */
  setSupabaseClient(supabase: any): void {
    this.supabase = supabase
  }
  
  /**
   * Log security events to database and console
   * @param eventType - Type of security event
   * @param userId - User ID associated with the event (null for anonymous events)
   * @param details - Additional event details
   */
  async logSecurityEvent(
    eventType: 'LOGIN_SUCCESS' | 'LOGIN_FAILURE' | 'PASSWORD_CHANGE' | 'KEY_GENERATION' | 'DECRYPTION_FAILURE' | 'RATE_LIMIT_HIT',
    userId: string | null,
    details: Record<string, any> = {}
  ): Promise<void> {
    try {
      // Prepare the audit log entry
      const auditEntry = {
        user_id: userId, // Supabase will handle UUID conversion
        event_type: eventType,
        event_data: details,
        ip_address: await this.getClientIP(),
        user_agent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server'
        // timestamp is set by database DEFAULT NOW()
      }
      
      // Log to console in development
      if (process.dev) {
        console.log('🔍 Security Event:', auditEntry)
      }
      
      if (this.supabase) {
        try {
          const { error } = await this.supabase
            .from('security_audit_log')
            .insert([auditEntry])

          if (error) {
            throw error
          }

          if (process.dev) {
            console.log('✅ Audit log saved to database')
          }
        } catch (dbError: any) {
          // Handle specific RLS errors
          if (dbError?.message?.includes('row-level security policy')) {
            console.warn('🔍 RLS policy preventing audit log insert. Please check Supabase RLS policies for security_audit_log table.')
          } else if (dbError?.message?.includes('operator does not exist')) {
            console.warn('🔍 Database schema mismatch. Please run the latest SQL migration for security_audit_log.')
          } else {
            console.warn('🔍 Audit log database insert failed:', dbError?.message || dbError)
          }
          
          // Don't throw - just warn and continue
          if (process.dev) {
            console.log('Continuing without database audit logging...')
          }
        }
      }
    } catch (error) {
      console.error('Failed to log security event:', error)
    }
  }
  
  /**
   * Get client IP address for audit logging
   * Returns 'client', 'server', or 'unknown' based on context
   */
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
