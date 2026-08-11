# HAC — Hartlepool Ambulance Charity Platform

Built by Launchpad Digital Solutions Ltd.

## Structure

```
hac/
├── public/             — Public site (CPR info, event booking requests)
│   ├── index.html
│   ├── events/
│   └── cpr/
│
├── admin/              — Admin portal (Jason + staff)
│   ├── index.html      — Home dashboard + call system
│   ├── calls/
│   ├── voicemails/
│   ├── sms/
│   ├── events/
│   ├── volunteers/
│   ├── uniform/
│   ├── settings/       — User management (add/reset)
│   └── login/
│
├── volunteer/          — Volunteer portal
│   ├── index.html      — Schedule + upcoming events
│   ├── schedule/
│   ├── uniform/        — Kit requests
│   ├── onboarding/     — New recruit sign-up
│   └── login/
│
├── worker/             — Cloudflare Worker (backend API)
│   ├── index.js
│   └── wrangler.toml
│
├── shared/             — Brand tokens, shared CSS, auth helpers
│   ├── hac.css
│   └── auth.js
│
├── _redirects          — Cloudflare Pages routing
└── README.md
```

## Deployments

| Portal | URL | Cloudflare Pages Project |
|--------|-----|--------------------------|
| Public | hac.launchpadclient.app | hac-public |
| Admin | admin.hac.launchpadclient.app | hac-admin |
| Volunteer | volunteer.hac.launchpadclient.app | hac-volunteer |
| Worker | worker.hac.launchpadclient.app | hac-worker (Wrangler) |

## Stack

- Cloudflare Pages (hosting — 3 projects)
- Cloudflare Worker (backend API, Twilio webhook handler)
- Supabase (auth + database)
- Twilio (inbound calls, voicemail, outbound SMS)

## Supabase Tables

| Table | Purpose |
|-------|---------|
| hac_profiles | User roles (admin / volunteer) |
| hac_calls | Inbound call log |
| hac_voicemails | Voicemail recordings |
| hac_sms_log | Outbound donation SMS |
| hac_events | Events created by admin |
| hac_assignments | Volunteer-to-event assignments |
| hac_uniform_requests | Kit requests from volunteers |

## Auth

- No email confirmation — users created by admin via /api/users
- Fake email pattern: username@hac.internal
- Roles: admin | volunteer
- Password reset: admin only, via /api/users/reset

## Build Order

1. [ ] Supabase schema
2. [ ] Worker routes (Twilio webhook + user management)
3. [ ] Admin login
4. [ ] Admin home dashboard
5. [ ] Call log, voicemails, SMS log
6. [ ] Volunteer login + home
7. [ ] Events module (admin + volunteer)
8. [ ] Rota/scheduling
9. [ ] Uniform requests
10. [ ] Public site
