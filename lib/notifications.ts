import { supabase } from './supabase';

// Notification type definitions
export type NotificationType = 
  | 'follow_request'
  | 'follow'
  | 'follow_approved'
  | 'collaboration_request'
  | 'collaboration_approved'
  | 'like'
  | 'comment'
  | 'studio_update'
  | 'class_reminder'
  | 'achievement';

// Base notification interface
export interface BaseNotification {
  id: string;
  type: NotificationType;
  message: string;
  from_user_id: string | null;
  to_user_id: string;
  related_id: string | null;
  extra_data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

// Notification handler interface
export interface NotificationHandler {
  type: NotificationType;
  create: (params: CreateNotificationParams) => Promise<void>;
  formatMessage: (params: FormatMessageParams) => string;
  getActions?: (notification: BaseNotification) => NotificationAction[];
}

// Parameters for creating notifications
export interface CreateNotificationParams {
  fromUserId?: string;
  toUserId: string;
  relatedId?: string;
  extraData?: Record<string, unknown>;
  message?: string;
}

// Parameters for formatting messages
export interface FormatMessageParams {
  fromUser?: {
    id: string;
    username: string;
    full_name: string | null;
  };
  toUser?: {
    id: string;
    username: string;
    full_name: string | null;
  };
  relatedData?: Record<string, unknown>;
  extraData?: Record<string, unknown>;
}

// Notification action interface
export interface NotificationAction {
  id: string;
  label: string;
  action: 'approve' | 'deny' | 'follow' | 'view' | 'custom';
  style: 'primary' | 'secondary' | 'danger';
  handler: (notificationId: string) => Promise<void>;
}

// Follow notification handler
export const followNotificationHandler: NotificationHandler = {
  type: 'follow_request',
  
  create: async ({ fromUserId, toUserId, relatedId, extraData }) => {
    if (!fromUserId) throw new Error('fromUserId is required for follow notifications');
    
    const { data: fromUser } = await supabase
      .from('users')
      .select('username, full_name')
      .eq('id', fromUserId)
      .single();
    
    const followerName = fromUser?.full_name || fromUser?.username || 'Someone';
    const message = `${followerName} requested to follow you`;
    
    await supabase.from('notifications').insert({
      type: 'follow_request',
      message,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      related_id: relatedId,
      extra_data: extraData || {},
      is_read: false
    });
  },
  
  formatMessage: ({ fromUser }) => {
    const name = fromUser?.full_name || fromUser?.username || 'Someone';
    return `${name} requested to follow you`;
  },
  
  getActions: () => [
    {
      id: 'approve',
      label: 'Approve',
      action: 'approve',
      style: 'primary',
      handler: async () => {
        // Handle approve logic
      }
    },
    {
      id: 'deny',
      label: 'Deny',
      action: 'deny',
      style: 'danger',
      handler: async () => {
        // Handle deny logic
      }
    }
  ]
};

// Follow approved notification handler
export const followApprovedNotificationHandler: NotificationHandler = {
  type: 'follow',
  
  create: async ({ fromUserId, toUserId, relatedId, extraData }) => {
    if (!fromUserId) throw new Error('fromUserId is required for follow notifications');
    
    const { data: fromUser } = await supabase
      .from('users')
      .select('username, full_name')
      .eq('id', fromUserId)
      .single();
    
    const followerName = fromUser?.full_name || fromUser?.username || 'Someone';
    const message = `${followerName} is now following you. Follow back?`;
    
    await supabase.from('notifications').insert({
      type: 'follow',
      message,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      related_id: relatedId,
      extra_data: extraData || {},
      is_read: false
    });
  },
  
  formatMessage: ({ fromUser }) => {
    const name = fromUser?.full_name || fromUser?.username || 'Someone';
    return `${name} is now following you. Follow back?`;
  },
  
  getActions: () => [
    {
      id: 'follow_back',
      label: 'Follow',
      action: 'follow',
      style: 'primary',
      handler: async () => {
        // Handle follow back logic
      }
    }
  ]
};

// Collaboration notification handler
export const collaborationNotificationHandler: NotificationHandler = {
  type: 'collaboration_request',
  
  create: async ({ fromUserId, toUserId, relatedId, extraData }) => {
    if (!fromUserId) throw new Error('fromUserId is required for collaboration notifications');
    
    const { data: fromUser } = await supabase
      .from('users')
      .select('username, full_name')
      .eq('id', fromUserId)
      .single();
    
    const requesterName = fromUser?.full_name || fromUser?.username || 'Someone';
    const message = `${requesterName} tagged you in a workout`;
    
    await supabase.from('notifications').insert({
      type: 'collaboration_request',
      message,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      related_id: relatedId,
      extra_data: extraData || {},
      is_read: false
    });
  },
  
  formatMessage: ({ fromUser }) => {
    const name = fromUser?.full_name || fromUser?.username || 'Someone';
    return `${name} tagged you in a workout`;
  },
  
  getActions: () => [
    {
      id: 'approve',
      label: 'Approve',
      action: 'approve',
      style: 'primary',
      handler: async () => {
        // Handle approve logic
      }
    },
    {
      id: 'deny',
      label: 'Deny',
      action: 'deny',
      style: 'danger',
      handler: async () => {
        // Handle deny logic
      }
    }
  ]
};

// Collaboration approved notification handler
export const collaborationApprovedNotificationHandler: NotificationHandler = {
  type: 'collaboration_approved',
  
  create: async ({ fromUserId, toUserId, relatedId, extraData }) => {
    if (!fromUserId) throw new Error('fromUserId is required for collaboration notifications');
    
    const { data: fromUser } = await supabase
      .from('users')
      .select('username, full_name')
      .eq('id', fromUserId)
      .single();
    
    const collaboratorName = fromUser?.full_name || fromUser?.username || 'Someone';
    const message = `You're collaborating on a workout post with ${collaboratorName}`;
    
    await supabase.from('notifications').insert({
      type: 'collaboration_approved',
      message,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      related_id: relatedId,
      extra_data: extraData || {},
      is_read: false
    });
  },
  
  formatMessage: ({ fromUser }) => {
    const name = fromUser?.full_name || fromUser?.username || 'Someone';
    return `You're collaborating on a workout post with ${name}`;
  }
};

// Like notification handler
export const likeNotificationHandler: NotificationHandler = {
  type: 'like',
  
  create: async ({ fromUserId, toUserId, relatedId, extraData }) => {
    if (!fromUserId) throw new Error('fromUserId is required for like notifications');
    
    const { data: fromUser } = await supabase
      .from('users')
      .select('username, full_name')
      .eq('id', fromUserId)
      .single();
    
    const likerName = fromUser?.full_name || fromUser?.username || 'Someone';
    const message = `${likerName} liked your post`;
    
    await supabase.from('notifications').insert({
      type: 'like',
      message,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      related_id: relatedId,
      extra_data: extraData || {},
      is_read: false
    });
  },
  
  formatMessage: ({ fromUser }) => {
    const name = fromUser?.full_name || fromUser?.username || 'Someone';
    return `${name} liked your post`;
  }
};

// Comment notification handler
export const commentNotificationHandler: NotificationHandler = {
  type: 'comment',
  
  create: async ({ fromUserId, toUserId, relatedId, extraData }) => {
    if (!fromUserId) throw new Error('fromUserId is required for comment notifications');
    
    const { data: fromUser } = await supabase
      .from('users')
      .select('username, full_name')
      .eq('id', fromUserId)
      .single();
    
    const commenterName = fromUser?.full_name || fromUser?.username || 'Someone';
    const message = `${commenterName} commented on your post`;
    
    await supabase.from('notifications').insert({
      type: 'comment',
      message,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      related_id: relatedId,
      extra_data: extraData || {},
      is_read: false
    });
  },
  
  formatMessage: ({ fromUser }) => {
    const name = fromUser?.full_name || fromUser?.username || 'Someone';
    return `${name} commented on your post`;
  }
};

// Registry of all notification handlers
export const notificationHandlers: Record<NotificationType, NotificationHandler> = {
  follow_request: followNotificationHandler,
  follow: followApprovedNotificationHandler,
  follow_approved: followApprovedNotificationHandler,
  collaboration_request: collaborationNotificationHandler,
  collaboration_approved: collaborationApprovedNotificationHandler,
  like: likeNotificationHandler,
  comment: commentNotificationHandler,
  studio_update: {
    type: 'studio_update',
    create: async () => {},
    formatMessage: () => 'Studio update'
  },
  class_reminder: {
    type: 'class_reminder',
    create: async () => {},
    formatMessage: () => 'Class reminder'
  },
  achievement: {
    type: 'achievement',
    create: async () => {},
    formatMessage: () => 'Achievement unlocked'
  }
};

// Main notification service
export class NotificationService {
  static async createNotification(
    type: NotificationType,
    params: CreateNotificationParams
  ): Promise<void> {
    const handler = notificationHandlers[type];
    if (!handler) {
      throw new Error(`No handler found for notification type: ${type}`);
    }
    
    await handler.create(params);
  }
  
  static async getUserNotifications(userId: string, limit = 50): Promise<BaseNotification[]> {
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('to_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      throw new Error(`Failed to fetch notifications: ${error.message}`);
    }
    
    return notifications || [];
  }
  
  static async markAsRead(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
    
    if (error) {
      throw new Error(`Failed to mark notification as read: ${error.message}`);
    }
  }
  
  static async deleteNotification(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);
    
    if (error) {
      throw new Error(`Failed to delete notification: ${error.message}`);
    }
  }
  
  static getHandler(type: NotificationType): NotificationHandler {
    const handler = notificationHandlers[type];
    if (!handler) {
      throw new Error(`No handler found for notification type: ${type}`);
    }
    return handler;
  }
} 