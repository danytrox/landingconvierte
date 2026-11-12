# Pending: protect the contact form from spam and quota abuse

Status: not started. Notes for a future iteration.

## Problem

The contact form posts directly from the browser to Web3Forms
(`https://api.web3forms.com/submit`) and the `access_key` is public in
`index.html`. Anyone can POST straight to Web3Forms with that key, so a
rate limit on our side would not stop a bot from spending the monthly
submission quota. The only current protection is the `botcheck` honeypot.

## Constraints found (verified 2026-11-11)

- Web3Forms rejects server-side submissions (HTTP 403) unless the account
  has a paid plan and the server IP is safelisted. A proxy that hides the
  key is therefore not possible on the free plan.
  https://docs.web3forms.com/getting-started/troubleshooting
- Web3Forms Turnstile/reCaptcha and "Restrict to Domain" are paid features.
  https://docs.web3forms.com/getting-started/pro-features
- A client-side Turnstile widget alone does not protect the form; the token
  must be verified on the server.
  https://developers.cloudflare.com/use-cases/solutions/protect-sensitive-forms-fraud-abuse/

## Recommended option: own endpoint (free)

Replace Web3Forms with a Cloudflare Pages Function at `/api/contact`:

1. Verify a Cloudflare Turnstile token server-side (siteverify).
2. Rate limit per IP (`CF-Connecting-IP`), e.g. 3 submissions per 10 minutes,
   using KV or a Cloudflare WAF rate limiting rule on `/api/contact`.
3. Keep the honeypot and validate fields (length limits, email format).
4. Send the email through Resend (free tier) with the API key stored as a
   Pages secret, never shipped to the browser.
5. Update `main.js` to post to `/api/contact` and render the Turnstile widget;
   keep the current timeout and error messages.
6. Remove the Web3Forms `access_key` from `index.html`.

Owner setup needed before coding:

- Create a Turnstile widget for `landingconvierte.cl` (site key + secret).
- Create a Resend account and verify the domain (DNS records in Cloudflare).
- Add `TURNSTILE_SECRET` and `RESEND_API_KEY` as Pages environment secrets
  (plus a KV namespace binding if the rate limit uses KV).

## Alternative: Web3Forms Pro (paid)

Enable Turnstile and "Restrict to Domain" in the Web3Forms dashboard and add
the Turnstile widget to the form. Little code, but recurring cost, and there
is still no per-IP limit under our control.
