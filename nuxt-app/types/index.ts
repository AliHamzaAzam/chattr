export interface User {
  id: string
  email: string
  username: string
  displayName: string
  avatar?: string
  publicKey: string
  createdAt: Date
  lastSeen: Date
}

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

export interface ChatRoom {
  id: string
  participants: string[]
  lastMessage?: ChatMessage
  unreadCount: number
  createdAt: Date
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
}

export interface EncryptionKeys {
  publicKey: CryptoKey
  privateKey: CryptoKey
}

export interface MessagePayload {
  content: string
  receiverId: string
  encryptedContent: string
}

export interface SocketMessage {
  type: 'message' | 'typing' | 'online' | 'offline'
  data: any
}
