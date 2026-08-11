// HAC Cloudflare Worker
// Routes: /webhook/twilio | /api/calls | /api/voicemails | /api/sms | /api/users

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/webhook/twilio") return handleTwilio(request, env);
    if (path === "/api/calls") return handleCalls(request, env);
    if (path === "/api/voicemails") return handleVoicemails(request, env);
    if (path === "/api/sms") return handleSms(request, env);
    if (path === "/api/users" && request.method === "POST") return createUser(request, env);
    if (path === "/api/users/reset" && request.method === "POST") return resetPassword(request, env);

    return new Response("Not found", { status: 404 });
  }
};

async function handleTwilio(request, env) {
  // TODO: receive inbound call webhook, log to Supabase, fire SMS
  return new Response("OK", { status: 200 });
}

async function handleCalls(request, env) {
  // TODO: fetch hac_calls from Supabase
  return Response.json({ calls: [] });
}

async function handleVoicemails(request, env) {
  // TODO: fetch hac_voicemails from Supabase
  return Response.json({ voicemails: [] });
}

async function handleSms(request, env) {
  // TODO: fetch hac_sms_log from Supabase
  return Response.json({ sms: [] });
}

async function createUser(request, env) {
  // TODO: create Supabase user via service key, no email confirm
  return Response.json({ success: true });
}

async function resetPassword(request, env) {
  // TODO: reset password via Supabase service key
  return Response.json({ success: true });
}