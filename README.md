# Glass Dashboard

A frosted-glass, mobile-first card pack for Home Assistant. Every card has a visual editor, so nothing needs YAML.

> Early days: more cards are on the way.

## Cards

### Status chips · `custom:glass-status-chips`

One scrolling row of chips that sum up the house:

- **an open door or window** (first, in peach, only while something is open). It opens your Security view.
- **lights on**. It opens the **Lights** pop-up: how many are on, *All off* (then *Undo*), On / All / Offline filters, and every light by room. Tap a light to switch it.
- **room temperatures**, from coldest to warmest room ("Rooms 15–23°"). It opens **Room temperatures**:
  - the house average, and the weather outside
  - a tile per room, sorted by room or coldest or warmest, with a Cold / Cool / Comfy / Warm / Hot pill and a humidity scale
  - only Cold, Warm and Hot rooms get a faint coloured corner
- **low batteries**: any battery under 40%. It opens **Batteries**: every battery from lowest up, with an icon that shows the charge. Tiles under 40% turn dark, and phones are listed separately.

```yaml
type: custom:glass-status-chips
security_path: /glass/security   # optional
energy_path: /glass/energy       # optional, linked from Room temperatures
exclude_areas: [server_room]     # optional
```

### Menu · `custom:glass-menu`

The bottom menu: Home, Rooms, Energy and Security. The screen you're on is the dark pill with its name, and the others are icons. It floats over the bottom of the screen. Any view in the same dashboard that isn't Home, Energy or Security counts as a room, and **Rooms** reopens the last room you viewed on that device. Leave out a path to hide that item.

```yaml
type: custom:glass-menu
home_path: /glass/home
rooms_path: /glass/living_room
energy_path: /glass/energy
security_path: /glass/security
```

### Rooms · `custom:glass-rooms`

Every area in your home as a room tile, grouped by floor with a Down / Up / Outside style switcher. It reads your Home Assistant areas and floors, so new rooms appear on their own. There's nothing to set up.

```yaml
type: custom:glass-rooms
exclude_areas: [server_room]   # optional
room_path: /glass/{area}       # optional: open a view per room
```

### Room tile · `custom:glass-room-tile`

One area on its own. It shows:

- how many of its lights are on ("4 of 6"), with a dot per light
- one line of context: an open door or window first (the tile turns peach), otherwise the temperature and humidity, then a door, media player or motion sensor
- a bulb button that turns all the room's lights off, or all on

A light group (such as a Hue room) isn't counted twice when its lights are in the room too. For the temperature, the tile uses the sensor chosen for the area in **Settings › Areas**. If none is chosen, it uses the room's own climate sensor, not one built into another device such as a 3D printer.

```yaml
type: custom:glass-room-tile
area: living_room
navigation_path: /glass/living   # optional
exclude_entities: [light.p1s_chamber_light]  # optional
```

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

Icons are from [Lucide](https://lucide.dev) (ISC licence). The font is [Outfit](https://fonts.google.com/specimen/Outfit) (SIL Open Font License). It's bundled into the pack, so nothing is loaded from Google.
