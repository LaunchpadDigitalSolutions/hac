const SUPA_URL = 'https://zwndffsorkqsjykauepp.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3bmRmZnNvcmtxc2p5a2F1ZXBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MzY4NDUsImV4cCI6MjA5ODExMjg0NX0.07KfE2A_sxEfGq1oPnEFvTihs0o54ZuTHG7DuMls7g0';

const supabase = window.supabase.createClient(SUPA_URL, SUPA_KEY, {
  db: { schema: 'hac' }
});

async function getProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('volunteers').select('*').eq('user_id', user.id).single();
  return data;
}

async function requireAdmin() {
  const p = await getProfile();
  if (!p || p.role !== 'admin') { window.location.href = '/admin/login/'; return null; }
  return p;
}

async function requireVolunteer() {
  const p = await getProfile();
  if (!p) { window.location.href = '/volunteer/login/'; return null; }
  return p;
}

async function hacSignOut(dest) {
  await supabase.auth.signOut();
  window.location.href = dest || '/admin/login/';
}

function toast(msg, ok) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.style.background = ok === false ? '#B91C1C' : '#1A1A1A';
  t.style.display = 'block';
  setTimeout(() => t.style.display = 'none', 3000);
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'});
}

function fmtTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'});
}

function fmtDuration(secs) {
  if (!secs) return '0:00';
  const m = Math.floor(secs/60), s = secs%60;
  return m+':'+(s<10?'0':'')+s;
}
