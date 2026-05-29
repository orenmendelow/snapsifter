export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://drkrm.app',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
  }

  const email = (body.email || '').trim().toLowerCase();
  if (!email || !email.includes('@') || email.length < 5) {
    return Response.json({ error: 'Invalid email' }, { status: 400, headers: corsHeaders });
  }

  try {
    await env.EMAILS.put(email, JSON.stringify({
      email,
      timestamp: new Date().toISOString(),
      source: 'landing',
    }));
  } catch {
    return Response.json({ error: 'Storage error' }, { status: 500, headers: corsHeaders });
  }

  return Response.json({ ok: true }, { headers: corsHeaders });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': 'https://drkrm.app',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
