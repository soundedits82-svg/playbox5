# Reference video analysis
Source: `PS5_Boot_Screen_In_4K - Press Start Australia (720p h264).mp4`: 1280x720, 60 fps, 32.4 s. Frames inspected at 2 s intervals plus full-resolution frames at 15/17/25 s, so **timings below are estimates (+/-1 s)**. Only the visible content is specified; nothing was invented beyond it.

## Timeline
| t (s) | Scene | PLAYBOX 5 implementation |
|---|---|---|
| 0-7 | Black screen, centred console logo | Original "PLAYBOX 5" wordmark (the platform logo is protected branding and is not copied) |
| 7-11 | Small uppercase photosensitivity warning, centred, faint blue vignette | Same placement, own wording |
| ~12-14 | Dark teal field, drifting golden/teal bokeh particles | Canvas particle system |
| ~14-16 | Soft spotlight cone from top onto a dark scene | CSS gradients |
| 16-26 | Home screen; toast "Logged in to your PS5." (top-right, ~5 s); then toast fades and search/settings/avatar/clock appear | Same sequence |
| 27-32 | Third-party "Press Start" outro | Not part of the UI; ignored |

## Home screen layout (1280x720 reference grid, used 1:1 as the stage)
- Tabs top-left: "Games" (bold, white, x=62) and "Media" (dim, x=193), y~42, 22 px.
- Top-right: search (x~941), settings (x~1011), avatar (x~1080), clock right-aligned at x~1222. PLAYBOX adds a controller icon at x~871.
- Shelf at y=80: store tile 70 px (x=34); selected tile 118 px with rounded light border (x=112); other tiles 70 px, 6-7 px gaps; last tile is a library icon. Selected title sits right of the selected tile at y~175, 18 px.
- Full-bleed key art on the right, dark left-to-right vignette so text stays legible. Background ~#04050c.
- Bottom-left block (x=115): title art (y 375-470), tagline 18 px (y~505), "Play" pill 222x47 and a 48 px "..." circle (y 557-604).

## Not visible in the video (so not claimed)
Focus movement animations, sounds, the Media tab, search/settings/profile screens, game-launch transition, controller menus. Behaviour for these is original and marked "coming soon" where unbuilt.

## Deliberate differences
Proprietary logo, game art, "Spider-Man" assets and the SST typeface are not reused; placeholder art is generated procedurally and the system UI font is used.
