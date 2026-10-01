# LaunchKit Production

## Automated flow
Visitor -> Stripe hosted checkout -> Stripe webhook -> Resend delivery email -> download link.
Leads -> `/api/leads` -> confirmation email.
Analytics -> `/api/analytics`.
Recurring marketing trigger -> `/api/cron/content` with `x-cron-secret`.

## Required account connections
- Stripe: create a Payment Link and webhook pointing to `/webhook`.
- Resend: verified sending domain + API key.
- Digital delivery: upload the purchased ZIP/PDF/video to a private/controlled storage provider and put its delivery URL in `PRODUCT_DOWNLOAD_URL`.
- Marketing publisher: connect an authorized scheduler/social/email provider to `/api/cron/content`.

## Railway
Deploy this directory from a connected GitHub repository. Add the environment variables from `.env.example`.
Do not commit real secrets.
