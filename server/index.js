const express = require('express')
const { createServer } = require('http')
const { Server } = require('socket.io')
const cors = require('cors')

const app = express()
const server = createServer(app)

// Configure CORS
app.use(cors({
  origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
  credentials: true
}))

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    methods: ["GET", "POST"],
    credentials: true
  }
})

// Store connected users
const connectedUsers = new Map()
const userRooms = new Map()

io.on('connection', (socket) => {
  console.log('User connected:', socket.id)
  
  // Handle user authentication
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

const PORT = process.env.PORT || 3004

server.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`)
})
