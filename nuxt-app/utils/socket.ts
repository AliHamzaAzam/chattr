import { io, Socket } from 'socket.io-client'
import type { SocketMessage, ChatMessage } from '~/types'

export class SocketService {
  private static instance: SocketService
  private socket: Socket | null = null
  private connected = false
  private currentUserId: string | null = null
  
  static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService()
    }
    return SocketService.instance
  }
  
  connect(userId: string): void {
    // If already connected with the same user, don't reconnect
    if (this.connected && this.socket && this.currentUserId === userId) {
      console.log('Socket already connected for user:', userId)
      return
    }
    
    console.log('Connecting socket for user:', userId, 'Previous user:', this.currentUserId)
    
    // Disconnect existing socket if any
    if (this.socket) {
      console.log('Disconnecting previous socket')
      this.socket.disconnect()
    }
    
    this.currentUserId = userId
    
    // Connect to the configured Socket.IO server
    const config = useRuntimeConfig()
    const socketUrl = config.public.socketServerUrl
    console.log('Connecting to socket server:', socketUrl)
    
    this.socket = io(socketUrl, {
      auth: {
        userId
      }
    })
    
    this.socket.on('connect', () => {
      console.log('Connected to chat server')
      this.connected = true
      // Authenticate with the server
      this.socket?.emit('authenticate', userId)
    })
    
    this.socket.on('disconnect', () => {
      console.log('Disconnected from chat server')
      this.connected = false
    })
    
    this.socket.on('error', (error) => {
      console.error('Socket error:', error)
    })
  }
  
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.connected = false
      this.currentUserId = null
    }
  }
  
  sendMessage(message: ChatMessage): void {
    if (this.socket && this.connected) {
      this.socket.emit('message', message)
    }
  }
  
  onMessage(callback: (message: ChatMessage) => void): void {
    if (this.socket) {
      this.socket.off('message') // Remove existing listeners
      this.socket.on('message', callback)
    }
  }
  
  onUserOnline(callback: (userId: string) => void): void {
    if (this.socket) {
      this.socket.off('user-online') // Remove existing listeners
      this.socket.on('user-online', callback)
    }
  }
  
  onUserOffline(callback: (userId: string) => void): void {
    if (this.socket) {
      this.socket.off('user-offline') // Remove existing listeners
      this.socket.on('user-offline', callback)
    }
  }
  
  onTyping(callback: (data: { userId: string, typing: boolean }) => void): void {
    if (this.socket) {
      this.socket.off('typing') // Remove existing listeners
      this.socket.on('typing', callback)
    }
  }
  
  emitTyping(receiverId: string, typing: boolean): void {
    if (this.socket && this.connected) {
      this.socket.emit('typing', { receiverId, typing })
    }
  }
  
  joinRoom(roomId: string): void {
    if (this.socket && this.connected) {
      this.socket.emit('join-room', roomId)
    }
  }
  
  leaveRoom(roomId: string): void {
    if (this.socket && this.connected) {
      this.socket.emit('leave-room', roomId)
    }
  }
  
  isConnected(): boolean {
    return this.connected
  }
}
