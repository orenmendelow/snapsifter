export async function onRequestPost(context) {
  try {
    const { email } = await context.request.json();
    const timestamp = Date.now();

    await context.env.EMAILS.put(`submission_${timestamp}`, JSON.stringify({
      email,
      timestamp: new Date(timestamp).toISOString(),
    }));

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
}
