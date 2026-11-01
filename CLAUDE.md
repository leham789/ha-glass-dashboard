# Glass Dashboard

A frosted-glass, phone-first Home Assistant dashboard: a pack of custom Lovelace cards and pop-ups (Lit 3, TypeScript, Vite), installed through HACS from GitHub releases.

**Keep this file current.** When you learn a new rule, gotcha or decision, add it before you finish. Put rules and gotchas here. Put reference detail that's only needed sometimes in `docs/` or the README, with a one-line pointer here. Delete anything that's no longer true: stale rules are worse than missing ones.

## How Liam works

- **Design first, then build.** New ideas go on the design canvas first. Code only when he asks.
- **The design always matches the build.** The canvas shows exactly what the cards render. Change both in the same piece of work, or say clearly what's out of step.
- **Design only what Home Assistant can do.** No buttons that do nothing.
- **Light and dark both work** for everything.
- **Loading is soft placeholder bars,** never a dash or zero (details in design-decisions).
- **Commit only when asked.** Confirm before publishing a release; releases are public.
- **His own dashboard comes first, a shareable pack second.** Every card has a visual editor and no hardcoded entities, uses only stable HA frontend APIs, and adds no third-party runtime dependencies.
- **It should feel like a native iPhone app** (iOS 26 is the reference). When unsure how something should behave, check what Apple does.
- **Approval prompts annoy him.** Don't drive HA in the browser to test every change: test in the preview, release, and tell him what to look at. Check in HA when he asks, or when only real data can show it.
- **This repo is public.** Nothing that describes his home goes into it, this file and `docs/` included: no entity IDs, rooms or devices. `design/` and `.claude/` stay gitignored.
- Keep replies short and plain. Credits matter: keep chats focused, don't dump whole files into the chat, and batch small changes.

Decisions he's made on the canvas (sizes, colours, states, navigation): [docs/design-decisions.md](docs/design-decisions.md). Read it before designing.

## Design canvas

- https://claude.ai/artifact/VRZ7zCC8EHgBGCy5hAT4tP. Pages: **Designs** and **Dark Mode** (wrappers that import a frame with `theme="Dark"`).
- **Library page** (being built): one board per component, `Lib<Name>.dc.html`, 1712px wide, on dummy data taken from the live code. Sections in order:
  - **Card:** light and dark side by side.
  - **States**, then **Use cases** (only ones that change the look; copy-only differences go in a note), in light, with a `theme` tweak for dark.
  - **Sizes:** narrowest, usual and widest (quarter 79px, half 169px, phone 350px, wide ~500px, as the card allows). Narrow sizes get their own compact layout (cards can measure their width), never the full card squashed.
  - **Settings:** the HA editor fields, drawn as HA draws them.
  - **Build notes:** numbered, for everything the board is ahead of the code, with "Build note N" tags where it shows.
- **Shared states** (`LibShared`) holds pressed, keyboard focus, can't reach HA, loading, not reporting and the "needs setting up" card once. Card boards leave these out unless their wording differs.
- Done so far: Energy today, Light tile, Temperature by room, Shared states, plus a new Energy pop-up frame on Designs. Next: the remaining cards, then pop-ups, then shared parts. Components and Card Library get retired once the Library covers everything.
- **Frames are copies, not linked components.** Changing a Library board doesn't update the Designs screens; update both, or note what's out of step. Shared `tokens.css` (colours, radii, spacing, font family) does update everything.
- **Publishing:** copy changed files to `<scratchpad>/stage/project/<name>` and publish with `root` set to `<scratchpad>/stage`. Send `canvas.json` only when boards, pages or heights change, and read it fresh first (Liam moves boards).
- **Never crop a frame.** The canvas does not size frames itself. After changing a Library board, measure it: run the dev server, open `/design/measure.html`, run `await measureAll(['LibX.dc.html', …])`, and set each board's `h` in `canvas.json` to the result. Board roots have no height or `min-height`. Phone frames are fixed: make them as tall as their content.
- **Save tokens:** never pull every frame to compare; read only the files you'll change. Reading a file inlines it into the chat.
- **The design system** is the foundation frames (Type, Colour, Spacing, Sizing, Radius, Elevation, Motion, Opacity, Icons), and the Library page (above), which is replacing **Components** and **Card Library**. Anything new goes on the Library page.
- Frames are `.dc.html`: markup with `{{values}}`, `<sc-if>` and `<sc-for>`, and a `Component extends DCLogic` script whose `renderVals()` fills them. **Tweaks** (`data-props`) show states. A new frame needs an entry in both `boards` and `order` in `canvas.json`.
- **Re-read the live files before publishing.** Other sessions and the canvas page save edits. The page re-encodes `data-props` (`&quot;`), which is harmless. Re-apply your change to what's live; never resend an old copy.
- `design/` mirrors every frame, locally only (gitignored). Copy changed frames there after publishing.
- Icons come only from `src/icons.ts` (Lucide). Use the same paths on the canvas.
- **Comments:** make the change, publish, reply in the thread, and write one short line in the chat. Don't resolve threads; Liam does. The canvas belongs to Liam's other Claude account: if a session can't reply in threads, make the change and say so in the chat.

## Home Assistant

- `http://homeassistant.local:8123`, dashboard at `/glass-dashboard`. **Liam signs in himself; never type HA passwords.** Once he's signed in, you may read and edit HA.
- Opening the dashboard by its bare address shows its first page. "Which page am I on" code must treat that as Home.
- **HA freezes for about 0.8 s** while it builds a page. Anything that animates across a page change must use only transform and opacity.
- Sensors are mostly Zigbee2MQTT. They drop out and keep a stale value, which is why "Not reporting" exists. `hass` has no `last_reported`, so "last heard" uses the device's Last seen sensor, then `last_updated`.
- More (Kiosk Mode, cameras, websocket calls): [docs/home-assistant.md](docs/home-assistant.md).

## Code

- `npm run build` writes `dist/ha-glass-dashboard.js` and `design/tokens.css`; `npx tsc --noEmit` type-checks. No Prettier config: match the existing style (single quotes, 2 spaces), and don't run Prettier.
- `src/tokens.ts` is the only place colours, sizes and radii live; the canvas uses the exported `design/tokens.css`.
- `GlassElement` (`src/glass-element.ts`) is the base for every card and sheet. It handles dark mode, the offline fade and banner, a 5-minute redraw, `quiet_hours`, and press.
- **Most cards skip renders** with `shouldUpdate` unless their own entities changed. Anything time-based needs the 5-minute tick or its own check.
- **Pop-ups:** `openMoreInfo()` routes to our sheets (`src/sheets/`, registered in `entity-sheets.ts`), and anything else falls back to HA's dialog. The sheet top bar is `.sheet-top`, because sheets use `.top` for their own rows.
- `src/stale.ts` decides "not reporting": default hours by sensor type, raised with `quiet_hours`. Quiet readings stay greyed, are left out of averages, and a quiet door never says open or shut.
- **Every card option goes in the card's editor and in the README.**
- Motion, haptics, tap-anywhere and sheet gestures: [docs/motion.md](docs/motion.md). In short: one curve, nothing bounces, pages appear at once, and the menu never moves.

## Preview

- Dev server `ha-preview` (`.claude/launch.json`), port 5173. Pages in `dev/`: `index`, `room`, `bedroom`, `office`, `energy` and `security` (`.html`), all on mock data from `dev/mock.ts`.
- URL switches: `?dark`, `?offline` (the HA-unreachable banner), `?quiet` (sensors gone quiet).
- The dev Home page is a showcase of every card; card order on the real dashboard is set in HA.

## Releasing

Steps, HACS updates and the phone app's cache: [docs/releasing.md](docs/releasing.md). Release straight from `main`.

## Git

- Work on `main` unless asked. **One Claude session per folder:** two sessions in the same checkout have overwritten each other's work before. Use a worktree for parallel work, and merge or remove it when done.
- Moving `main` forward from another branch needs Liam's explicit OK, even when it's a fast-forward.
- End commit messages with the Co-Authored-By line the session gives you.
