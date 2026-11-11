# Daily reminders — setting up the push server

Spese can send one notification a day ("Rent ₹15,000 deducted today", or a nudge to log). A web
app can't wake itself up while closed, so a tiny server — `push-worker/`, a Cloudflare Worker —
knocks at the chosen time. **It never sees your money:** per phone it stores only the browser's push
address, the reminder time, the timezone and the last date it sent. The push it sends is empty;
the phone writes the message from its own data. With the app lock on, the message shows no
amounts or names at all.

Free tier is plenty (one phone, one push a day, a check every 5 minutes). It takes ~10 minutes.
You need a free Cloudflare account — Claude can't create or sign in to it for you.

## 1. Create the account and log in

1. Sign up at dash.cloudflare.com (any email; "Workers" free plan).
2. On your computer, in this repo:
   ```bash
   cd push-worker
   npx wrangler login
   ```
   A browser window asks you to allow Wrangler — approve it.

## 2. Make the storage and keys

```bash
npx wrangler kv namespace create SUBSCRIBERS
```
Copy the `id` it prints into `push-worker/wrangler.toml` (replace `REPLACE_WITH_YOUR_KV_NAMESPACE_ID`).

```bash
node scripts/generate-vapid.mjs
```
- Copy the **public key** into `wrangler.toml` → `VAPID_PUBLIC_KEY`.
- Then store the **private JWK** as a secret (paste it when asked):
  ```bash
  npx wrangler secret put VAPID_PRIVATE_JWK
  ```
  Never put the private key in a file or commit it. If you ever leak it, run the generator
  again, update both, and turn reminders off and on again on your phone.

Check `ALLOWED_ORIGIN` in `wrangler.toml` is your app's address (`https://spese-lake.vercel.app`).

## 3. Deploy

```bash
npx wrangler deploy
```
It prints the server's address, like `https://spese-push.<your-name>.workers.dev`.

## 4. Tell the app where the server is

In Vercel: Project → Settings → Environment Variables → add
`VITE_PUSH_URL` = the address from step 3 (Production). Then Deployments → ⋯ → **Redeploy**.

## 5. Turn it on (iPhone)

1. Open Spese **from the Home Screen** (iOS only allows notifications for Home Screen apps, 16.4+).
2. Settings → Reminders → pick a time → **Turn on reminders** → Allow.
3. **Send a test** — a notification should arrive within a few seconds.

## Notes

- Changing the time, or turning reminders off, updates the server straight away.
- If the phone uninstalls Spese or blocks notifications, the server notices on its next send
  (the push service answers "gone") and deletes that phone's record by itself.
- The server refuses requests from any site but yours, accepts only real push-service
  addresses, and holds at most 50 phones.
- To remove everything: `npx wrangler delete` in `push-worker/`, and delete `VITE_PUSH_URL` in Vercel.
