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
   * Get configuration value by dot-notation key
   * @param key - Configuration key (supports dot notation like 'public.supabaseUrl')
   * @param defaultValue - Default value if key is not found
   */
  get(key: string, defaultValue?: any): any {
    if (!this.config) {
      this.initialize()
    }
    
    const keys = key.split('.')
    let value = this.config
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k]
      } else {
        return defaultValue
      }
    }
    
    return value || defaultValue
  }

  /**
   * Get server URLs for different services
   */
  getServerUrls() {
    return {
      frontend: this.get('public.frontendUrl', 'http://localhost:3001'),
      backend: this.get('public.backendUrl', 'http://localhost:3002'),
      socket: this.get('public.socketServerUrl', 'http://localhost:3002'),
      supabase: this.get('public.supabaseUrl')
    }
  }

  /**
   * Check if application is running in development mode
   */
  isDevelopment(): boolean {
    return process.dev || process.env.NODE_ENV === 'development'
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

  /**
   * Get CORS origins for different environments
   * Returns an array of allowed origins with duplicates removed
   */
  getCorsOrigins(): string[] {
    const urls = this.getServerUrls()
    return [
      urls.frontend,
      urls.frontend.replace('localhost', '127.0.0.1'),
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3001'
    ].filter((url, index, array) => array.indexOf(url) === index) // Remove duplicates
  }
}
