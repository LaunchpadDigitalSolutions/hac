# HAC — Hartlepool Ambulance Charity

Call management system for HAC. Built by Launchpad Digital Solutions Ltd.

## Structure

```
hac/
├── dashboard/    — Call log, voicemails, SMS log
├── rota/         — Volunteer management (v2)
└── index.html    — App root / module nav
```

## Live URL

https://hac.launchpadclient.app

## Stack

- Cloudflare Pages (hosting)
- Cloudflare Worker (Twilio webhook handler)
- Supabase (data)
- Twilio (call management, SMS)

## Modules

| Module | Status | URL |
|--------|--------|-----|
| Dashboard | In progress | /dashboard |
| Rota | Planned | /rota |
