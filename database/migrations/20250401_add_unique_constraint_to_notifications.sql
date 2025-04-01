-- Add a unique constraint to prevent duplicate reply notifications
-- for the same recipient and the same reply.
ALTER TABLE public.notifications
ADD CONSTRAINT notifications_recipient_reply_unique UNIQUE (recipient_id, reply_id);
