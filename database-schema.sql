-- Complete Database Schema for chattr
-- Updated to work with manual user profile creation
-- Run this on Supabase SQL Editor

-- Enable Row Level Security
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;

-- Drop existing trigger and function that was causing conflicts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar TEXT,
  public_key TEXT NOT NULL,
  encrypted_private_key TEXT,
  key_salt TEXT,
  key_iv TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 20),
  CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_]+$')
);

-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  encrypted_content TEXT NOT NULL,
  encrypted_content_for_sender TEXT, 
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  delivered BOOLEAN DEFAULT FALSE,
  read BOOLEAN DEFAULT FALSE,
  
  -- Ensure sender and receiver are different
  CONSTRAINT different_users CHECK (sender_id != receiver_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver ON public.messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON public.messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread ON public.messages(receiver_id, read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON public.users(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Users can read all profiles" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Users can read own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update message status" ON public.messages;

-- Row Level Security Policies for users table

-- Users can read all user profiles (for search functionality)
CREATE POLICY "Users can read all profiles" ON public.users
  FOR SELECT USING (true);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own profile (during registration)
-- This allows the application to create user profiles after auth signup
CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Row Level Security Policies for messages table

-- Users can read messages they sent or received
CREATE POLICY "Users can read own messages" ON public.messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Users can insert messages they are sending
CREATE POLICY "Users can send messages" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Users can update delivery/read status of messages they sent or received
-- This allows both senders and receivers to update message status for delivery confirmations
CREATE POLICY "Users can update message status" ON public.messages
  FOR UPDATE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Function to safely update last_seen timestamp
CREATE OR REPLACE FUNCTION public.update_last_seen(user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.users 
  SET last_seen = NOW() 
  WHERE id = user_id AND id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user by username (for search functionality)
CREATE OR REPLACE FUNCTION public.get_user_by_username(search_username TEXT)
RETURNS TABLE (
  id UUID,
  email TEXT,
  username TEXT,
  display_name TEXT,
  avatar TEXT,
  public_key TEXT,
  last_seen TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.username,
    u.display_name,
    u.avatar,
    u.public_key,
    u.last_seen
  FROM public.users u
  WHERE u.username = search_username;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search users by username pattern
CREATE OR REPLACE FUNCTION public.search_users(search_pattern TEXT)
RETURNS TABLE (
  id UUID,
  username TEXT,
  display_name TEXT,
  avatar TEXT,
  last_seen TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.username,
    u.display_name,
    u.avatar,
    u.last_seen
  FROM public.users u
  WHERE u.username ILIKE '%' || search_pattern || '%'
  AND u.id != auth.uid()  -- Exclude current user from search results
  ORDER BY u.username
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get chat history between two users
CREATE OR REPLACE FUNCTION public.get_chat_messages(other_user_id UUID, message_limit INTEGER DEFAULT 50)
RETURNS TABLE (
  id UUID,
  sender_id UUID,
  receiver_id UUID,
  encrypted_content TEXT,
  msg_timestamp TIMESTAMPTZ,
  delivered BOOLEAN,
  read BOOLEAN
) AS $$
BEGIN
  -- Verify that the requesting user is either sender or receiver
  IF auth.uid() != other_user_id THEN
    RETURN QUERY
    SELECT 
      m.id,
      m.sender_id,
      m.receiver_id,
      m.encrypted_content,
      m.timestamp,
      m.delivered,
      m.read
    FROM public.messages m
    WHERE (
      (m.sender_id = auth.uid() AND m.receiver_id = other_user_id) OR
      (m.sender_id = other_user_id AND m.receiver_id = auth.uid())
    )
    ORDER BY m.timestamp DESC
    LIMIT message_limit;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark messages as read
CREATE OR REPLACE FUNCTION public.mark_messages_as_read(sender_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.messages
  SET read = true
  WHERE receiver_id = auth.uid() AND sender_id = sender_user_id AND read = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread message count
CREATE OR REPLACE FUNCTION public.get_unread_count()
RETURNS INTEGER AS $$
DECLARE
  unread_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO unread_count
  FROM public.messages
  WHERE receiver_id = auth.uid() AND read = false;
  
  RETURN unread_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all conversations for the current user
-- Fixed version that accepts user_id as parameter to avoid auth.uid() issues
CREATE OR REPLACE FUNCTION public.get_user_conversations(current_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  display_name TEXT,
  avatar TEXT,
  last_seen TIMESTAMPTZ,
  last_message_content TEXT,
  last_message_time TIMESTAMPTZ,
  unread_count BIGINT,
  public_key TEXT
) AS $$
BEGIN
  -- Use provided user_id or fall back to auth.uid()
  IF current_user_id IS NULL THEN
    current_user_id := auth.uid();
  END IF;
  
  -- If still no user ID, return empty
  IF current_user_id IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  WITH conversation_users AS (
    -- Get all users who have exchanged messages with the current user
    SELECT DISTINCT
      CASE 
        WHEN m.sender_id = current_user_id THEN m.receiver_id
        ELSE m.sender_id
      END as other_user_id
    FROM public.messages m
    WHERE m.sender_id = current_user_id OR m.receiver_id = current_user_id
  ),
  last_messages AS (
    -- Get the most recent message for each conversation
    SELECT DISTINCT ON (
      CASE 
        WHEN m.sender_id = current_user_id THEN m.receiver_id
        ELSE m.sender_id
      END
    )
      CASE 
        WHEN m.sender_id = current_user_id THEN m.receiver_id
        ELSE m.sender_id
      END as other_user_id,
      -- Return the correct encrypted content based on who can decrypt it
      CASE 
        WHEN m.receiver_id = current_user_id THEN m.encrypted_content
        WHEN m.sender_id = current_user_id THEN COALESCE(m.encrypted_content_for_sender, m.encrypted_content)
        ELSE m.encrypted_content
      END as encrypted_content,
      m.timestamp,
      ROW_NUMBER() OVER (
        PARTITION BY 
          CASE 
            WHEN m.sender_id = current_user_id THEN m.receiver_id
            ELSE m.sender_id
          END
        ORDER BY m.timestamp DESC
      ) as rn
    FROM public.messages m
    WHERE m.sender_id = current_user_id OR m.receiver_id = current_user_id
    ORDER BY 
      CASE 
        WHEN m.sender_id = current_user_id THEN m.receiver_id
        ELSE m.sender_id
      END,
      m.timestamp DESC
  ),
  unread_counts AS (
    -- Get unread message counts per user
    SELECT 
      m.sender_id as other_user_id,
      COUNT(*) as unread_count
    FROM public.messages m
    WHERE m.receiver_id = current_user_id AND m.read = false
    GROUP BY m.sender_id
  )
  SELECT 
    u.id,
    u.username,
    u.display_name,
    u.avatar,
    u.last_seen,
    lm.encrypted_content,
    lm.timestamp,
    COALESCE(uc.unread_count, 0),
    u.public_key
  FROM conversation_users cu
  JOIN public.users u ON u.id = cu.other_user_id
  LEFT JOIN last_messages lm ON lm.other_user_id = cu.other_user_id AND lm.rn = 1
  LEFT JOIN unread_counts uc ON uc.other_user_id = cu.other_user_id
  ORDER BY COALESCE(lm.timestamp, u.created_at) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clean up any orphaned data (optional)
-- This will remove any messages that reference non-existent users
DELETE FROM public.messages 
WHERE sender_id NOT IN (SELECT id FROM public.users)
   OR receiver_id NOT IN (SELECT id FROM public.users);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.messages TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_last_seen(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_by_username(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_users(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_chat_messages(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_messages_as_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unread_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_conversations(UUID) TO authenticated;
