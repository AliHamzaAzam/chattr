import type { ChatMessage, ChatRoom, User } from '~/types'
import { EncryptionService } from '~/utils/encryption'
import { SocketService } from '~/utils/socket'

export const useChat = () => {
  const supabase = useSupabaseClient()
  const { authState } = useAuth()
  
  const messages = useState<ChatMessage[]>('chat.messages', () => [])
  const activeRoom = useState<ChatRoom | null>('chat.activeRoom', () => null)
  const onlineUsers = useState<string[]>('chat.onlineUsers', () => [])
  const typingUsers = useState<Set<string>>('chat.typingUsers', () => new Set())
  
  const encryptionService = EncryptionService.getInstance()
  const socketService = SocketService.getInstance()
  
  // Initialize chat
  const initializeChat = () => {
    if (!authState.value.user) return
    
    // Connect to socket
    socketService.connect(authState.value.user.id)
    
    // Set up socket listeners
    socketService.onMessage(handleIncomingMessage)
    socketService.onUserOnline(handleUserOnline)
    socketService.onUserOffline(handleUserOffline)
    socketService.onTyping(handleTyping)
  }
  
  // Handle incoming message
  const handleIncomingMessage = async (message: ChatMessage) => {
    try {
      // Decrypt message if it's for us
      if (message.receiverId === authState.value.user?.id) {
        const decryptedContent = await encryptionService.decryptMessage(message.encryptedContent)
        message.content = decryptedContent
      }
      
      messages.value.push(message)
      
      // Mark as delivered
      await markMessageAsDelivered(message.id)
    } catch (error) {
      console.error('Error handling incoming message:', error)
    }
  }
  
  const handleUserOnline = (userId: string) => {
    if (!onlineUsers.value.includes(userId)) {
      onlineUsers.value.push(userId)
    }
  }
  
  const handleUserOffline = (userId: string) => {
    onlineUsers.value = onlineUsers.value.filter(id => id !== userId)
  }
  
  const handleTyping = (data: { userId: string, typing: boolean }) => {
    if (data.typing) {
      typingUsers.value.add(data.userId)
    } else {
      typingUsers.value.delete(data.userId)
    }
  }
  
  // Send message
  const sendMessage = async (content: string, receiverId: string) => {
    if (!authState.value.user) throw new Error('User not authenticated')
    
    try {
      // Get recipient's public key
      const { data: recipient, error } = await supabase
        .from('users')
        .select('public_key')
        .eq('id', receiverId)
        .single()
      
      if (error) throw error
      
      // Encrypt message
      const encryptedContent = await encryptionService.encryptMessage(content, recipient.public_key)
      
      const message: ChatMessage = {
        id: crypto.randomUUID(),
        senderId: authState.value.user.id,
        receiverId,
        content,
        encryptedContent,
        timestamp: new Date(),
        delivered: false,
        read: false
      }
      
      // Save to database
      const { error: dbError } = await supabase
        .from('messages')
        .insert({
          id: message.id,
          sender_id: message.senderId,
          receiver_id: message.receiverId,
          encrypted_content: message.encryptedContent,
          timestamp: message.timestamp.toISOString(),
          delivered: false,
          read: false
        })
      
      if (dbError) throw dbError
      
      // Send via socket
      socketService.sendMessage(message)
      
      // Add to local messages
      messages.value.push(message)
      
      return message
    } catch (error) {
      console.error('Error sending message:', error)
      throw error
    }
  }
  
  // Get chat history with a user
  const getChatHistory = async (userId: string) => {
    if (!authState.value.user) return []
    
    try {
      const currentUserId = authState.value.user.id
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUserId})`)
        .order('timestamp', { ascending: true })
      
      if (error) throw error
      
      const chatMessages: ChatMessage[] = []
      
      for (const msg of data || []) {
        try {
          const message: ChatMessage = {
            id: msg.id,
            senderId: msg.sender_id,
            receiverId: msg.receiver_id,
            content: '',
            encryptedContent: msg.encrypted_content,
            timestamp: new Date(msg.timestamp),
            delivered: msg.delivered,
            read: msg.read
          }
          
          // Decrypt if it's a message we received
          if (msg.receiver_id === currentUserId) {
            try {
              message.content = await encryptionService.decryptMessage(msg.encrypted_content)
            } catch (decryptError) {
              console.error('Error decrypting received message:', decryptError)
              message.content = '[Message could not be decrypted]'
            }
          } else {
            // For sent messages, we'll show a placeholder for now
            // In a real implementation, you'd store the original content or decrypt differently
            message.content = '[Sent message]'
          }
          
          chatMessages.push(message)
        } catch (error) {
          console.error('Error processing message:', error)
        }
      }
      
      messages.value = chatMessages
      return chatMessages
    } catch (error) {
      console.error('Error getting chat history:', error)
      return []
    }
  }
  
  // Search users
  const searchUsers = async (query: string): Promise<User[]> => {
    if (!query.trim()) return []
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .neq('id', authState.value.user?.id)
        .limit(10)
      
      if (error) throw error
      
      return data.map((user: any) => ({
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.display_name,
        avatar: user.avatar,
        publicKey: user.public_key,
        createdAt: new Date(user.created_at),
        lastSeen: new Date(user.last_seen)
      }))
    } catch (error) {
      console.error('Error searching users:', error)
      return []
    }
  }
  
  // Mark message as delivered
  const markMessageAsDelivered = async (messageId: string) => {
    try {
      await supabase
        .from('messages')
        .update({ delivered: true })
        .eq('id', messageId)
    } catch (error) {
      console.error('Error marking message as delivered:', error)
    }
  }
  
  // Mark message as read
  const markMessageAsRead = async (messageId: string) => {
    try {
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('id', messageId)
    } catch (error) {
      console.error('Error marking message as read:', error)
    }
  }
  
  // Start typing
  const startTyping = (receiverId: string) => {
    socketService.emitTyping(receiverId, true)
  }
  
  // Stop typing
  const stopTyping = (receiverId: string) => {
    socketService.emitTyping(receiverId, false)
  }
  
  // Cleanup
  const cleanup = () => {
    socketService.disconnect()
    messages.value = []
    activeRoom.value = null
    onlineUsers.value = []
    typingUsers.value.clear()
  }
  
  return {
    messages: readonly(messages),
    activeRoom: readonly(activeRoom),
    onlineUsers: readonly(onlineUsers),
    typingUsers: readonly(typingUsers),
    initializeChat,
    sendMessage,
    getChatHistory,
    searchUsers,
    markMessageAsRead,
    startTyping,
    stopTyping,
    cleanup
  }
}
