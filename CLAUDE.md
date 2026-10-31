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
- **His own dashboard comes first; a shareable pack second.** So every card has a visual editor and no hardcoded entities, uses only stable HA frontend APIs, and adds no third-party runtime dependencies.
- **It should feel like a native iPhone app** (iOS 26 is the reference). When unsure how something should behave, check what Apple does.
- **Approval prompts annoy him.** Don't drive HA in the browser to test every change unless he asks: test in the preview, release, and tell him what to look at. Check in HA when he asks, or when only real data can show it.
- **This repo is public.** Nothing that describes his home goes into it, this file included: no entity IDs, rooms or devices. `design/` and `.claude/` stay gitignored.

## Design canvas

- Canvas: https://claude.ai/artifact/VRZ7zCC8EHgBGCy5hAT4tP (Design artifact). Pages: **Designs** and **Dark Mode** (dark wrappers that import a frame with `theme="Dark"`).
- `design/` in this folder mirrors every frame. It's local only (gitignored), so it's not in GitHub. Copy changed frames there after publishing.
- Frames are `.dc.html`: markup with `{{values}}`, `<sc-if>`, `<sc-for>`, and a `Component extends DCLogic` script whose `renderVals()` fills them. **Tweaks** (`data-props`) show states, such as `theme`, `sensors`, `camera` or `state`. `canvas.json` places boards: a new frame needs an entry in `boards` and in `order`.
- **The design system** is the foundation frames (Type, Colour, Spacing, Sizing, Radius, Elevation, Motion, Opacity, Icons), plus **Components** (every part and its states) and **Card Library** (every card, with the rule for when it shows). Anything new goes into those too.
- **Before publishing, always re-read the live files.** Other sessions and the canvas page itself save edits. The page often re-encodes `data-props` (`&quot;`), which is harmless. Re-apply your change to what's live; never resend an old copy.
- **Canvas comments:** make the change, publish, reply in the thread, and write one short line in the chat. Don't resolve threads; Liam does.
- Icons come only from `src/icons.ts` (Lucide, built from `assets/lucide-icons`). Use the same paths on the canvas.
- The canvas belongs to Liam's other Claude account. From some sessions you can read and publish it and read comments, but not reply to or resolve threads; if so, make the change and say so in the chat.

## Home Assistant

- `http://homeassistant.local:8123`. The dashboard is at `/glass-dashboard`.
- **Liam signs in himself.** Never type HA passwords. Once he's signed in, you may read and edit HA (entities, dashboards, settings) in the browser.
- His sensors are mostly **Zigbee2MQTT**. Zigbee sensors drop out and keep a stale value, which is why "Not reporting" exists. Zigbee2MQTT's **Last seen** sensors (`sensor.*_last_seen`, off by default in HA) give the true last-heard time; HA's own times reset on restart.
- The frontend's `hass` doesn't include `last_reported`, so the cards use the Last seen sensor, then `last_updated`.
- **Kiosk Mode** (HACS) hides HA's top bar on this dashboard (`kiosk_mode: hide_header: true` in its config). To edit on a computer, add `?disable_km` to the address.
- **The phone app caches the cards.** After a release: Settings → Companion App → Debugging → Clear web view cache, then fully close and reopen the app.
- Opening the dashboard by its bare address (`/glass-dashboard`, as the app does) shows its first page. Code that works out "which page am I on" must treat that as Home.
- **Cameras are UniFi Protect.** Live video uses HA's WebRTC (`camera/webrtc/offer` and `camera/webrtc/candidate`), falling back to HLS, then refreshed stills. Detection snapshots come from `/api/unifiprotect/thumbnail/<config entry>/<event id>`, signed with `auth/sign_path`.
- **HA freezes for about 0.8 s** while it builds a page after navigating. Only transform and opacity animations keep running through that, so anything that animates across a page change must use only those.

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

## Interaction and motion

The canvas **Motion** frame (with the **Motion & haptics** demo) is the spec; `src/motion.ts` holds the shared pieces.

- **Tap anywhere.** A card with one main action does it when tapped anywhere: a full-card `.open` button (absolutely positioned over a `position: relative` card, drawn content `pointer-events: none`, any small icon becomes a decorative hint). Cards with several different actions keep separate buttons. Note the tap behaviour in the Card library.
- **Short and quiet.** One curve, `cubic-bezier(0.2, 0.8, 0.2, 1)`. Nothing bounces. Loops only while something waits (the attention glow stops after 30 s). Reduced motion turns everything into plain fades.
- **Pages appear at once.** No load-in animation: Liam tried it and prefers it snappy. The bottom menu never moves.
- **Pressing** shrinks whatever's pressed to 97% (`press()` in `GlassElement`); a full-card `.open` button shrinks its card. `data-no-press` opts out (things you drag).
- **The menu:** the current page is the dark pill with its name, always 128px wide, so only the icons it jumps over move. (Equal slots were tried and rejected.) The name turns white as the pill arrives.
- **Haptics:** `haptic()` fires HA's `haptic` window event, which the HA app turns into phone haptics (it respects Vibrate in the HA profile; nothing in Safari or on a computer).
  - selection: slider tenths, thermostat steps, switching tab or room
  - light: toggles and opening a pop-up
  - medium: slider ends and the Goodnight confirm point
  - success: scenes and Goodnight
  - warning: failed actions
- **Pop-ups behave like iOS sheets.**
  - The handle stays, and the title and close float with no band behind them.
  - Content fades out as it scrolls under them: a mask on `.scroll`. Never paint a layer behind them; the sheet is see-through, so any painted layer shows as a change.
  - Swipe down anywhere while scrolled to the top, or drag the top bar. The dim lightens as it goes, and a quarter of the height or a flick closes it.
  - The top bar's class is `.sheet-top`, because sheets use `.top` for their own rows.

## Preview

- The dev server is `ha-preview` in `.claude/launch.json`, on port 5173. Pages: `dev/index.html` (Home showcase), `room.html`, `bedroom.html`, `office.html`, `energy.html`, `security.html`. They run on mock data in `dev/mock.ts`.
- Mock switches in the URL: `?dark`, `?offline` (the HA-unreachable banner), `?quiet` (sensors gone quiet).
- The dev Home page lays every card out as a showcase; card order on the real dashboard is set in HA.

## Releasing (HACS)

1. Bump `version` in `package.json` and the console banner in `src/index.ts`.
2. Run `npm run build`.
3. Commit as `vX.Y.Z`, tag `vX.Y.Z`, then push `main` and the tag.
4. `gh release create vX.Y.Z dist/ha-glass-dashboard.js --title vX.Y.Z --notes "…"` with short, plain notes.
5. Liam updates in HACS and reloads; the console shows `GLASS DASHBOARD X.Y.Z`. If he asks, you can update it for him through HA's websocket: `hacs/repository/refresh`, then `hacs/repository/download` with the version.

Liam is the only user: release straight from `main`, no betas or pre-releases.

## Git

- Work on `main` unless asked otherwise. One Claude session per folder: two sessions in the same checkout have overwritten each other's work before. Use a worktree for parallel work, and merge or remove it when done.
- End commit messages with the Co-Authored-By line the session gives you.
- Moving `main` forward from another branch needs Liam's explicit OK, even when it's a fast-forward.

## Open decisions

- **Background glows:** every canvas page has soft coloured glows behind it, but the build doesn't (the cards can't paint the page background). Undecided: drop them from the canvas, or add one HA theme background for every page.
