// HAC auth helper
// Checks Supabase session and redirects if not logged in
// Role check: admin | volunteer
async function requireAuth(role) {
  // TODO: wire to Supabase client
  console.log("Auth check for role:", role);
}