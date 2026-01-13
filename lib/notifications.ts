import { supabaseAdmin } from './supabase';

// Notification type definitions
export type NotificationType =
  | 'follow_request'
  | 'follow'
  | 'follow_approved'
  | 'collaboration_request'
  | 'collaboration_approved'
  | 'payment_confirmation'
  | 'payment_confirmed'
  | 'like'
  | 'comment'
  | 'mention'
  | 'studio_update'
  | 'class_reminder'
  | 'achievement'
  | 'milestone'
  | 'streak';

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
  status: 'pending' | 'accepted' | 'declined' | 'completed';
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

// Helper to ensure admin client
function getAdmin() {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not initialized. Check SUPABASE_SERVICE_ROLE_KEY.');
  }
  return supabaseAdmin;
}

// Follow notification handler
export const followNotificationHandler: NotificationHandler = {
  type: 'follow_request',

  create: async ({ fromUserId, toUserId, relatedId, extraData }) => {
    if (!fromUserId) throw new Error('fromUserId is required for follow notifications');
    const admin = getAdmin();

    const { data: fromUser } = await admin
      .from('users')
      .select('username, full_name')
      .eq('id', fromUserId)
      .single();

    const followerName = fromUser?.full_name || fromUser?.username || 'Someone';
    const message = `${followerName} requested to follow you`;

    const { error } = await admin.from('notifications').insert({
      type: 'follow_request',
      message,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      related_id: relatedId,
      extra_data: extraData || {},
      is_read: false,
      status: 'pending'
    });

    if (error) throw error;
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
  type: 'follow_request',

  create: async ({ fromUserId, toUserId, relatedId, extraData }) => {
    if (!fromUserId) throw new Error('fromUserId is required for follow notifications');
    const admin = getAdmin();

    const { data: fromUser } = await admin
      .from('users')
      .select('username, full_name')
      .eq('id', fromUserId)
      .single();

    const followerName = fromUser?.full_name || fromUser?.username || 'Someone';
    const message = `${followerName} is now following you. Follow back?`;

    const { error } = await admin.from('notifications').insert({
      type: 'follow_request',
      message,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      related_id: relatedId,
      extra_data: extraData || {},
      is_read: false,
      status: 'completed'
    });

    if (error) throw error;
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
    const admin = getAdmin();

    const { data: fromUser } = await admin
      .from('users')
      .select('username, full_name')
      .eq('id', fromUserId)
      .single();

    const requesterName = fromUser?.full_name || fromUser?.username || 'Someone';
    const message = `${requesterName} tagged you in a workout`;

    const { error } = await admin.from('notifications').insert({
      type: 'collaboration_request',
      message,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      related_id: relatedId,
      extra_data: extraData || {},
      is_read: false,
      status: 'pending'
    });

    if (error) throw error;
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
    const admin = getAdmin();

    const { data: fromUser } = await admin
      .from('users')
      .select('username, full_name')
      .eq('id', fromUserId)
      .single();

    const collaboratorName = fromUser?.full_name || fromUser?.username || 'Someone';
    const message = `You're collaborating on a workout post with ${collaboratorName}`;

    const { error } = await admin.from('notifications').insert({
      type: 'collaboration_approved',
      message,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      related_id: relatedId,
      extra_data: extraData || {},
      is_read: false,
      status: 'completed'
    });

    if (error) throw error;
  },

  formatMessage: ({ fromUser }) => {
    const name = fromUser?.full_name || fromUser?.username || 'Someone';
    return `You're collaborating on a workout post with ${name}`;
  }
};

// Helper function to get activity name for notifications
async function getActivityName(activityId: string): Promise<string> {
  const admin = getAdmin();
  const { data: activity } = await admin
    .from('activity_feed')
    .select('type, extra_data')
    .eq('id', activityId)
    .single();

  if (!activity) return 'post';

  const extraData = activity.extra_data as any || {};
  const activityType = extraData.activity_type || activity.type;
  // Get class name or activity name
  if (extraData.class_name && !['Custom', 'Custom Class', 'Activity'].includes(extraData.class_name)) {
    return extraData.class_name;
  }

  // For practice activities, use service name
  if (activityType === 'practice' && extraData.service_name) {
    return extraData.service_name;
  }

  // Default to activity type or "post"
  if (activityType === 'movement') {
    return 'Class';
  } else if (activityType === 'practice') {
    return 'Practice';
  } else if (activityType === 'event') {
    return 'Event';
  } else if (activityType === 'treatment') {
    return 'Treatment';
  }

  return 'post';
}

// Like notification handler
export const likeNotificationHandler: NotificationHandler = {
  type: 'like',

  create: async ({ fromUserId, toUserId, relatedId, extraData }) => {
    if (!fromUserId) throw new Error('fromUserId is required for like notifications');
    if (!relatedId) throw new Error('relatedId (activity_id) is required for like notifications');
    const admin = getAdmin();

    const { data: fromUser } = await admin
      .from('users')
      .select('username, full_name')
      .eq('id', fromUserId)
      .single();

    const likerName = fromUser?.full_name || fromUser?.username || 'Someone';
    const activityName = await getActivityName(relatedId);
    const message = `${likerName} liked your ${activityName} post.`;

    const { error } = await admin.from('notifications').insert({
      type: 'like',
      message,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      related_id: relatedId,
      extra_data: extraData || {},
      is_read: false,
      status: 'completed'
    });

    if (error) throw error;
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
    if (!relatedId) throw new Error('relatedId (activity_id) is required for comment notifications');
    const admin = getAdmin();

    const { data: fromUser } = await admin
      .from('users')
      .select('username, full_name')
      .eq('id', fromUserId)
      .single();

    const commenterName = fromUser?.full_name || fromUser?.username || 'Someone';
    const activityName = await getActivityName(relatedId);
    const message = `${commenterName} commented on your ${activityName} post. Reply?`;

    // Fetch activity owner ID
    const { data: activity } = await admin
      .from('activity_feed')
      .select('user_id')
      .eq('id', relatedId)
      .single();

    const { error } = await admin.from('notifications').insert({
      type: 'comment',
      message,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      related_id: relatedId,
      extra_data: {
        ...extraData,
        activityName,
        activityOwnerId: activity?.user_id
      },
      is_read: false,
      status: 'completed'
    });

    if (error) throw error;
  },

  formatMessage: ({ fromUser }) => {
    const name = fromUser?.full_name || fromUser?.username || 'Someone';
    return `${name} commented on your post`;
  }
};

// Mention notification handler
export const mentionNotificationHandler: NotificationHandler = {
  type: 'mention',

  create: async ({ fromUserId, toUserId, relatedId, extraData }) => {
    if (!fromUserId) throw new Error('fromUserId is required for mention notifications');
    if (!relatedId) throw new Error('relatedId (activity_id) is required for mention notifications');
    const admin = getAdmin();

    const { data: fromUser } = await admin
      .from('users')
      .select('username, full_name')
      .eq('id', fromUserId)
      .single();

    const commenterName = fromUser?.full_name || fromUser?.username || 'Someone';
    const activityName = await getActivityName(relatedId);
    const message = `${commenterName} mentioned you in a comment on a ${activityName} post.`;

    // Fetch activity owner ID
    const { data: activity } = await admin
      .from('activity_feed')
      .select('user_id')
      .eq('id', relatedId)
      .single();

    const { error } = await admin.from('notifications').insert({
      type: 'mention',
      message,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      related_id: relatedId,
      extra_data: {
        ...extraData,
        activityName,
        activityOwnerId: activity?.user_id
      },
      is_read: false,
      status: 'completed'
    });

    if (error) throw error;
  },

  formatMessage: ({ fromUser }) => {
    const name = fromUser?.full_name || fromUser?.username || 'Someone';
    return `${name} mentioned you in a comment`;
  }
};

// Payment confirmation notification handler
export const paymentConfirmationNotificationHandler: NotificationHandler = {
  type: 'payment_confirmation',

  create: async ({ fromUserId, toUserId, relatedId, extraData }) => {
    if (!fromUserId) throw new Error('fromUserId is required for payment notifications');
    const admin = getAdmin();

    const { data: fromUser } = await admin
      .from('users')
      .select('username, full_name')
      .eq('id', fromUserId)
      .single();

    const requesterName = fromUser?.full_name || fromUser?.username || 'Someone';
    const message = `${requesterName} wants to claim your ${extraData?.class_name || 'booking'}. Confirm payment?`;

    const { error } = await admin.from('notifications').insert({
      type: 'payment_confirmation',
      message,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      related_id: relatedId,
      extra_data: extraData || {},
      is_read: false,
      status: 'pending'
    });

    if (error) throw error;
  },

  formatMessage: ({ fromUser, extraData }) => {
    const name = fromUser?.full_name || fromUser?.username || 'Someone';
    return `${name} wants to claim your ${extraData?.class_name || 'booking'}. Confirm payment?`;
  }
};

// Payment confirmed notification handler
export const paymentConfirmedNotificationHandler: NotificationHandler = {
  type: 'payment_confirmed',

  create: async ({ fromUserId, toUserId, relatedId, extraData }) => {
    if (!fromUserId) throw new Error('fromUserId is required for payment notifications');
    const admin = getAdmin();

    const { data: fromUser } = await admin
      .from('users')
      .select('username, full_name')
      .eq('id', fromUserId)
      .single();

    const requesterName = fromUser?.full_name || fromUser?.username || 'Someone';
    const message = `${requesterName} confirmed your payment for ${extraData?.class_name || 'booking'}.`;

    const { error } = await admin.from('notifications').insert({
      type: 'payment_confirmed',
      message,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      related_id: relatedId,
      extra_data: extraData || {},
      is_read: false,
      status: 'completed'
    });

    if (error) throw error;
  },

  formatMessage: ({ fromUser, extraData }) => {
    const name = fromUser?.full_name || fromUser?.username || 'Someone';
    return `${name} confirmed your payment for ${extraData?.class_name || 'booking'}.`;
  }
};

// Milestone notification handler
export const milestoneNotificationHandler: NotificationHandler = {
  type: 'milestone',

  create: async ({ toUserId, extraData }) => {
    const admin = getAdmin();

    const count = extraData?.count || 10;
    const studioName = extraData?.studioName || 'this studio';
    const message = `You've completed ${count} classes at ${studioName}!`;

    const { error } = await admin.from('notifications').insert({
      type: 'milestone',
      message,
      from_user_id: null,
      to_user_id: toUserId,
      related_id: extraData?.studioId as string || null,
      extra_data: extraData || {},
      is_read: false,
      status: 'completed'
    });

    if (error) throw error;
  },

  formatMessage: ({ extraData }) => {
    const count = extraData?.count || 10;
    const studioName = extraData?.studioName || 'this studio';
    return `You've completed ${count} classes at ${studioName}!`;
  }
};

// Streak notification handler
export const streakNotificationHandler: NotificationHandler = {
  type: 'streak',

  create: async ({ toUserId, extraData }) => {
    const admin = getAdmin();

    const count = extraData?.count || 7;
    const activityName = extraData?.activityName || 'activities';
    const message = `Day ${count} in a row of ${activityName}—and that's on consistency with purpose.`;

    const { error } = await admin.from('notifications').insert({
      type: 'streak',
      message,
      from_user_id: null,
      to_user_id: toUserId,
      related_id: null,
      extra_data: extraData || {},
      is_read: false,
      status: 'completed'
    });

    if (error) throw error;
  },

  formatMessage: ({ extraData }) => {
    const count = extraData?.count || 7;
    const activityName = extraData?.activityName || 'activities';
    return `Day ${count} in a row of ${activityName}—and that's on consistency with purpose.`;
  }
};

// Registry of all notification handlers
export const notificationHandlers: Record<NotificationType, NotificationHandler> = {
  follow_request: followNotificationHandler,
  follow: followApprovedNotificationHandler,
  follow_approved: followApprovedNotificationHandler,
  collaboration_request: collaborationNotificationHandler,
  collaboration_approved: collaborationApprovedNotificationHandler,
  payment_confirmation: paymentConfirmationNotificationHandler,
  payment_confirmed: paymentConfirmedNotificationHandler,
  like: likeNotificationHandler,
  comment: commentNotificationHandler,
  mention: mentionNotificationHandler,
  studio_update: {
    type: 'studio_update',
    create: async () => { },
    formatMessage: () => 'Studio update'
  },
  class_reminder: {
    type: 'class_reminder',
    create: async () => { },
    formatMessage: () => 'Class reminder'
  },
  achievement: {
    type: 'achievement',
    create: async () => { },
    formatMessage: () => 'Achievement unlocked'
  },
  milestone: milestoneNotificationHandler,
  streak: streakNotificationHandler
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
    const { data: notifications, error } = await getAdmin()
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
    const { error } = await getAdmin()
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) {
      throw new Error(`Failed to mark notification as read: ${error.message}`);
    }
  }

  static async deleteNotification(notificationId: string): Promise<void> {
    const { error } = await getAdmin()
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

  static async updateNotificationStatus(
    notificationId: string,
    status: 'pending' | 'accepted' | 'declined' | 'completed',
    updatedMessage?: string
  ): Promise<void> {
    const updateData: any = {
      status
    };
    if (updatedMessage) {
      updateData.message = updatedMessage;
    }

    const { error } = await getAdmin()
      .from('notifications')
      .update(updateData)
      .eq('id', notificationId);

    if (error) {
      throw new Error(`Failed to update notification status: ${error.message}`);
    }
  }
} 