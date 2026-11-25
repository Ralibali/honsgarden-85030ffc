ALTER TABLE public.farm_invitations
  ADD COLUMN role text NOT NULL DEFAULT 'viewer'
  CHECK (role IN ('viewer', 'editor'));

-- Earlier versions recorded the owner's choice in the transactional message ID.
-- Collect mail awaiting delivery as well as sent mail. Some installations have
-- no pgmq queue, so treat its absence as an empty queue.
CREATE TEMP TABLE legacy_farm_invite_mail (message_id text, recipient_email text);

DO $$
BEGIN
  IF to_regclass('pgmq.q_transactional_emails') IS NOT NULL THEN
    INSERT INTO pg_temp.legacy_farm_invite_mail (message_id, recipient_email)
    SELECT message->>'message_id', lower(message->>'to')
    FROM pgmq.q_transactional_emails
    WHERE message->>'label' = 'farm-invitation';
  END IF;
END $$;

INSERT INTO pg_temp.legacy_farm_invite_mail (message_id, recipient_email)
SELECT message_id, lower(recipient_email)
FROM public.email_send_log
WHERE status = 'sent' AND template_name = 'farm-invitation';

-- Keep viewer when the role is missing or contradictory. Accepted memberships
-- already have their own role and do not need to be touched.
UPDATE public.farm_invitations AS invite
SET role = 'editor'
WHERE invite.status = 'pending'
  AND invite.expires_at > now()
  AND EXISTS (
    SELECT 1 FROM pg_temp.legacy_farm_invite_mail AS mail
    WHERE mail.recipient_email = lower(invite.email)
      AND mail.message_id = 'farm-invite-' || invite.token || '-editor'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_temp.legacy_farm_invite_mail AS mail
    WHERE mail.recipient_email = lower(invite.email)
      AND mail.message_id = 'farm-invite-' || invite.token || '-viewer'
  );

DROP TABLE pg_temp.legacy_farm_invite_mail;
