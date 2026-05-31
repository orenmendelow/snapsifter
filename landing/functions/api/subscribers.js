export async function onRequestGet(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://drkrm.app',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token || token !== env.ADMIN_TOKEN) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const cursor = url.searchParams.get('cursor') || undefined;

  try {
    const listResult = await env.EMAILS.list({ cursor, limit: 1000 });

    const subscribers = await Promise.all(
      listResult.keys.map(async (key) => {
        const raw = await env.EMAILS.get(key.name);
        if (!raw) return { email: key.name, timestamp: null, source: null };
        try {
          return JSON.parse(raw);
        } catch {
          return { email: key.name, timestamp: null, source: null };
        }
      })
    );

    return Response.json({
      subscribers,
      cursor: listResult.list_complete ? null : listResult.cursor,
      complete: listResult.list_complete,
      count: subscribers.length,
    }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: 'Failed to list subscribers' }, { status: 500, headers: corsHeaders });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': 'https://drkrm.app',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
