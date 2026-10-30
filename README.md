# Glass Dashboard

A frosted-glass, mobile-first card pack for Home Assistant. Every card has a visual editor, so nothing needs YAML.

> Early days: this release has one card. More are on the way.

## Cards

### Light tile · `custom:glass-light-tile`

One light. Its tile shows the light's real colour:

- a colour bulb shows its own colour, softened
- a white bulb shows warm white (under 4000K) or cool white (4000K and up)
- anything else that's on is soft yellow
- off is pale glass; an unavailable light fades out and can't be tapped

The corner shows the brightness, or "3 on · 78%" for a light group. **Tap** to toggle, **hold** to open Home Assistant's own light controls.

```yaml
type: custom:glass-light-tile
entity: light.office
name: Office        # optional
icon: lamp          # optional, any icon from the pack
```

## Install

### HACS (recommended)

1. In HACS, open the **⋮** menu and choose **Custom repositories**.
2. Add `https://github.com/leham789/ha-glass-dashboard` with the type **Dashboard**.
3. Find **Glass Dashboard** in HACS, download it, then reload your browser.
4. Edit a dashboard, choose **Add card** and search for **Glass**.

### Manual

Download `ha-glass-dashboard.js` from the latest release, put it in `/config/www/`, and add it as a dashboard resource: `/local/ha-glass-dashboard.js`, type **JavaScript module**.

## Theming

Every colour, radius and size is a CSS variable starting with `--glass-`, so you can override them from a Home Assistant theme. For example:

```yaml
glass-light-default: "#FFE8A3"
glass-radius-tile: 24px
```

## Development

```bash
npm install
npm run dev     # preview the cards with mock data at /dev/index.html
npm run build   # writes dist/ha-glass-dashboard.js
```

## Credits

Icons are from [Lucide](https://lucide.dev) (ISC licence). The font is [Outfit](https://fonts.google.com/specimen/Outfit) (SIL Open Font License).
