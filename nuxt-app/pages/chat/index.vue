<template>
  <div class="flex h-screen bg-gray-100">
    <!-- Sidebar -->
    <div class="w-80 bg-white border-r border-gray-200 flex flex-col">
      <!-- Header -->
      <div class="p-4 border-b border-gray-200">
        <div class="flex items-center justify-between">
          <h1 class="text-xl font-bold text-gray-900">chattr</h1>
          <div class="flex items-center gap-2">
            <button
              @click="showUserSearch = true"
              class="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
              title="Start new chat"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
              </svg>
            </button>
            <div class="relative">
              <button
                @click="showUserMenu = !showUserMenu"
                class="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
              </button>
              
              <!-- User menu dropdown -->
              <div v-if="showUserMenu" class="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
                <div class="px-4 py-2 text-sm text-gray-700 border-b">
                  <div class="font-medium">{{ authState.user?.displayName }}</div>
                  <div class="text-gray-500">@{{ authState.user?.username }}</div>
                </div>
                <button
                  @click="handleSignOut"
                  class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Search bar -->
        <div class="mt-3">
          <div class="relative">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search conversations..."
              class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg class="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
          </div>
        </div>
      </div>
      
      <!-- Conversations list -->
      <div class="flex-1 overflow-y-auto">
        <div v-if="conversations.length === 0" class="p-4 text-center text-gray-500">
          <svg class="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
          </svg>
          <p>No conversations yet</p>
          <p class="text-sm">Start a new chat to begin messaging</p>
        </div>
        
        <div v-else>
          <div
            v-for="conversation in filteredConversations"
            :key="conversation.id"
            @click="selectConversation(conversation)"
            class="p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
            :class="{ 'bg-blue-50 border-blue-200': selectedConversation?.id === conversation.id }"
          >
            <div class="flex items-center">
              <div class="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center mr-3">
                <span class="text-sm font-medium text-gray-700">
                  {{ conversation.displayName.charAt(0).toUpperCase() }}
                </span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between">
                  <h3 class="text-sm font-medium text-gray-900 truncate">
                    {{ conversation.displayName }}
                  </h3>
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-500">
                      {{ formatTime(conversation.lastMessageTime || conversation.lastSeen) }}
                    </span>
                    <div v-if="conversation.unreadCount && conversation.unreadCount > 0" 
                         class="bg-blue-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                      {{ conversation.unreadCount > 99 ? '99+' : conversation.unreadCount }}
                    </div>
                  </div>
                </div>
                <p class="text-sm text-gray-500 truncate">
                  {{ conversation.lastMessage || 'No messages yet' }}
                </p>
              </div>
              <div v-if="onlineUsers.includes(conversation.id)" class="w-2 h-2 bg-green-500 rounded-full ml-2"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Main chat area -->
    <div class="flex-1 flex flex-col">
      <div v-if="!selectedConversation" class="flex-1 flex items-center justify-center">
        <div class="text-center text-gray-500">
          <svg class="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
          </svg>
          <h3 class="text-lg font-medium text-gray-900 mb-2">Select a conversation</h3>
          <p>Choose a conversation from the sidebar to start messaging</p>
        </div>
      </div>
      
      <div v-else class="flex-1 flex flex-col">
        <!-- Chat header -->
        <div class="p-4 border-b border-gray-200 bg-white">
          <div class="flex items-center">
            <div class="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center mr-3">
              <span class="text-sm font-medium text-gray-700">
                {{ selectedConversation.displayName.charAt(0).toUpperCase() }}
              </span>
            </div>
            <div>
              <h2 class="text-lg font-semibold text-gray-900">{{ selectedConversation.displayName }}</h2>
              <p class="text-sm text-gray-500">
                @{{ selectedConversation.username }}
                <span v-if="onlineUsers.includes(selectedConversation.id)" class="text-green-500">• Online</span>
                <span v-else class="text-gray-400">• Last seen {{ formatTime(selectedConversation.lastSeen) }}</span>
              </p>
            </div>
          </div>
        </div>
        
        <!-- Messages -->
        <div ref="messagesContainer" class="flex-1 overflow-y-auto p-4 space-y-4">
          <div v-if="messages.length === 0" class="text-center text-gray-500 py-8">
            <p>No messages yet. Start the conversation!</p>
          </div>
          
          <div v-for="message in messages" :key="message.id" class="flex">
            <div
              :ref="el => setMessageRef(el, message)"
              class="chat-bubble"
              :class="message.senderId === authState.user?.id ? 'chat-bubble-sent' : 'chat-bubble-received'"
            >
              <p class="text-sm">{{ message.content }}</p>
              <div class="flex items-center justify-between mt-1">
                <span class="text-xs opacity-75">
                  {{ formatTime(message.timestamp) }}
                </span>
                <div v-if="message.senderId === authState.user?.id" class="flex items-center gap-1">
                  <!-- Single gray tick for sent -->
                  <svg v-if="!message.delivered && !message.read" class="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                  </svg>
                  
                  <!-- Double gray ticks for delivered -->
                  <template v-else-if="message.delivered && !message.read">
                    <svg class="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                    </svg>
                    <svg class="w-3 h-3 text-gray-400 -ml-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                    </svg>
                  </template>
                  
                  <!-- Double blue ticks for read -->
                  <template v-else-if="message.read">
                    <svg class="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                    </svg>
                    <svg class="w-3 h-3 text-red-500 -ml-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                    </svg>
                  </template>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Typing indicator -->
          <div v-if="isTyping" class="flex">
            <div class="chat-bubble chat-bubble-received">
              <div class="flex items-center space-x-1">
                <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
                <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Message input -->
        <div class="p-4 border-t border-gray-200 bg-white">
          <form @submit.prevent="sendMessage" class="flex items-end gap-3">
            <div class="flex-1">
              <textarea
                v-model="newMessage"
                @keydown="handleKeyDown"
                @input="handleTyping"
                placeholder="Type a message..."
                rows="1"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                style="max-height: 120px;"
              ></textarea>
            </div>
            <button
              type="submit"
              :disabled="!newMessage.trim() || sending"
              class="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
    
    <!-- User search modal -->
    <div v-if="showUserSearch" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold">Start New Chat</h3>
          <button @click="showUserSearch = false" class="text-gray-400 hover:text-gray-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        
        <div class="mb-4">
          <input
            v-model="userSearchQuery"
            @input="searchUsers"
            type="text"
            placeholder="Search users by username..."
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div class="max-h-60 overflow-y-auto">
          <div v-if="searchResults.length === 0 && userSearchQuery" class="text-center text-gray-500 py-4">
            No users found
          </div>
          <div
            v-for="user in searchResults"
            :key="user.id"
            @click="startChat(user)"
            class="flex items-center p-3 hover:bg-gray-50 rounded-lg cursor-pointer"
          >
            <div class="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center mr-3">
              <span class="text-sm font-medium text-gray-700">
                {{ user.displayName.charAt(0).toUpperCase() }}
              </span>
            </div>
            <div>
              <div class="font-medium text-gray-900">{{ user.displayName }}</div>
              <div class="text-sm text-gray-500">@{{ user.username }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import type { User } from '~/types'
import { SocketService } from '~/utils/socket'

definePageMeta({
  middleware: 'auth'
})

const supabase = useSupabaseClient()

const { authState, signOut } = useAuth()
const { messages, onlineUsers, initializeChat, sendMessage: sendChatMessage, getChatHistory, searchUsers: searchUsersApi, getUserConversations, startTyping, stopTyping, markMessageAsRead } = useChat()

// State
const searchQuery = ref('')
const selectedConversation = ref<User | null>(null)
const conversations = ref<User[]>([])
const newMessage = ref('')
const sending = ref(false)
const showUserMenu = ref(false)
const showUserSearch = ref(false)
const userSearchQuery = ref('')
const searchResults = ref<User[]>([])
const messagesContainer = ref<HTMLElement>()
const isTyping = ref(false)
const typingTimeout = ref<NodeJS.Timeout>()
const messageRefs = ref<Map<string, HTMLElement>>(new Map())
const intersectionObserver = ref<IntersectionObserver | null>(null)

// Computed
const filteredConversations = computed(() => {
  if (!searchQuery.value) return conversations.value
  return conversations.value.filter(conv => 
    conv.displayName.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
    conv.username.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

// Methods
const loadConversations = async () => {
  try {
    console.log('📋 Loading conversations...')
    console.log('🔍 Auth state:', authState.value.user?.id)
    const conversationList = await getUserConversations()
    console.log('📊 Raw conversation data:', conversationList)
    conversations.value = conversationList
    console.log(`✅ Loaded ${conversationList.length} conversations`)
  } catch (error) {
    console.error('❌ Failed to load conversations:', error)
  }
}

const selectConversation = async (user: User) => {
  selectedConversation.value = user
  showUserMenu.value = false
  
  // Clear previous message refs and reset observer
  messageRefs.value.clear()
  if (intersectionObserver.value) {
    intersectionObserver.value.disconnect()
    setupIntersectionObserver()
  }
  
  await getChatHistory(user.id)
  scrollToBottom()
}

const sendMessage = async () => {
  if (!newMessage.value.trim() || !selectedConversation.value || sending.value) return
  
  try {
    sending.value = true
    await sendChatMessage(newMessage.value.trim(), selectedConversation.value.id)
    newMessage.value = ''
    scrollToBottom()
    
    // Refresh conversations to update last message info
    await loadConversations()
  } catch (error) {
    console.error('Failed to send message:', error)
  } finally {
    sending.value = false
  }
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    sendMessage()
  }
}

const handleTyping = () => {
  if (!selectedConversation.value) return
  
  startTyping(selectedConversation.value.id)
  
  if (typingTimeout.value) {
    clearTimeout(typingTimeout.value)
  }
  
  typingTimeout.value = setTimeout(() => {
    stopTyping(selectedConversation.value!.id)
  }, 1000)
}

const searchUsers = async () => {
  if (!userSearchQuery.value.trim()) {
    searchResults.value = []
    return
  }
  
  try {
    searchResults.value = await searchUsersApi(userSearchQuery.value)
  } catch (error) {
    console.error('Failed to search users:', error)
  }
}

const startChat = async (user: User) => {
  showUserSearch.value = false
  userSearchQuery.value = ''
  searchResults.value = []
  
  // Add to conversations if not already there
  if (!conversations.value.find(conv => conv.id === user.id)) {
    conversations.value.unshift(user)
  }
  
  selectConversation(user)
  
  // Refresh conversations to get updated data after starting new chat
  await loadConversations()
}

const handleSignOut = async () => {
  await signOut()
}

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

const formatTime = (date: Date | string) => {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString()
}

// Message ref handling for intersection observer
const setMessageRef = (el: HTMLElement | null, message: any) => {
  if (el && message) {
    messageRefs.value.set(message.id, el)
    
    // Observe message for read receipts if it's a received message
    if (intersectionObserver.value && message.senderId !== authState.value.user?.id && !message.read) {
      intersectionObserver.value.observe(el)
    }
  }
}

// Setup intersection observer for read receipts
const setupIntersectionObserver = () => {
  intersectionObserver.value = new IntersectionObserver(
    (entries) => {
      entries.forEach(async (entry) => {
        if (entry.isIntersecting) {
          // Find the message corresponding to this element
          const messageId = Array.from(messageRefs.value.entries())
            .find(([, element]) => element === entry.target)?.[0]
          
          if (messageId) {
            const message = messages.value.find(m => m.id === messageId)
            if (message && message.senderId !== authState.value.user?.id && !message.read) {
              try {
                await markMessageAsRead(messageId)
                // Stop observing this message
                intersectionObserver.value?.unobserve(entry.target)
              } catch (error) {
                console.error('Failed to mark message as read:', error)
              }
            }
          }
        }
      })
    },
    {
      threshold: 0.5, // Message is considered read when 50% visible
      rootMargin: '0px 0px -20px 0px' // Small margin to ensure message is actually visible
    }
  )
}

// Lifecycle
onMounted(async () => {
  // Setup intersection observer for read receipts
  setupIntersectionObserver()
  
  await initializeChat()
  
  // Debug: Check database contents
  try {
    console.log('🔍 Debug: Checking database contents...')
    
    // Check users table
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, username, display_name')
      .limit(5)
    
    if (usersError) {
      console.error('❌ Users query error:', usersError)
    } else {
      console.log('👥 Users in database:', users)
    }
    
    // Check messages table
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, timestamp')
      .limit(5)
    
    if (messagesError) {
      console.error('❌ Messages query error:', messagesError)
    } else {
      console.log('💬 Messages in database:', messages)
    }
    
    // Check current user
    console.log('🔍 Current user:', authState.value.user)
    
  } catch (debugError) {
    console.error('❌ Debug queries failed:', debugError)
  }
  
  await loadConversations()
})

// Cleanup on unmount
onUnmounted(() => {
  const socketService = SocketService.getInstance()
  socketService.disconnect()
  
  // Disconnect intersection observer
  if (intersectionObserver.value) {
    intersectionObserver.value.disconnect()
  }
})

// Close dropdowns when clicking outside
onClickOutside(messagesContainer, () => {
  showUserMenu.value = false
})
</script>
