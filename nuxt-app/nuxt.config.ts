// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',
  devtools: { enabled: true },
  devServer: {
    host: process.env.NUXT_HOST || 'localhost',
    port: parseInt(process.env.NUXT_PORT || '3001')
  },
  modules: [
    '@nuxtjs/tailwindcss',
    '@vueuse/nuxt',
    '@nuxtjs/supabase'
  ],
  css: ['~/assets/css/main.css'],
  // Security headers
  nitro: {
    routeRules: {
      '/**': {
        headers: {
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'X-XSS-Protection': '1; mode=block',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' ws://localhost:* wss://localhost:* http://localhost:* https://localhost:* wss: https: *.supabase.co *.supabase.com; font-src 'self' data:;"
        }
      }
    }
  },
  supabase: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_ANON_KEY,
    redirectOptions: {
      login: '/auth/login',
      callback: '/auth/callback',
      exclude: ['/', '/auth/register', '/auth-debug', '/database-check', '/encryption-debug', '/debug']
    },
    clientOptions: {
      auth: {
        flowType: 'pkce',
        autoRefreshToken: true,
        persistSession: true
      }
    }
  },
  runtimeConfig: {
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    public: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
      googleClientId: process.env.GOOGLE_CLIENT_ID,
      socketServerUrl: process.env.SOCKET_SERVER_URL || `http://${process.env.SOCKET_HOST || 'localhost'}:${process.env.SOCKET_PORT || '3002'}`,
      frontendUrl: process.env.DEV_FRONTEND_URL || `http://${process.env.NUXT_HOST || 'localhost'}:${process.env.NUXT_PORT || '3001'}`,
      backendUrl: process.env.DEV_BACKEND_URL || `http://${process.env.SOCKET_HOST || 'localhost'}:${process.env.SOCKET_PORT || '3002'}`
    }
  }
})
