import { io, Socket } from 'socket.io-client'
import type { SocketMessage, ChatMessage } from '~/types'

export class SocketService {
  private static instance: SocketService
  private socket: Socket | null = null
  private connected = false
  
  static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService()
    }
    return SocketService.instance
  }
  
  connect(userId: string): void {
    if (this.connected) return
    
    // Use the updated port that matches our server configuration
    this.socket = io('http://localhost:3004', {
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
    }
  }
  
  sendMessage(message: ChatMessage): void {
    if (this.socket && this.connected) {
      this.socket.emit('message', message)
    }
  }
  
  onMessage(callback: (message: ChatMessage) => void): void {
    if (this.socket) {
      this.socket.on('message', callback)
    }
  }
  
  onUserOnline(callback: (userId: string) => void): void {
    if (this.socket) {
      this.socket.on('user-online', callback)
    }
  }
  
  onUserOffline(callback: (userId: string) => void): void {
    if (this.socket) {
      this.socket.on('user-offline', callback)
    }
  }
  
  onTyping(callback: (data: { userId: string, typing: boolean }) => void): void {
    if (this.socket) {
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
