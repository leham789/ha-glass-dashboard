# Home Assistant notes

How the cards talk to Home Assistant, and quirks worth knowing.

## The dashboard

- **Kiosk Mode** (HACS) hides HA's top bar on the dashboard (`kiosk_mode: hide_header: true` in its config). To edit on a computer, add `?disable_km` to the address.
- Opening a dashboard by its bare address (as the phone app does) shows its first page. Code that works out "which page am I on" must treat that as Home.
- HA freezes for about 0.8 s while it builds a page after navigating. Only transform and opacity animations keep running through that.

## Sensors

- The frontend's `hass` doesn't include `last_reported`. For when a sensor was last heard, the cards use the device's Zigbee2MQTT **Last seen** sensor (`sensor.*_last_seen`), then `last_updated`. HA's own times reset when HA restarts. See the README's "Sensors that stop reporting".

## Cameras (UniFi Protect)

- Live video uses HA's WebRTC (`camera/webrtc/offer` and `camera/webrtc/candidate`), falling back to HLS, then refreshed stills.
- Detection snapshots come from `/api/unifiprotect/thumbnail/<config entry>/<event id>`, signed with `auth/sign_path`.

## HACS

- Refresh and update a repository over the websocket with `hacs/repository/refresh`, then `hacs/repository/download`. See [releasing.md](releasing.md).
