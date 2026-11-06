# Design decisions

Decisions Liam has made on the design canvas, so they aren't undone. The canvas frames are the source of truth for exact values. Add new decisions here as they're made, and delete any that change.

## Layout and sizes

- **Phone first.** Pop-ups are 852 high (the iPhone base height) when their content fits. A pop-up is taller only when its content really needs to scroll.
- **Spacing scale:** every gap and padding is one of 4 · 8 · 12 · 16 · 20 · 24 · 28 · 32 · 40 · 48, never a number in between (on the Spacing frame). Snap anything off-scale to it without asking. 12 under every section heading.
- **Spacing:** 8 chip gap · 12 tile grid gap (small tiles too; no 10s) and small-tile padding · 16 tile padding · 20 screen edge, gap between cards and card padding.
- **Radius:** 16 thumbnails and insets · 24 small tiles · 28 tiles · 32 cards · 40 sheets · pills are height ÷ 2.
- **Type:** one size per style (see the Type frame). Section headings and pop-up titles share one Heading style, 20 Regular.
- **Icon buttons:** four styles (Dark, White, Glass, Grey) and four sizes (64 sheet close, 52 default, 40 on tiles, 36 compact).
- **One Tile part** for any single thing (lights, switches, scenes…). The Light tile card is the Tile on its own. The icon sits in a ring by default, or on its own (`icon_style: plain`, Favourites' default).
- **Light tiles** show the brightness under the name in grey, never top right, at every size. Three styles: tile (default), small (97 × 112, also Brightness's lamps) and row (56 high, bulb on the left). At a quarter width (79px) a tile takes the small style by itself; row needs at least half. One part, not copies. Favourites' tiles are this part too (small, and row at half width): nested in another card it takes any entity, with ink for something on that isn't a light and glass for scenes.
- **Light rows are a separate part from the Tile.** The Light row (lists of lights: the Lights pop-up, Room lights) is 64 high with a 32 radius, and shows brightness as a fill with rounded ends. **A Tile never shows brightness as a background**, in any style, its row style included: it's solid (the bulb's tint when on), with the brightness in grey under the name. Decided 2026-11-02, after a merge of the two was tried and undone.

## Screens and navigation

- **Main screens** (reached from the menu) have no close button. Only pop-ups have ×.
- **Behind a pop-up the screen dims darker in both themes**, as on iPhone: black at 50% in dark mode, never a light wash.
- **Menu labels** are one word, on one line ("Energy", not "Heating & Energy").
- **Rooms** opens the last room you viewed. There's no separate all-rooms screen; Home's room tiles are the overview.
- **Room screens** have no back or "…" buttons. A full-width, contained room switcher sits at the top: it scrolls sideways, pinned rooms come first, and there's no divider. The small room name above the big number opens Room options.
- **No "Open in Home Assistant" buttons** on pop-ups or Room options.
- **Security** stacks every camera except the 3D printer's, plus the door states.
- **Room header's big number** is a choice (`show`): lights on (default), temperature, power use, one sensor, or nothing. What it is joins the room name above it ("Study · Power use"), never a line under the number.
- **Favourites** are tiles under a heading, three across with the next one peeking in. Pills stay as a card option.
- **Heating presets** sit inside the dial card as a row of chips, with no "Presets" heading.

## Colour and states

- **Brightness fills and the light's colour.** The Brightness slider (Brightness card and Light pop-up) always follows a light in colour mode: a soft tint to its own colour, otherwise the warm light fill. The Light row is warm by default; the cards that show rows have `light_fill: colour` to make it follow the light's colour (Room lights for its rows, Status chips for the Lights pop-up). In dark mode the colour is see-through, like the light fill. Decided 2026-11-02.
- **Lit light tiles** take a soft tint of the bulb's real colour, with warm white when there's no colour data (option A). Liam may revisit this once he's seen it with live colours.
- **One temperature scale bar:** cold blue to warm orange with a flat green comfort band in the middle (40–60% of the bar), on the Temperature by room rows and the Temperatures pop-up's tiles alike. Decided 2026-11-02.
- **Temperature tiles** tint only at the extremes, faintly (18%) in the top-left corner: blue for Cold (under 16.5°), orange for Warm (over 22°), red for Hot (over 25°). Cool and Comfy stay plain glass with a grey pill. No purple or green.
- **Humidity tiles** get a band pill too: Dry under 40%, Comfy 40–60%, Damp over 60%. No tint. Their scale bar has its own colours to match: sandy (Dry) to green (Comfy, 40–60) to blue (Damp), not the temperature colours. Decided 2026-11-02. Either pill can be switched off in the card's options.
- **Battery icons** follow the charge: full at 70% and up, medium 40–69%, low 15–39%, warning under 15%. Tiles under 40% turn dark.
- **Never say the same thing twice,** and never claim what isn't known. An offline camera's badge says Offline and its motion pill says "Motion unknown", not "Clear". A sensor that's gone quiet never says shut or open ("Was shut").
- **A sensor that's gone quiet says "Not reporting"** on cards, not when it was last heard ("Last heard 3 h ago" stays for its pop-up). Room climate tiles drop their pill when quiet; it doesn't fit a phone-width tile.
- **A device dropping out is grey, not attention.** Attention colours are for things that need doing.
- **No reading is a grey dash; loading is a soft bar.** When HA has no value the number is a short grey dash (the `.nil` mark) and the unit goes; while a value is on its way it's a placeholder bar. Never mix them. Decided 2026-11-02.
- **Loading shows soft placeholder bars,** never a dash or a zero. A number or line that hasn't arrived yet is a rounded bar of the same size, in a faint tint of what's under it; anything already known shows straight away.

## Design system frames

- **Components** holds every part with all its states. Each state hugs its content, with even spacing.
- **Card Library** holds every card with the rule for when it shows. It doesn't repeat parts that live in Components, such as the menu or light rows. Its card containers are plain grey (`#E3E4E8`), in three fixed columns per section, grouped by topic in screen order.

## Library review (2026-11-02)

- **One card shadow** for every glass card (a token), not a tint per card.
- **Tile heights:** only 92, 132 and 176 (the Sizing frame).
- **Cool white is 5500 K** everywhere (Brightness card and Light pop-up).
- **Icon button gets a 44 size and an icon-only look** (shuffle and repeat: just the icon when off, ink when on), and an **"on dark" style** (white, for the dark Media card's play button).
- **History chart** keeps its height (120, small labels) and only stretches wider. Its colour key is part of the chart. The Energy pop-up's bars use the chart part (bars with yesterday's ticks and a fill colour).
- **Quick colours** (Light pop-up) are a swatch-only look of the Colour preset chip. The colour preset shares its row's width.
- **White/Colour tabs** use the segmented control as it is (solid), in pop-ups too.
- **One pill row part** (64 high): Power switches and the Not reporting list use it, and the Light row is the pill row plus its brightness fill.
- **Dropped:** the Usage card's Electricity/Gas toggle (use one Energy today card per fuel), the unused link row, and the blue level bar.

## Still open

- **Backlog: brightness as a fill on the Tile.** An option on the Tile card, for a light with a brightness, to show it as a fill across every style. Hard to make work in rectangular tiles, so not now.

- **Background glows:** every canvas page has soft coloured glows behind it, but the build doesn't, because the cards can't paint the page background. Undecided: drop them from the canvas, or add one HA theme background for every page.
- **Media "Play on":** the wording or a speaker icon on the chips were offered but not decided.
