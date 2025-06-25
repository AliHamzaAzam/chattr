/**
 * Centralized configuration management service
 * Implements singleton pattern for consistent config access across the application
 */
export class ConfigService {
  private static instance: ConfigService
  private config: any = null

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService()
    }
    return ConfigService.instance
  }

  /**
   * Initialize configuration using Nuxt runtime config
   */
  initialize() {
    if (process.client) {
      this.config = useRuntimeConfig()
    }
  }

  /**
   * Get security configuration settings
   */
  getSecurityConfig() {
    return {
      passwordExpirationMinutes: 30,
      maxLoginAttempts: 5,
      lockoutDurationMinutes: 15,
      keyDerivationIterations: 60000
    }
  }
}
