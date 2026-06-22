import { createClient } from 'npm:@supabase/supabase-js@2.57.2';

const APP_URL = Deno.env.get('PUBLIC_APP_URL') || 'https://honsgarden.se';

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char] || char));
}

Deno.serve(async (request) => {
  const secret = Deno.env.get('CRON_SECRET') || '';
  const bearer = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!secret || (bearer !== secret && request.headers.get('x-cron-secret') !== secret)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const url = Deno.env.get('SUPABASE_URL') || '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!url || !key) return new Response(JSON.stringify({ error: 'Missing configuration' }), { status: 500 });
  const client = createClient(url, key, { auth: { persistSession: false } });

  await client.rpc('schedule_egg_sale_reminders').catch(() => null);

  const { data: rows, error } = await client
    .from('notification_outbox')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at')
    .limit(50);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  let sent = 0;
  let failed = 0;
  for (const item of rows || []) {
    try {
      if (!item.recipient_email) throw new Error('Mottagarens e-postadress saknas');
      const orderPath = typeof item.payload?.order_path === 'string' ? item.payload.order_path : '';
      const link = orderPath ? `${APP_URL}${orderPath}` : '';
      const html = `
        <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;padding:28px">
          <h1 style="font-family:Georgia,serif;color:#315b38">${escapeHtml(item.subject || 'Meddelande från Agdas bod')}</h1>
          <p style="line-height:1.6;color:#4b4b45">${escapeHtml(item.message)}</p>
          ${link ? `<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#315b38;color:white;text-decoration:none;padding:12px 18px;border-radius:10px">Öppna din beställning</a></p>` : ''}
          <p style="font-size:12px;color:#888;margin-top:28px">Detta är ett automatiskt meddelande från Hönsgården.</p>
        </div>`;
      const text = `${item.subject || 'Agdas bod'}\n\n${item.message}${link ? `\n\n${link}` : ''}`;
      const { error: enqueueError } = await client.rpc('enqueue_email', {
        queue_name: 'transactional_emails',
        payload: {
          run_id: crypto.randomUUID(),
          to: item.recipient_email,
          from: 'Hönsgården <noreply@notify.honsgarden.se>',
          sender_domain: 'notify.honsgarden.se',
          subject: item.subject || 'Meddelande från Agdas bod',
          html,
          text,
          purpose: 'transactional',
          label: `egg-sale-${item.notification_type}`,
          message_id: `egg-sale-${item.id}`,
          queued_at: new Date().toISOString(),
        },
      });
      if (enqueueError) throw enqueueError;

      await client.from('notification_outbox').update({
        status: 'sent', sent_at: new Date().toISOString(), attempts: Number(item.attempts || 0) + 1,
        error_message: null, updated_at: new Date().toISOString(),
      }).eq('id', item.id);
      sent += 1;
    } catch (notificationError) {
      await client.from('notification_outbox').update({
        status: 'failed', failed_at: new Date().toISOString(), attempts: Number(item.attempts || 0) + 1,
        error_message: notificationError instanceof Error ? notificationError.message : String(notificationError),
        updated_at: new Date().toISOString(),
      }).eq('id', item.id);
      failed += 1;
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: (rows || []).length, sent, failed }), {
    headers: { 'content-type': 'application/json' },
  });
});
