# Releasing

HACS installs the pack from GitHub releases. Release straight from `main`: no betas or pre-releases.

1. Bump `version` in `package.json` and the console banner in `src/index.ts`.
2. `npm run build`.
3. Commit as `vX.Y.Z`, tag `vX.Y.Z`, then push `main` and the tag.
4. `gh release create vX.Y.Z dist/ha-glass-dashboard.js --title vX.Y.Z --notes "…"`, with short, plain notes.
5. Update in HACS and reload. The browser console shows `GLASS DASHBOARD X.Y.Z`.

To update HACS for Liam (only when he asks), use HA's websocket: `hacs/repository/refresh`, then `hacs/repository/download` with the version.

**The phone app caches the cards.** After updating: Settings → Companion App → Debugging → Clear web view cache, then fully close and reopen the app.
