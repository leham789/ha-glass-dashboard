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
- **Say changes in plain words.** Before a change that touches several boards, describe in a sentence or two what he'll see, before and after (a quick picture helps), and get a yes. Never act on a jargon-heavy question he may not have followed: a "yes" to one once merged the Tile row into the Light row and had to be undone.
- **Apply the components rule without being asked.** If a card shows something that looks like an existing part, draw it as that part straight away; don't copy the code's look-alike and ask.
- Keep replies short and plain. Credits matter: keep chats focused, don't dump whole files into the chat, and batch small changes.

Decisions he's made on the canvas (sizes, colours, states, navigation): [docs/design-decisions.md](docs/design-decisions.md). Read it before designing.

## Design canvas

- https://claude.ai/artifact/VRZ7zCC8EHgBGCy5hAT4tP. Pages: **Designs** (screens, pop-ups, and the old Components and Card Library frames), **Design system** (the foundation frames) and **Library**. Liam removed the Dark Mode page on 2026-11-01; each Library board shows dark itself.
- **Library page** (being built): **parts on top** (row at y 0, titled "Parts") and **cards below** (row at y 6700, titled "Cards" at 6400). If a part board grows past about 6000 high, move the cards row down. Every board is `Lib<Name>.dc.html`, 1712px wide, on dummy data taken from the live code, titled "<Name> · part(s)" or "<Name> · card".
- **Part boards** are lighter than card boards: the part in light and dark, then for each part its looks or states, sizes, and a "Used in" line naming the cards that show it; then Build notes. A part that has a setting on its cards (e.g. the Light row's `light_fill`) also gets its choices pictured side by side and a Settings section (HA editor and YAML), as card boards do. Settings always go last, just above Build notes. Draw fields closed, as the card boards do; never an open dropdown. In a `.fact`, wrap text that contains `<code>` in a `<span>`, or each piece lands on its own line. Bigger parts get their own board; small ones share one (`LibChips`, Chips and pills, is the template). All parts now have boards (2026-11-02). The Components frame's Usage card is the Energy today card; its optional Electricity/Gas toggle in place of the title is only on Components (not in the code or the Energy today board), still to decide. When every Components part has a Library board, the Components frame can go.
- **Card boards** have these sections, in order:
  - **Card:** light and dark side by side.
  - **States**, then **Use cases** (only ones that change the look; copy-only differences go in a note), in light, with a `theme` tweak for dark.
  - **Sizes:** narrowest, usual and widest (quarter 79px, half 169px, phone 350px, wide ~500px, as the card allows). Narrow sizes get their own compact layout (cards can measure their width), never the full card squashed.
  - **Settings:** the HA editor fields, drawn as HA draws them, with the same set-up as YAML (HA's code editor) beside them. A list option gets a proper list editor, never a raw YAML field.
  - **Layout:** every example is a label over a preview. In each row the previews line up at the top, however long the labels (`.item` is a subgrid; rows use `.grid` or `.exrow`). Body text is at most 640px wide, including the small note lines ("Used in" and the like); the Build notes box 760px.
  - **Build notes:** numbered, for everything the board is ahead of the code, with "Build note N" tags where it shows.
- **Shared states** (`LibShared`) holds pressed, keyboard focus, can't reach HA, loading, not reporting, the "needs setting up" card and the "can't find its entity" notice once. Card boards leave these out unless their wording differs.
- **Tile** (`LibLightTile`, titled "Tile · part") is the one tile for any single thing: the Tile card (type `glass-light-tile`), Room lights, Brightness's lamps and Favourites all use it (styles tile, small, row; `icon_style` ring or plain). It never shows brightness as a background fill; the Light row (`LibLightRow`) is a separate part and is the only one that does.
- **Chips and pills** (`LibChips`): status chip, info chip, toggle chip, status pill (30, small 26), tag and live badge, colour preset. Status chips, Home header, Room devices, Favourites' pills, Room climate's bands and the notices use them.
- Done so far. Parts: Shared states, Tile, Chips and pills, Buttons and switches (`LibButtons`), Light row (`LibLightRow`), Sheet (`LibSheet`), Menu (`LibMenu`), Room switcher (`LibRoomSwitcher`; only the Room header uses it; whether it should become the dark segmented control's scrolling version is undecided). Brightness slider (`LibBrightnessSlider`; also the Media pop-up's volume; unavailable fades to 50%, which the code and the Brightness board don't all do yet). Slide to confirm (`LibSlideConfirm`; Goodnight only). Numbers and meters (`LibNumbers`), Surfaces and lists (`LibSurfaces`), History chart (`LibHistoryChart`), Media controls (`LibMediaControls`), Colour controls (`LibColourControls`): drafted 2026-11-02 with open questions for Liam in their notes. Cards: Energy today, Temperature by room, Stat tiles, Room lights, Room header, Room climate, Room devices, Room alert, Brightness, Power switches (`LibSwitchRows`), Home header, Status chips, Favourites, Goodnight. Also a new Energy pop-up frame on Designs. **Parts are done; the Components frame can go once Liam has reviewed them.** Then the remaining cards (`LibStatTiles` as the template), then pop-ups. Components and Card Library get retired once the Library covers everything.
- **Still to do, not just the Library:** redo every component and element as a proper master, on the canvas and in the code. Every part on the Components frame (chips, pills, buttons, rows, sheet parts, the menu) gets its own Library board, and every part in the code becomes one element in `src/elements/` that the cards nest, so nothing is a copy.
- **Treat everything as components, the way Liam works.** Each part has one master (its Library board, and one element in the code). Every other place it appears is an instance of that master, nested parts included: Brightness's lamps are the Light tile at `style: small`, not a look-alike. Change the master, then the change goes everywhere it's used, in the same piece of work. If a nested use needs something different, add it to the master (a size, style or option) and use that. Never make a one-off copy or tweak just one instance.
  - On the canvas, frames are still separate files (only `tokens.css` updates everything by itself). So after changing a master, update every board and Designs frame that shows it, or say exactly what's out of step. The canvas format has `<dc-import>` for real nested components; moving shared parts into imported files is worth trying.
  - In the code, nest the real element (e.g. `glass-light-tile` inside Brightness), never a copy of its markup and CSS.
- **Publishing:** copy changed files to `<scratchpad>/stage/project/<name>` and publish with `root` set to `<scratchpad>/stage`. Send `canvas.json` only when boards, pages or heights change, and read it fresh first (Liam moves boards).
- **Never crop a frame.** The canvas does not size frames itself. After a big change to a Library board (a new board, or sections added or removed), measure it. Skip measuring for small edits (wording, one element), since the browser pane opening bothers Liam. To measure: run the dev server, open `/design/measure.html`, run `await measureAll(['LibX.dc.html', …])`, and set each board's `h` in `canvas.json` to the result. Board roots have no height or `min-height`. Phone frames are fixed: make them as tall as their content.
- **Save tokens:** never pull every frame to compare; read only the files you'll change. Reading a file inlines it into the chat.
- **The design system** is the foundation frames on the Design system page (Type, Colour, Spacing, Sizing, Radius, Elevation, Motion, Opacity, Icons), and the Library page (above), which is replacing **Components** and **Card Library**. Anything new goes on the Library page.
- **Spacing is one scale:** 4, 8, 12, 16, 20, 24, 28, 32, 40, 48. Never use a number in between, and don't ask Liam about spacing: snap to the scale.
  - **To do (agreed 2026-11-02):** put the Library review answers (design-decisions, "Library review") onto the boards: Buttons (44 size, icon-only, on dark), Chips (quick colours as a colour preset look; shares the row's width), Surfaces (one shadow, three tile heights, a pill row part), Light row (built on the pill row), History chart, Media and Colour controls, and the Light pop-up's group list as real Light rows. Then the spacing sweep.
  - **To do (agreed 2026-11-02):** one sweep snapping every off-scale gap and padding (10, 14, 6, 18…) on every board and Designs frame to the scale, with build notes for the code. Do it once the Library review questions are done.
- **Everything follows the design system.** Every board and every card takes its colours, type, spacing, sizes, radii, elevation and motion from the foundations (`tokens.css` on the canvas, `src/tokens.ts` in the code). A value that isn't a token yet goes into `src/tokens.ts` first. Raw colours still on boards (light tints, chip circle colours, the live badge) are being moved into tokens as each board is touched. Check a new board against the foundation frames before publishing.
- Frames are `.dc.html`: markup with `{{values}}`, `<sc-if>` and `<sc-for>`, and a `Component extends DCLogic` script whose `renderVals()` fills them. **Tweaks** (`data-props`) show states. A new frame needs an entry in both `boards` and `order` in `canvas.json`.
- **Re-read the live files before publishing.** Other sessions and the canvas page save edits. The page re-encodes `data-props` (`&quot;`), which is harmless. Re-apply your change to what's live; never resend an old copy. If a publish is refused as "haven't viewed the latest version" even though the files you read are current, do a plain `read` of the canvas URL (no `path`), then publish again.
- `design/` mirrors every frame, locally only (gitignored). Copy changed frames there after publishing.
- `quiet_hours` is drawn as a list editor (sensor type or sensor, hours, + Add), not a raw YAML field. Every board with the option shows it this way.
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
