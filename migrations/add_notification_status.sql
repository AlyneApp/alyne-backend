-- Add status field to notifications table to track action status
ALTER TABLE public.notifications 
ADD COLUMN status character varying(20) NULL DEFAULT 'pending';

-- Add index for status field for better query performance
CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications USING btree (status);

-- Update existing notifications to have 'pending' status
UPDATE public.notifications SET status = 'pending' WHERE status IS NULL;

-- Add constraint to ensure status is one of the valid values
ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_status_check 
CHECK (status IN ('pending', 'accepted', 'declined', 'completed'));

-- Add comment to explain the status field
COMMENT ON COLUMN public.notifications.status IS 'Status of the notification action: pending (awaiting action), accepted (user accepted), declined (user declined), completed (action completed)';
