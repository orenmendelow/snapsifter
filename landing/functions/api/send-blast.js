export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://drkrm.app',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Auth check
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token || token !== env.BLAST_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
  }

  // Parse body
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
  }

  const { subject, html, text } = body;
  if (!subject || (!html && !text)) {
    return Response.json(
      { error: 'Missing required fields: subject and at least one of html or text' },
      { status: 400, headers: corsHeaders },
    );
  }

  // Collect all subscriber emails from KV (paginate through all keys)
  const emails = [];
  let cursor = undefined;
  try {
    do {
      const listResult = await env.EMAILS.list({ cursor, limit: 1000 });
      for (const key of listResult.keys) {
        emails.push(key.name);
      }
      cursor = listResult.list_complete ? null : listResult.cursor;
    } while (cursor);
  } catch {
    return Response.json({ error: 'Failed to list subscribers' }, { status: 500, headers: corsHeaders });
  }

  if (emails.length === 0) {
    return Response.json({ error: 'No subscribers found' }, { status: 404, headers: corsHeaders });
  }

  // --- Option A (active): Return the subscriber list for manual Gmail BCC send ---
  // Gmail SMTP from a Cloudflare Worker requires a third-party transactional email
  // service (Resend, SendGrid, Mailgun, etc.). For now, grab the list and BCC from Gmail.
  return Response.json({
    ok: true,
    count: emails.length,
    emails,
    subject,
    instructions: 'BCC all emails from support@drkrm.app in Gmail. Subject and content were echoed back for convenience.',
  }, { headers: corsHeaders });

  // --- Option B (stubbed): Send via Resend API ---
  // Requires:
  //   1. Sign up at https://resend.com and verify drkrm.app domain
  //   2. Set RESEND_API_KEY env var in Cloudflare Pages project settings
  //   3. Uncomment the code below and remove the Option A return above
  //
  // const RESEND_API_KEY = env.RESEND_API_KEY;
  // if (!RESEND_API_KEY) {
  //   return Response.json({ error: 'RESEND_API_KEY not configured' }, { status: 500, headers: corsHeaders });
  // }
  //
  // const results = { sent: 0, failed: 0, errors: [] };
  //
  // // Resend supports up to 50 recipients per batch call.
  // // For larger lists, chunk into batches.
  // const BATCH_SIZE = 50;
  // for (let i = 0; i < emails.length; i += BATCH_SIZE) {
  //   const batch = emails.slice(i, i + BATCH_SIZE);
  //   try {
  //     const res = await fetch('https://api.resend.com/emails/batch', {
  //       method: 'POST',
  //       headers: {
  //         'Authorization': `Bearer ${RESEND_API_KEY}`,
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify(batch.map(to => ({
  //         from: 'drkrm <support@drkrm.app>',
  //         to,
  //         subject,
  //         html: html || undefined,
  //         text: text || undefined,
  //       }))),
  //     });
  //     if (res.ok) {
  //       results.sent += batch.length;
  //     } else {
  //       const err = await res.text();
  //       results.failed += batch.length;
  //       results.errors.push({ batch: `${i}-${i + batch.length}`, error: err });
  //     }
  //   } catch (err) {
  //     results.failed += batch.length;
  //     results.errors.push({ batch: `${i}-${i + batch.length}`, error: err.message });
  //   }
  // }
  //
  // return Response.json({
  //   ok: results.failed === 0,
  //   sent: results.sent,
  //   failed: results.failed,
  //   errors: results.errors.length > 0 ? results.errors : undefined,
  // }, { headers: corsHeaders });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': 'https://drkrm.app',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
