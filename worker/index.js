// HAC Cloudflare Worker
// Twilio call handling + admin user management.
//
// Routes
//   POST /webhook/twilio           Inbound call — returns TwiML, logs call
//   POST /webhook/twilio/status    Call completed — updates duration/outcome, fires donation SMS
//   POST /webhook/twilio/recording Voicemail recorded — stores recording
//   GET  /api/calls                Recent calls        (admin)
//   GET  /api/voicemails           Recent voicemails   (admin)
//   GET  /api/sms                  Recent SMS          (admin)
//   POST /api/users                Create volunteer    (admin)
//   POST /api/users/reset          Reset password      (admin)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "") || "/";

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    try {
      if (path === "/webhook/twilio" && request.method === "POST") return handleInboundCall(request, env);
      if (path === "/webhook/twilio/status" && request.method === "POST") return handleCallStatus(request, env);
      if (path === "/webhook/twilio/recording" && request.method === "POST") return handleRecording(request, env);

      if (path === "/api/calls" && request.method === "GET") return listTable(request, env, "calls");
      if (path === "/api/voicemails" && request.method === "GET") return listTable(request, env, "voicemails");
      if (path === "/api/sms" && request.method === "GET") return listTable(request, env, "sms_log");

      if (path === "/api/users" && request.method === "POST") return createUser(request, env);
      if (path === "/api/users/reset" && request.method === "POST") return resetPassword(request, env);

      if (path === "/health") return json({ ok: true, time: new Date().toISOString() });
    } catch (err) {
      return json({ error: err.message }, 500);
    }

    return json({ error: "Not found" }, 404);
  },
};

/* ---------- helpers ---------- */

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

function twiml(xml) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${xml}</Response>`, {
    headers: { "Content-Type": "text/xml" },
  });
}

// PostgREST against the `hac` schema using the service key.
async function db(env, table, { method = "GET", query = "", body = null, prefer = "" } = {}) {
  const headers = {
    apikey: env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json",
    "Accept-Profile": "hac",
    "Content-Profile": "hac",
  };
  if (prefer) headers.Prefer = prefer;

  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}${query}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`db ${table}: ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

// Supabase Admin Auth API
async function authAdmin(env, path, { method = "POST", body = null } = {}) {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin${path}`, {
    method,
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`auth: ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

// Verify the caller's JWT and confirm they are a HAC admin.
async function requireAdmin(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Missing token");

  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Invalid token");
  const user = await res.json();

  const rows = await db(env, "volunteers", {
    query: `?user_id=eq.${user.id}&select=id,name,role&limit=1`,
  });
  if (!rows.length || rows[0].role !== "admin") throw new Error("Not authorised");
  return rows[0];
}

async function formParams(request) {
  const raw = await request.text();
  return Object.fromEntries(new URLSearchParams(raw));
}

/* ---------- Twilio ---------- */

async function handleInboundCall(request, env) {
  const p = await formParams(request);

  await db(env, "calls", {
    method: "POST",
    body: {
      caller_number: p.From || "unknown",
      twilio_call_sid: p.CallSid,
      duration: 0,
      outcome: "ringing",
      handled: false,
    },
    prefer: "return=minimal",
  });

  const base = new URL(request.url).origin;
  const greeting =
    "Thank you for calling Hartlepool Ambulance Charity. " +
    "We are a volunteer run charity providing first aid cover across Hartlepool. " +
    "If this is a medical emergency, please hang up and dial 9 9 9. " +
    "Please leave a message after the tone and a member of our team will call you back.";

  return twiml(
    `<Say voice="Polly.Amy-Neural">${greeting}</Say>` +
      `<Record maxLength="120" playBeep="true" timeout="5" ` +
      `recordingStatusCallback="${base}/webhook/twilio/recording" ` +
      `recordingStatusCallbackMethod="POST" />` +
      `<Say voice="Polly.Amy-Neural">We did not receive a message. Goodbye.</Say>`
  );
}

async function handleCallStatus(request, env) {
  const p = await formParams(request);
  const sid = p.CallSid;
  const duration = parseInt(p.CallDuration || "0", 10);
  const status = p.CallStatus;

  const outcome =
    status === "completed" ? (duration > 0 ? "answered" : "missed")
    : status === "no-answer" || status === "busy" || status === "failed" ? "missed"
    : status;

  const rows = await db(env, "calls", {
    method: "PATCH",
    query: `?twilio_call_sid=eq.${encodeURIComponent(sid)}`,
    body: { duration, outcome },
    prefer: "return=representation",
  });

  // Fire a donation SMS after a genuine conversation.
  const call = rows && rows[0];
  if (call && outcome === "answered" && duration >= 20) {
    await sendDonationSms(env, call.id, p.From);
  }

  return new Response("OK", { status: 200 });
}

async function handleRecording(request, env) {
  const p = await formParams(request);
  const sid = p.CallSid;

  const calls = await db(env, "calls", {
    query: `?twilio_call_sid=eq.${encodeURIComponent(sid)}&select=id,caller_number&limit=1`,
  });
  const call = calls[0];

  await db(env, "voicemails", {
    method: "POST",
    body: {
      call_id: call ? call.id : null,
      caller_number: (call && call.caller_number) || p.From || "unknown",
      recording_url: p.RecordingUrl ? `${p.RecordingUrl}.mp3` : null,
      duration: parseInt(p.RecordingDuration || "0", 10),
      twilio_recording_sid: p.RecordingSid,
      listened: false,
      handled: false,
    },
    prefer: "return=minimal",
  });

  if (call) {
    await db(env, "calls", {
      method: "PATCH",
      query: `?id=eq.${call.id}`,
      body: { outcome: "voicemail" },
      prefer: "return=minimal",
    });
  }

  return new Response("OK", { status: 200 });
}

async function sendDonationSms(env, callId, to) {
  const message =
    "Thank you for calling Hartlepool Ambulance Charity. " +
    "To support our volunteer crews you can donate here: https://hac.launchpadclient.app/donate";

  const body = new URLSearchParams({ To: to, From: env.TWILIO_NUMBER, Body: message });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    }
  );

  const result = await res.json();

  await db(env, "sms_log", {
    method: "POST",
    body: {
      call_id: callId,
      recipient_number: to,
      message,
      status: res.ok ? result.status || "queued" : "failed",
      twilio_message_sid: result.sid || null,
    },
    prefer: "return=minimal",
  });
}

/* ---------- API ---------- */

async function listTable(request, env, table) {
  try {
    await requireAdmin(request, env);
  } catch (e) {
    return json({ error: e.message }, 401);
  }
  const limit = new URL(request.url).searchParams.get("limit") || "50";
  const rows = await db(env, table, { query: `?select=*&order=created_at.desc&limit=${limit}` });
  return json({ [table]: rows });
}

async function createUser(request, env) {
  try {
    await requireAdmin(request, env);
  } catch (e) {
    return json({ error: e.message }, 401);
  }

  const { username, name, password, phone, qualification, role } = await request.json();
  if (!username || !name || !password) {
    return json({ error: "username, name and password are required" }, 400);
  }

  const email = username.includes("@") ? username : `${username}@hac.internal`;

  const user = await authAdmin(env, "/users", {
    body: { email, password, email_confirm: true, user_metadata: { name } },
  });

  await db(env, "volunteers", {
    method: "POST",
    body: {
      user_id: user.id,
      name,
      email,
      phone: phone || null,
      role: role === "admin" ? "admin" : "volunteer",
      qualification: qualification || null,
      qualified: !!qualification && qualification !== "In training",
      active: true,
    },
    prefer: "return=minimal",
  });

  return json({ success: true, id: user.id, email });
}

async function resetPassword(request, env) {
  try {
    await requireAdmin(request, env);
  } catch (e) {
    return json({ error: e.message }, 401);
  }

  const { user_id, password } = await request.json();
  if (!user_id || !password) return json({ error: "user_id and password are required" }, 400);
  if (password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);

  await authAdmin(env, `/users/${user_id}`, { method: "PUT", body: { password } });
  return json({ success: true });
}
