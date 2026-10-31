# Glass Dashboard

A frosted-glass, phone-first Home Assistant dashboard: a pack of custom Lovelace cards and pop-ups (Lit 3, TypeScript, Vite). Repo: `leham789/ha-glass-dashboard`. Installed on HA through HACS from GitHub releases.

**Keep this file current.** When you learn something new about how Liam wants to work, a rule, a gotcha or a decision, add it here in the right section before you finish. Keep it short: facts and rules, not history.

## How Liam works

- **Design first, then build.** New ideas go on the design canvas first. Code only when he asks ("build it", "yes, build them").
- **The design always matches the build.** The canvas shows exactly what the cards render, and stays in sync with the live code. If you change one, change the other in the same piece of work, or say clearly what's out of step.
- **Design only what Home Assistant can actually do.** No buttons that do nothing. If HA can't do it, drop it from the design.
- **Light and dark both work** for everything.
- **Commit only when asked.** Releases are public, so confirm before publishing one.
- He reviews on his phone and in the canvas, and comments on the canvas. Keep replies short and plain. Credits matter: keep chats focused, don't dump whole files into the chat, and batch small changes.

## Design canvas

- Canvas: https://claude.ai/artifact/VRZ7zCC8EHgBGCy5hAT4tP (Design artifact). Pages: **Designs** and **Dark Mode** (dark wrappers that import a frame with `theme="Dark"`).
- `design/` in this folder mirrors every frame. It's local only (gitignored), so it's not in GitHub. Copy changed frames there after publishing.
- Frames are `.dc.html`: markup with `{{values}}`, `<sc-if>`, `<sc-for>`, and a `Component extends DCLogic` script whose `renderVals()` fills them. **Tweaks** (`data-props`) show states, such as `theme`, `sensors`, `camera` or `state`. `canvas.json` places boards: a new frame needs an entry in `boards` and in `order`.
- **The design system** is the foundation frames (Type, Colour, Spacing, Sizing, Radius, Elevation, Motion, Opacity, Icons), plus **Components** (every part and its states) and **Card Library** (every card, with the rule for when it shows). Anything new goes into those too.
- **Before publishing, always re-read the live files.** Other sessions and the canvas page itself save edits. The page often re-encodes `data-props` (`&quot;`), which is harmless. Re-apply your change to what's live; never resend an old copy.
- **Canvas comments:** make the change, publish, reply in the thread, and write one short line in the chat. Don't resolve threads; Liam does.
- Icons come only from `src/icons.ts` (Lucide, built from `assets/lucide-icons`). Use the same paths on the canvas.

## Home Assistant

- `http://homeassistant.local:8123`. The dashboard is at `/glass-dashboard`.
- **Liam signs in himself.** Never type HA passwords. Once he's signed in, you may read and edit HA (entities, dashboards, settings) in the browser.
- His sensors are mostly **Zigbee2MQTT**. Zigbee sensors drop out and keep a stale value, which is why "Not reporting" exists. Zigbee2MQTT's **Last seen** sensors (`sensor.*_last_seen`, off by default in HA) give the true last-heard time; HA's own times reset on restart.
- The frontend's `hass` doesn't include `last_reported`, so the cards use the Last seen sensor, then `last_updated`.

## Code

- `npm run build` writes `dist/ha-glass-dashboard.js` and `design/tokens.css`; `npx tsc --noEmit` type-checks. No Prettier config: match the existing style (single quotes, 2 spaces). Don't run Prettier.
- `src/tokens.ts` is the only place colours, sizes and radii live; the canvas uses the exported `design/tokens.css`.
- `GlassElement` (`src/glass-element.ts`) is the base for every card and sheet. It handles:
  - dark mode
  - the offline fade and banner
  - a redraw every 5 minutes, so dead sensors still show as quiet
  - the `quiet_hours` option

  Most cards skip renders with `shouldUpdate` unless their own entities changed, so anything time-based needs the tick or its own check.
- **Pop-ups:** `openMoreInfo()` routes to our own sheets (`src/sheets/`, registered in `entity-sheets.ts`); anything else falls back to HA's dialog. Sheets extend `GlassSheet` / `GlassEntitySheet`.
- `src/stale.ts` decides "not reporting": default hours by sensor type (climate 2, contacts 12, battery 24), raised with `quiet_hours`. Quiet readings stay greyed, are left out of averages, ranges and "Coldest room", and a quiet door never says open or shut.
- **Every card option goes in the card's editor and in the README.** Document features in the README as you build them.

## Preview

- The dev server is `ha-preview` in `.claude/launch.json`, on port 5173. Pages: `dev/index.html` (Home showcase), `room.html`, `bedroom.html`, `office.html`, `energy.html`, `security.html`. They run on mock data in `dev/mock.ts`.
- Mock switches in the URL: `?dark`, `?offline` (the HA-unreachable banner), `?quiet` (sensors gone quiet).
- The dev Home page lays every card out as a showcase; card order on the real dashboard is set in HA.

## Releasing (HACS)

1. Bump `version` in `package.json` and the console banner in `src/index.ts`.
2. Run `npm run build`.
3. Commit as `vX.Y.Z`, tag `vX.Y.Z`, then push `main` and the tag.
4. `gh release create vX.Y.Z dist/ha-glass-dashboard.js --title vX.Y.Z --notes "…"` with short, plain notes.
5. Liam updates in HACS and reloads; the console shows `GLASS DASHBOARD X.Y.Z`.

## Git

- Work on `main` unless asked otherwise. One Claude session per folder: two sessions in the same checkout have overwritten each other's work before. Use a worktree for parallel work, and merge or remove it when done.
- End commit messages with the Co-Authored-By line the session gives you.

## Open decisions

- **Background glows:** every canvas page has soft coloured glows behind it, but the build doesn't (the cards can't paint the page background). Undecided: drop them from the canvas, or add one HA theme background for every page.
