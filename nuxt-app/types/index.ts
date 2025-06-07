/**
 * TypeScript type definitions for the Chattr application
 * Defines interfaces for users, messages, authentication, and encryption
 */

/**
 * User interface for client-side representation (camelCase)
 */
export interface User {
  id: string
  email: string
  username: string
  displayName: string
  avatar?: string
  publicKey: string
  createdAt: Date
  lastSeen: Date
  // Optional fields for conversation list
  lastMessage?: string
  lastMessageTime?: Date
  unreadCount?: number
}

/**
 * Chat message interface with encryption support
 */
export interface ChatMessage {
  id: string
  senderId: string
  receiverId: string
  content: string
  encryptedContent: string
  timestamp: Date
  delivered: boolean
  read: boolean
}

/**
 * Chat room interface for managing conversations
 */
export interface ChatRoom {
  id: string
  participants: string[]
  lastMessage?: ChatMessage
  unreadCount: number
  createdAt: Date
}

/**
 * Authentication state interface with security features
 */
export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  encryptionPassword?: string // Temporarily store password for encryption service - expires after 30 minutes
  passwordExpiration?: number // Timestamp when password expires
}

/**
 * Database user interface for raw data from Supabase (snake_case)
 * Used for type-safe database operations
 */
export interface DbUser {
  id: string;
  email: string;
  username: string;
  display_name: string;
  avatar?: string;
  public_key: string;
  encrypted_private_key?: string; // Server-stored encrypted private key
  key_salt?: string;              // Salt for key derivation
  key_iv?: string;                // IV for key encryption
  created_at: string; // ISO string from DB
  last_seen: string;  // ISO string from DB
}

/**
 * Encryption keys interface for RSA key pairs
 */
export interface EncryptionKeys {
  publicKey: CryptoKey
  privateKey: CryptoKey
}

/**
 * Message payload interface for sending encrypted messages
 */
export interface MessagePayload {
  content: string
  receiverId: string
  encryptedContent: string
}

/**
 * Socket message interface for real-time communication
 */
export interface SocketMessage {
  type: 'message' | 'typing' | 'online' | 'offline'
  data: any
}
