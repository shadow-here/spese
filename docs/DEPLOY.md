# Deploy and device checklist

The app is a static site (`npm run build` → `dist/`). It uses hash URLs (`/#/fixed`), so no
server rewrites are needed, and it must be served over **HTTPS** for the service worker and
Add to Home Screen to work. Every free static host does that by default.

## Host options (pick one)

| Host | How | Config in repo |
| --- | --- | --- |
| **Netlify** | New site → import the Git repo, or drag-drop `dist/` at app.netlify.com/drop | `netlify.toml` |
| **Vercel** | New project → import the Git repo (framework: Vite) | `vercel.json` |
| **GitHub Pages** | Needs `base: '/<repo>/'` in `vite.config.ts` and a Pages workflow — ask Claude to add it | — |

Both configs keep `sw.js`, `registerSW.js` and the manifest uncached, so installed apps
pick up new versions; hashed `assets/*` are cached forever.

**After each deploy** an installed app checks for the new version when it's opened or brought
back to the foreground (and hourly while open), downloads it in the background, then shows a
banner: *"A new version of Spese is ready — Later / Reload"*. Nothing reloads on its own, so an
update never interrupts an entry. Your data is never touched by an update.

*One-time note:* a device still running the version from before 11 Nov 2026 (which had no
banner) picks up this version once the app is fully closed (swiped away) and reopened.

## Changing the app's name or icon on a phone

iPhone (and Android) copy the name and icon once, at **Add to Home Screen**, and never refresh
them. After a name or icon change, re-add the app — but deleting the home-screen app deletes its
data, so move it with a backup:

1. In the installed app: Settings → **Export backup** → save to Files.
2. Delete Spese from the Home Screen.
3. In Safari open the site → Share → **Add to Home Screen** (shows the new name and icon).
4. Open it → **Restore from backup** on the welcome screen.
5. Turn the app lock and reminders back on if you use them — they're per device, not in backups.

## Before the first real use — on an iPhone (iOS 16.4+)

1. Open the deployed URL in **Safari**, Share → **Add to Home Screen**. Check the icon is the
   dark "₹-style" mark with no white edge.
2. Open it from the home screen: no Safari bars, status bar dark.
3. Onboard; tap **+**: the amount field should focus **and the keyboard should open**.
   (iOS sometimes refuses programmatic focus — if the keyboard doesn't appear, tell Claude.)
4. Add an expense in under 5 seconds; check the dashboard updates.
5. Turn on **Airplane mode**, close and reopen the app: it should open and work.
6. Settings → **Export backup**: the share sheet opens; save to Files.
7. Delete the app, re-add it, Settings → **Restore from file** with that backup: data returns.
8. Settings → Text Size (iOS Settings → Display & Brightness) at a large size: screens still fit.

## On Android (Chrome)

1. Open the URL; Settings → **Install** (or Chrome's menu → Install app).
2. Repeat steps 3–7 above. Settings should say storage is *protected from automatic clean-up*
   once installed.
