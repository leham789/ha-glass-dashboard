# Design decisions

Decisions Liam has made on the design canvas, so they aren't undone. The canvas frames are the source of truth for exact values. Add new decisions here as they're made, and delete any that change.

## Layout and sizes

- **Phone first.** Pop-ups are 852 high (the iPhone base height) when their content fits. A pop-up is taller only when its content really needs to scroll.
- **Spacing:** 8 chip gap · 12 tile grid gap and small-tile padding · 16 tile padding · 20 screen edge, gap between cards and card padding.
- **Radius:** 16 thumbnails and insets · 24 small tiles · 28 tiles · 32 cards · 40 sheets · pills are height ÷ 2.
- **Type:** one size per style (see the Type frame). Section headings and pop-up titles share one Heading style, 20 Regular.
- **Icon buttons:** four styles (Dark, White, Glass, Grey) and four sizes (64 sheet close, 52 default, 40 on tiles, 36 compact).
- **Light rows** are 64 high with a 32 radius, and their brightness fill has rounded ends.

## Screens and navigation

- **Main screens** (reached from the menu) have no close button. Only pop-ups have ×.
- **Menu labels** are one word, on one line ("Energy", not "Heating & Energy").
- **Rooms** opens the last room you viewed. There's no separate all-rooms screen; Home's room tiles are the overview.
- **Room screens** have no back or "…" buttons. A full-width, contained room switcher sits at the top: it scrolls sideways, pinned rooms come first, and there's no divider. The small room name above the big number opens Room options.
- **No "Open in Home Assistant" buttons** on pop-ups or Room options.
- **Security** stacks every camera except the 3D printer's, plus the door states.
- **Favourites** are tiles under a heading, three across with the next one peeking in. Pills stay as a card option.
- **Heating presets** sit inside the dial card as a row of chips, with no "Presets" heading.

## Colour and states

- **Lit light tiles** take a soft tint of the bulb's real colour, with warm white when there's no colour data (option A). Liam may revisit this once he's seen it with live colours.
- **Temperature tiles** tint only at the extremes, faintly (18%) in the top-left corner: blue for Cold (under 16.5°), orange for Warm (over 22°), red for Hot (over 25°). Cool and Comfy stay plain glass with a grey pill. No purple or green.
- **Battery icons** follow the charge: full at 70% and up, medium 40–69%, low 15–39%, warning under 15%. Tiles under 40% turn dark.
- **Never say the same thing twice,** and never claim what isn't known. An offline camera's badge says Offline and its motion pill says "Motion unknown", not "Clear". A sensor that's gone quiet never says shut or open ("Was shut").
- **A device dropping out is grey, not attention.** Attention colours are for things that need doing.

## Design system frames

- **Components** holds every part with all its states. Each state hugs its content, with even spacing.
- **Card Library** holds every card with the rule for when it shows. It doesn't repeat parts that live in Components, such as the menu or light rows. Its card containers are plain grey (`#E3E4E8`), in three fixed columns per section, grouped by topic in screen order.

## Still open

- **Background glows:** every canvas page has soft coloured glows behind it, but the build doesn't, because the cards can't paint the page background. Undecided: drop them from the canvas, or add one HA theme background for every page.
- **Media "Play on":** the wording or a speaker icon on the chips were offered but not decided.
