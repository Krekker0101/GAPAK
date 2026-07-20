-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('mention', 'like', 'comment', 'follow', 'system')),
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    action_url TEXT,
    
    CONSTRAINT notifications_user_id_check CHECK (user_id IS NOT NULL)
);

-- Create indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);

-- Create mentions table
CREATE TABLE IF NOT EXISTS mentions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mentioned_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mentioned_by_username VARCHAR(255) NOT NULL,
    mentioned_by_display_name VARCHAR(255) NOT NULL,
    mentioned_by_avatar TEXT,
    type VARCHAR(50) NOT NULL CHECK (type IN ('chat', 'comment', 'post', 'story', 'room', 'community', 'project', 'ai_collaboration')),
    content TEXT NOT NULL,
    context_id VARCHAR(255) NOT NULL,
    context_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_read BOOLEAN DEFAULT FALSE,
    
    -- Optional metadata for navigation
    post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
    comment_id UUID REFERENCES comments(id) ON DELETE SET NULL,
    room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
    community_id UUID REFERENCES communities(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    story_id UUID REFERENCES stories(id) ON DELETE SET NULL,
    chat_id UUID REFERENCES chats(id) ON DELETE SET NULL,
    
    CONSTRAINT mentions_mentioned_user_id_check CHECK (mentioned_user_id IS NOT NULL)
);

-- Create indexes for mentions
CREATE INDEX IF NOT EXISTS idx_mentions_mentioned_user_id ON mentions(mentioned_user_id);
CREATE INDEX IF NOT EXISTS idx_mentions_type ON mentions(type);
CREATE INDEX IF NOT EXISTS idx_mentions_context_id ON mentions(context_id);
CREATE INDEX IF NOT EXISTS idx_mentions_context_type ON mentions(context_type);
CREATE INDEX IF NOT EXISTS idx_mentions_created_at ON mentions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mentions_user_created ON mentions(mentioned_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mentions_post_id ON mentions(post_id) WHERE post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mentions_comment_id ON mentions(comment_id) WHERE comment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mentions_room_id ON mentions(room_id) WHERE room_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mentions_community_id ON mentions(community_id) WHERE community_id IS NOT NULL;

-- Create function to update notification count trigger
CREATE OR REPLACE FUNCTION update_notification_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Update user's unread notification count
    UPDATE users 
    SET unread_notification_count = (
        SELECT COUNT(*) 
        FROM notifications 
        WHERE user_id = NEW.user_id AND is_read = FALSE
    )
    WHERE id = NEW.user_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for notification count
DROP TRIGGER IF EXISTS trigger_update_notification_count ON notifications;
CREATE TRIGGER trigger_update_notification_count
    AFTER INSERT OR UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_count();

-- Add unread_notification_count column to users table if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS unread_notification_count INTEGER DEFAULT 0;
