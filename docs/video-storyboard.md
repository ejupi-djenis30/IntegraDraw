# IntegraDraw demo capture plan

The repository ships a 10-second portfolio cut at `web/public/integradraw-demo.mp4`. It uses real desktop and mobile browser captures at 1280×720, H.264, 24 fps. The longer two-video plan below remains the guide for future editorial cuts. Keep browser chrome out of frame and do not add narration unless captions are also included.

## Demo A — numerical methods, desktop

Target 45–55 seconds at 1920×1080.

### Capture states

| Time | State | Action | On-screen point |
| --- | --- | --- | --- |
| 00:00–00:05 | Hero at page load | Hold, then scroll | “See an integral take shape.” |
| 00:05–00:14 | Bell curve preset, `[-3, 3]`, 8 segments | Drag segments from 8 to 48 | Both methods converge while the geometry stays readable. |
| 00:14–00:23 | Quadratic preset | Change the upper bound from `2.5` to `3.5` | Signed interval and errors update immediately. |
| 00:23–00:32 | Damped preset | Zoom in twice, then reset | Plot controls work without changing the integral interval. |
| 00:32–00:41 | Formula field | Enter `sin(x) + x/3` | Parser, curve and result cards react to a custom expression. |
| 00:41–00:48 | Invalid formula | Briefly enter `sin(`, then restore the formula | Validation is explicit and recovery is immediate. |
| 00:48–00:55 | Build notes and credits | Scroll to the project record | Show the collaborative origin and preserved attribution. |

## Demo B — responsive workbench, mobile

Target 22–28 seconds at 390×844. Record a real narrow viewport rather than scaling down the desktop capture.

| Time | State | Action | On-screen point |
| --- | --- | --- | --- |
| 00:00–00:04 | Mobile hero | Hold, then tap “Open the workbench” | The project story remains legible without a desktop navigation bar. |
| 00:04–00:10 | Bell curve preset | Scroll through the controls and graph | Inputs, plot and results form one clear vertical flow. |
| 00:10–00:17 | Sine preset | Tap “Sine”, then move the segment slider | Touch controls update the curve and both approximations immediately. |
| 00:17–00:22 | Graph | Use the zoom controls, then reset | The Canvas stays inside the viewport and retains its detail. |
| 00:22–00:28 | Results | Hold on the three result cards | Midpoint, trapezoidal and reference values remain readable at phone width. |

## Stable preset values

- Opening: `exp(-x^2)`, lower `-3`, upper `3`, segments `24`.
- Convergence: same formula, segments `8 → 48`.
- Custom expression: `sin(x) + x/3`, lower `-4`, upper `4`, segments `32`.
- Final still: use `web/public/poster.svg` as the thumbnail and end card.

## Capture checklist

- Hide cursor between interactions.
- Record Demo A at 1920×1080 and Demo B at 390×844.
- Keep reduced-motion disabled for the main capture, but verify it independently.
- Do not claim an “exact” integral: the third result is explicitly a high-resolution Simpson reference.
- Add concise English captions for every state change.
