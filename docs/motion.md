# Motion, haptics and interaction

The canvas **Motion** frame (and its **Motion & haptics** demo) is the spec. `src/motion.ts` holds the shared pieces. The README's "Motion and haptics" section describes it for users.

## Tap anywhere

A card with one main action does it when tapped anywhere. It has a full-card `.open` button, absolutely positioned over a `position: relative` card, with the drawn content set to `pointer-events: none`. Any small icon on it becomes a decorative hint. Cards with several different actions keep separate buttons; rows that open their own thing sit above the `.open` button (`position: relative`). Note the tap behaviour in the Card Library.

## Timing

- One curve: `cubic-bezier(0.2, 0.8, 0.2, 1)`. Nothing bounces.
- Loops run only while something waits; the attention glow stops after 30 s.
- Reduced motion turns everything into plain fades.
- Pages appear at once, with no load-in animation. The bottom menu never moves.
- Pressing shrinks whatever's pressed to 97% (`press()` in `GlassElement`); a full-card `.open` button shrinks its card. `data-no-press` opts out (things you drag).

## The menu

The current page is the dark pill with its name, always 128px wide, so only the icons it jumps over move (equal slots were tried and rejected). The name turns white as the pill arrives.

## Haptics

`haptic()` fires HA's `haptic` window event, which the HA app turns into phone haptics. It respects Vibrate in the HA profile; Safari and computers get nothing.

| Kind | Used for |
| --- | --- |
| selection | slider tenths, thermostat steps, switching tab or room |
| light | toggles, opening a pop-up |
| medium | slider ends, the Goodnight confirm point |
| success | scenes, Goodnight |
| warning | failed actions |

## Pop-ups (iOS sheets)

- The handle stays, and the title and close float with no band behind them. The top bar's class is `.sheet-top`, because sheets use `.top` for their own rows.
- Content fades out as it scrolls under the top bar: a mask on `.scroll`. Never paint a layer behind the bar; the sheet is see-through, so any painted layer shows as a change.
- Swipe down anywhere while scrolled to the top, or drag the top bar. The dim lightens as it goes, and a quarter of the height or a flick closes it.
