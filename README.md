# Glass Dashboard

A frosted-glass, mobile-first card pack for Home Assistant. Every card has a visual editor, so nothing needs YAML.

> Early days: more cards are on the way.

## Cards

### Home header · `custom:glass-home-header`

The top of Home. It has today's date, "Good evening, Alex" and your avatar with a dot that's green when you're home. Below that, one room's temperature is the big number (the decimal is greyed), with chips for the room, the temperature outside and the humidity.

```yaml
type: custom:glass-home-header
area: living_room        # optional, default the first room with a sensor
person: person.alex      # optional, default the signed-in user
```

### Favourites · `custom:glass-favourites`

A row of chips for the things you reach for most, dark while on. Tap to switch them, or to run a scene or script. Hold for Home Assistant's own controls.

```yaml
type: custom:glass-favourites
entities: [light.living_room_hue, light.living_room_bookshelf, scene.relax]
```

### Heating & Energy tiles · `custom:glass-energy-tiles`

Two tiles side by side:

- **Heating:** what the thermostat is set to, how warm the room is and what it's doing.
- **Energy:** power right now, a dot chart of the last 12 hours (from Home Assistant's history) and what today has cost.

```yaml
type: custom:glass-energy-tiles
climate: climate.living_room
power: sensor.house_power
cost_entities: [sensor.electricity_cost_today, sensor.gas_cost_today]   # optional
cost_label: elec + gas                                                  # optional
navigation_path: /glass/energy                                          # optional
```

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

### Goodnight · `custom:glass-goodnight`

A late-evening card. It appears between 22:00 and 05:00 while lights are still on in the chosen rooms or a door is open, and stays hidden otherwise. **Slide** the green knob across to switch those lights off, or to run your own script instead. The card then says it's done and mentions any door that's still open. **Tap the tick** to put the lights back on.

By default it covers your lowest floor. Pick rooms, a script and the times in its editor. A keyboard press on the knob also confirms.

```yaml
type: custom:glass-goodnight
areas: [living_room, hallway, kitchen, office]   # optional
script: script.goodnight                         # optional
show_after: "22:00"                              # optional
show_until: "05:00"                              # optional
```

### Now playing · `custom:glass-now-playing`

Only appears while something is playing or paused, and shows the most recent player. It has the artwork, where it's playing ("Apple TV · Plex · Living Room"), the title, a progress bar and play/pause. Tap the card to open that room's view, or Home Assistant's player controls.

```yaml
type: custom:glass-now-playing
entities: [media_player.living_room_apple_tv, media_player.sonos_living_room]  # optional, default all
room_path: /glass/{area}                                                       # optional
```

### Around the house · `custom:glass-around`

Things that only matter for a while:

- **Bins** show from two days before collection until noon on the day. The tile has the day, a coloured dot per bin, "2 days / Tomorrow / Today", and when the next other bin is due. It works with one Waste Collection Schedule sensor per bin, or one sensor with the upcoming dates.
- **3D printer** shows while printing (progress, time left, print name) and for two hours after ("Done").

The two tiles share the row. One on its own spans the row, and with neither the card hides.

```yaml
type: custom:glass-around
bins: [sensor.green_bin, sensor.red_bin, sensor.grey_bin, sensor.blue_bin]
printer_status: sensor.p1s_print_status
printer_progress: sensor.p1s_print_progress
printer_remaining: sensor.p1s_remaining_time
printer_task: sensor.p1s_task_name
printer_name: P1S
printer_path: /glass/office   # optional
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

## Room screen cards

Put these on one view per room. The room header's switcher moves between them.

### Room header · `custom:glass-room-header`

A full-width switcher of every room: pinned ones first, then the rest. It scrolls sideways and fades at the edge. Below it are the room's name, a big "4/6 on", its temperature and humidity, and what's on ("TV on · Apple TV playing").

```yaml
type: custom:glass-room-header
area: living_room
room_path: /glass/{area}
pinned: [living_room, bedroom, office]   # optional
```

### Brightness · `custom:glass-brightness`

A big slider for a light or group (drag to 0 to switch off), with Warm / Neutral / Cool / Colour presets for lights that support them. Colour opens Home Assistant's colour picker.

```yaml
type: custom:glass-brightness
entity: light.living_room_hue
```

### Room lights · `custom:glass-room-lights`

Every light in the room as a light tile, two across. New lights appear on their own.

```yaml
type: custom:glass-room-lights
area: living_room
exclude_entities: [light.p1s_chamber_light]   # optional
```

### Scenes · `custom:glass-scenes`

Scene tiles three across, coloured by name (Energise, Read, Relax, Nightlight…). The one you ran last is ringed. Words every scene shares, such as the room's name, are dropped.

```yaml
type: custom:glass-scenes
title: Hue scenes
entities: [scene.living_room_energise, scene.living_room_read, scene.living_room_relax]
```

### Thermostat row · `custom:glass-thermostat-row`

A room's heating target with − and + buttons. Quick taps are sent together.

```yaml
type: custom:glass-thermostat-row
entity: climate.living_room
```

### Media · `custom:glass-media`

A room's player with play/pause, and its other devices as buttons ("TV · On", "PS5 · Off"). Dark for a TV, light for music.

```yaml
type: custom:glass-media
entity: media_player.living_room_apple_tv
buttons: [media_player.living_room_tv, media_player.living_room_ps5]
style: dark   # or light
```

## Security screen cards

### Doors · `custom:glass-doors`

A tile per door: peach while open with how long ("Open for 12 min"), glass when shut ("Shut since 18:05"). Give it a title and it heads the screen, with one pill for the whole house ("1 door open" / "All doors shut"). With no entities chosen it shows every door and window sensor.

```yaml
type: custom:glass-doors
title: Security
entities: [binary_sensor.front_door_contact, binary_sensor.back_door_contact]   # optional
```

### Camera · `custom:glass-camera`

A camera picture that refreshes every 10 seconds, with a Recording / Live badge and an expand button for Home Assistant's live view. Underneath are its name, when it last saw motion and when the doorbell last rang, and a Motion / Clear pill. Stack one per camera.

```yaml
type: custom:glass-camera
entity: camera.doorbell
motion_entity: binary_sensor.doorbell_motion   # optional
ding_entity: binary_sensor.doorbell_ding       # optional
heading: Cameras                               # optional, on the first one
```

## Building blocks

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
