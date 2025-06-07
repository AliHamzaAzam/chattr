/**
 * Chattr Socket.IO Server
 * Handles real-time messaging, user presence, and room management
 * Supports CORS configuration for development and production environments
 */

const express = require('express')
const { createServer } = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
require('dotenv').config()

const app = express()
const server = createServer(app)

// Configure CORS origins from environment variables or use secure defaults
const corsOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',').map(url => url.trim())
  : ["http://localhost:3001", "http://127.0.0.1:3001", "http://localhost:3000", "http://127.0.0.1:3000"]

console.log('CORS Origins:', corsOrigins)

// Configure CORS
app.use(cors({
  origin: corsOrigins,
  credentials: true
}))

const io = new Server(server, {
  cors: {
    origin: corsOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
})

// Store connected users and their room assignments
const connectedUsers = new Map() // userId -> socketId
const userRooms = new Map()      // userId -> Set of roomIds

io.on('connection', (socket) => {
  console.log('User connected:', socket.id)
  
  /**
   * Handle user authentication when they connect
   */
  socket.on('authenticate', (userId) => {
    if (userId) {
      connectedUsers.set(userId, socket.id)
      socket.userId = userId
      
      // Notify others that user is online
      socket.broadcast.emit('user-online', userId)
      
      console.log(`User ${userId} authenticated`)
    }
  })
  
  // Handle joining rooms
  socket.on('join-room', (roomId) => {
    socket.join(roomId)
    
    if (!userRooms.has(socket.userId)) {
      userRooms.set(socket.userId, new Set())
    }
    userRooms.get(socket.userId).add(roomId)
    
    console.log(`User ${socket.userId} joined room ${roomId}`)
  })
  
  // Handle leaving rooms
  socket.on('leave-room', (roomId) => {
    socket.leave(roomId)
    
    if (userRooms.has(socket.userId)) {
      userRooms.get(socket.userId).delete(roomId)
    }
    
    console.log(`User ${socket.userId} left room ${roomId}`)
  })
  
  // Handle messages
  socket.on('message', (messageData) => {
    console.log('Message received:', messageData)
    
    // Send message to recipient if they're online
    const recipientSocketId = connectedUsers.get(messageData.receiverId)
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('message', messageData)
    }
    
    // Also send back to sender for confirmation
    socket.emit('message-sent', {
      messageId: messageData.id,
      timestamp: new Date().toISOString()
    })
  })
  
  // Handle typing indicators
  socket.on('typing', (data) => {
    const recipientSocketId = connectedUsers.get(data.receiverId)
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('typing', {
        userId: socket.userId,
        typing: data.typing
      })
    }
  })
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id)
    
    if (socket.userId) {
      connectedUsers.delete(socket.userId)
      userRooms.delete(socket.userId)
      
      // Notify others that user is offline
      socket.broadcast.emit('user-offline', socket.userId)
    }
  })
})

const PORT = process.env.PORT || 3002
const HOST = process.env.HOST || 'localhost'

server.listen(PORT, HOST, () => {
  console.log(`Socket.IO server running on http://${HOST}:${PORT}`)
  console.log('CORS Origins:', corsOrigins)
})
