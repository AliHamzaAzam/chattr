import type { ChatMessage, User } from '~/types'
import { EncryptionService } from '~/utils/encryption'
import { SocketService } from '~/utils/socket'
import { ConfigService } from '~/utils/config'

/**
 * Chat composable providing real-time messaging functionality
 * Handles encrypted message sending/receiving, room management, and user presence
 * Integrates with Socket.IO for real-time communication and encryption for security
 */
export const useChat = () => {
  const supabase = useSupabaseClient()
  const { authState, updateEncryptionPassword } = useAuth()
  
  // Initialize configuration
  const config = ConfigService.getInstance()
  const securityConfig = config.getSecurityConfig()
  
  const messages = useState<ChatMessage[]>('chat.messages', () => [])
  const onlineUsers = useState<string[]>('chat.onlineUsers', () => [])
  const typingUsers = useState<Set<string>>('chat.typingUsers', () => new Set())
  const initialized = useState<boolean>('chat.initialized', () => false)
  
  // Password state for encryption
  const encryptionPassword = useState<string | null>('chat.encryptionPassword', () => null)
  const needsPasswordPrompt = useState<boolean>('chat.needsPasswordPrompt', () => false)
  
  /**
   * Set and validate encryption password for message encryption
   * @param password - User's password for key decryption
   */
  const setEncryptionPassword = async (password: string) => {
    // Validate password works before storing
    try {
      const encryptionService = EncryptionService.getInstance()
      encryptionService.setSupabaseClient(supabase)
      
      if (authState.value.user?.id) {
        const isValid = await encryptionService.initializeWithPassword(password, authState.value.user.id)
        if (!isValid) {
          throw new Error('Invalid password - unable to decrypt keys')
        }
      }
      
      encryptionPassword.value = password
      // Store in auth state with expiration for consistency across browser sessions
      const expirationTime = Date.now() + (securityConfig.passwordExpirationMinutes * 60 * 1000)
      updateEncryptionPassword(password, expirationTime)
      needsPasswordPrompt.value = false
    } catch (error) {
      console.error('🔐 Password validation failed:', error)
      throw error
    }
  }
  
  // Prompt for encryption password
  const promptForEncryptionPassword = () => {
    needsPasswordPrompt.value = true
    // In a real app, this would trigger a modal/prompt component
    // For now, we'll use the user's email as a fallback
  }
  
  const encryptionService = EncryptionService.getInstance()
  const socketService = SocketService.getInstance()
  
  // Initialize chat
  const initializeChat = async () => {
    if (!authState.value.user || initialized.value) return
    
    // Inject Supabase client into encryption service
    encryptionService.setSupabaseClient(supabase)
    
    // Initialize encryption service with password (try to load existing keys)
    let encryptionInitialized = false
    
    // Use actual password from auth state with security validation
    let userPassword: string
    
    // Check if stored password is still valid (not expired)
    const isPasswordExpired = authState.value.passwordExpiration && 
                              Date.now() > authState.value.passwordExpiration
    
    if (isPasswordExpired) {
      console.warn('🔐 Stored password has expired - clearing and requesting new one')
      updateEncryptionPassword(undefined, undefined)
    }
    
    if (authState.value.encryptionPassword && !isPasswordExpired) {
      userPassword = authState.value.encryptionPassword
      console.log('🔐 Using stored encryption password from auth state')
    } else if (encryptionPassword.value) {
      userPassword = encryptionPassword.value  
      console.log('🔐 Using encryption password from chat state')
    } else {
      console.warn('🔐 No valid encryption password available - prompting user')
      promptForEncryptionPassword()
      return // Don't initialize without proper password
    }
    
    if (authState.value.user?.id) {
      encryptionInitialized = await encryptionService.initializeWithPassword(
        userPassword,
        authState.value.user.id
      )
    }
    
    // If no existing keys found, check if user has keys on server
    if (!encryptionInitialized) {
      const hasKeys = await encryptionService.hasStoredKeys(authState.value.user.id)
      
      if (!hasKeys) {
        console.warn('No encryption keys found. Generating new keys...')
        try {
          const keyPair = await encryptionService.generateKeyPair()
          // Store encrypted keys on server using password
          await encryptionService.storeEncryptedKeyPair(
            keyPair, 
            userPassword,
            authState.value.user.id
          )
          console.log('✅ New encryption keys generated and stored on server')
          encryptionInitialized = true
        } catch (generationError) {
          console.error('Critical error: Failed to generate/store new encryption keys:', generationError)
        }
      } else {
        console.error('Keys exist on server but failed to decrypt. Password may be incorrect.')
        promptForEncryptionPassword()
      }
    }
    
    if (!encryptionInitialized) {
      console.error("Encryption service could not be initialized, and key generation failed or was skipped. Chat functionality will be impaired.");
    }
    
    // Connect to socket
    socketService.connect(authState.value.user.id)
    
    // Set up socket listeners
    socketService.onMessage(handleIncomingMessage)
    socketService.onUserOnline(handleUserOnline)
    socketService.onUserOffline(handleUserOffline)
    socketService.onTyping(handleTyping)
    socketService.onMessageSent(handleMessageSent)
    socketService.onMessageDelivered(handleMessageDelivered)
    socketService.onMessageRead(handleMessageRead)
    
    // Mark as initialized
    initialized.value = true
  }
  
  // Handle incoming message
  const handleIncomingMessage = async (message: ChatMessage) => {
    try {
      // Decrypt message if it's for us
      if (message.receiverId === authState.value.user?.id) {
        const decryptedContent = await encryptionService.decryptMessage(message.encryptedContent)
        message.content = decryptedContent
        
        // Mark as delivered in database
        await markMessageAsDelivered(message.id)
        message.delivered = true
        
        // Send delivery confirmation to sender via socket
        socketService.emitMessageDelivered(message.id, message.senderId)
      }
      
      messages.value.push(message)
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
  
  // Handle message sent confirmation
  const handleMessageSent = (data: { messageId: string, timestamp: string }) => {
    console.log('Message sent confirmation:', data)
    // Message is now sent to server - this doesn't change delivered status
    // We wait for actual delivery confirmation
  }
  
  // Handle message delivered confirmation
  const handleMessageDelivered = (data: { messageId: string, deliveredAt: string }) => {
    console.log('Message delivered confirmation:', data)
    // Mark message as delivered in local state and database
    const messageIndex = messages.value.findIndex(msg => msg.id === data.messageId)
    if (messageIndex !== -1) {
      messages.value[messageIndex].delivered = true
      // Update database
      markMessageAsDelivered(data.messageId)
    }
  }
  
  // Handle message read confirmation
  const handleMessageRead = (data: { messageId: string, readBy: string, readAt: string }) => {
    console.log('Message read confirmation:', data)
    // Mark message as read in local state
    const messageIndex = messages.value.findIndex(msg => msg.id === data.messageId)
    if (messageIndex !== -1) {
      messages.value[messageIndex].read = true
    }
  }
  
  // Send message
  const sendMessage = async (content: string, receiverId: string) => {
    if (!authState.value.user) throw new Error('User not authenticated')
    
    try {
      // Get both recipient's and sender's public keys
      const [recipientResult, senderResult] = await Promise.all([
        supabase.from('users').select('public_key').eq('id', receiverId).single(),
        supabase.from('users').select('public_key').eq('id', authState.value.user.id).single()
      ])
      
      if (recipientResult.error) throw recipientResult.error
      if (senderResult.error) throw senderResult.error
      
      // Use dual encryption
      const encryptedContent = await encryptionService.encryptMessageDual(
        content, 
        (recipientResult.data as any).public_key,
        (senderResult.data as any).public_key
      )
      
      const message: ChatMessage = {
        id: crypto.randomUUID(),
        senderId: authState.value.user.id,
        receiverId,
        content, // Keep original content for sent messages in memory
        encryptedContent: encryptedContent.forRecipient,
        timestamp: new Date(),
        delivered: false,
        read: false
      }
      
      // Save to database with dual encryption
      const { error: dbError } = await supabase
        .from('messages')
        .insert({
          id: message.id,
          sender_id: message.senderId,
          receiver_id: message.receiverId,
          encrypted_content: encryptedContent.forRecipient,
          encrypted_content_for_sender: encryptedContent.forSender,
          timestamp: message.timestamp.toISOString(),
          delivered: false,
          read: false
        } as any)
      
      if (dbError) throw dbError
      
      // Send via socket
      socketService.sendMessage(message)
      
      // Add to local messages with original content for display
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
    
    console.log('📜 Loading chat history with user:', userId)
    
    try {
      const currentUserId = authState.value.user.id
      const { data, error } = await supabase
        .from('messages')
        .select('*, encrypted_content_for_sender')
        .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUserId})`)
        .order('timestamp', { ascending: true })
      
      if (error) throw error
      
      console.log(`📊 Found ${data?.length || 0} messages in database`)
      
      const chatMessages: ChatMessage[] = []
      
      for (const msg of data || []) {
        try {
          console.log('📝 Processing message:', (msg as any).id, {
            sender: (msg as any).sender_id,
            receiver: (msg as any).receiver_id,
            hasMainEncryption: !!(msg as any).encrypted_content,
            hasSenderEncryption: !!(msg as any).encrypted_content_for_sender
          })
          
          const message: ChatMessage = {
            id: (msg as any).id,
            senderId: (msg as any).sender_id,
            receiverId: (msg as any).receiver_id,
            content: '',
            encryptedContent: (msg as any).encrypted_content,
            timestamp: new Date((msg as any).timestamp),
            delivered: (msg as any).delivered,
            read: (msg as any).read
          }

          // Decrypt messages based on who sent them
          if ((msg as any).receiver_id === currentUserId) {
            // Message we received - decrypt with our private key
            console.log('📨 Decrypting received message...')
            try {
              message.content = await encryptionService.decryptMessage((msg as any).encrypted_content)
              console.log('✅ Received message decrypted successfully')
            } catch (decryptError) {
              console.error('❌ Error decrypting received message:', decryptError)
              message.content = '[Message could not be decrypted]'
            }
          } else {
            // Message we sent - try dual encryption first, then fallback
            console.log('📤 Decrypting sent message...')
            try {
              const senderEncrypted = (msg as any).encrypted_content_for_sender
              if (senderEncrypted) {
                console.log('🔐 Found sender-encrypted content, decrypting...')
                message.content = await encryptionService.decryptMessage(senderEncrypted)
                console.log('✅ Sent message decrypted successfully')
              } else {
                console.warn('⚠️ No sender-encrypted content found - this is an old message before dual encryption')
                // For old messages, we can't decrypt them since they were encrypted with recipient's key
                // But we can show a placeholder indicating this is a sent message
                message.content = '[Sent message - upgrade your encryption to view old messages]'
              }
            } catch (decryptError) {
              console.error('❌ Error decrypting sent message:', decryptError)
              message.content = '[Sent message - decryption failed]'
            }
          }
          
          chatMessages.push(message)
        } catch (error) {
          console.error('❌ Error processing message:', error)
        }
      }
      
      console.log(`📋 Processed ${chatMessages.length} messages successfully`)
      messages.value = chatMessages
      return chatMessages
    } catch (error) {
      console.error('❌ Error getting chat history:', error)
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

  // Get user conversations (users who have exchanged messages)
  const getUserConversations = async (): Promise<User[]> => {
    if (!authState.value.user) {
      console.warn('⚠️ No authenticated user found')
      return []
    }
    
    try {
      console.log('📋 Loading user conversations...')
      console.log('🔍 Current user ID:', authState.value.user.id)
      
      // Pass user ID explicitly to avoid auth.uid() issues
      const response = await (supabase as any).rpc('get_user_conversations', { 
        current_user_id: authState.value.user.id 
      })
      
      const { data, error } = response
      
      if (error) {
        console.error('❌ Error fetching conversations:', error)
        return []
      }
      
      console.log('🔍 Raw Supabase response:', data)
      console.log(`📊 Found ${Array.isArray(data) ? data.length : 0} conversations`)
      
      const conversationData = Array.isArray(data) ? data : []
      
      // Decrypt last messages for each conversation
      const conversations = await Promise.all(conversationData.map(async (conv: any) => {
        let decryptedLastMessage = ''
        
        if (conv.last_message_content) {
          try {
            console.log('🔓 Decrypting last message for user:', conv.username)
            decryptedLastMessage = await encryptionService.decryptMessage(conv.last_message_content)
            console.log('✅ Last message decrypted successfully')
          } catch (error) {
            console.error('❌ Error decrypting last message:', error)
            decryptedLastMessage = '[Message could not be decrypted]'
          }
        }
        
        return {
          id: conv.user_id,
          email: '', // Not returned by function for privacy
          username: conv.username,
          displayName: conv.display_name,
          avatar: conv.avatar,
          publicKey: conv.public_key,
          createdAt: new Date(), // Not needed for conversations
          lastSeen: new Date(conv.last_seen),
          lastMessage: decryptedLastMessage,
          lastMessageTime: conv.last_message_time ? new Date(conv.last_message_time) : new Date(),
          unreadCount: conv.unread_count || 0
        }
      }))
      
      return conversations
    } catch (error) {
      console.error('❌ Error getting user conversations:', error)
      return []
    }
  }
  
  // Mark message as delivered
  const markMessageAsDelivered = async (messageId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('messages')
        .update({ delivered: true })
        .eq('id', messageId)
      
      if (error) {
        console.error('Error marking message as delivered:', error)
      }
    } catch (error) {
      console.error('Error marking message as delivered:', error)
    }
  }
  
  // Mark message as read
  const markMessageAsRead = async (messageId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('messages')
        .update({ read: true })
        .eq('id', messageId)
      
      if (error) {
        console.error('Error marking message as read:', error)
        return
      }
      
      // Update local state
      const messageIndex = messages.value.findIndex(msg => msg.id === messageId)
      if (messageIndex !== -1) {
        messages.value[messageIndex].read = true
        
        // Notify sender via socket if this is a received message
        const message = messages.value[messageIndex]
        if (message.receiverId === authState.value.user?.id) {
          socketService.emitMessageRead(messageId, message.senderId)
        }
      }
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
    onlineUsers.value = []
    typingUsers.value.clear()
  }
  
  return {
    messages: readonly(messages),
    onlineUsers: readonly(onlineUsers),
    typingUsers: readonly(typingUsers),
    initialized: readonly(initialized),
    needsPasswordPrompt: readonly(needsPasswordPrompt),
    initializeChat,
    sendMessage,
    getChatHistory,
    searchUsers,
    getUserConversations,
    markMessageAsDelivered,
    markMessageAsRead,
    startTyping,
    stopTyping,
    setEncryptionPassword,
    promptForEncryptionPassword,
    cleanup
  }
}
