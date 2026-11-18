# Changelog
## 0.1.0 - 2026-11-17
- Reference video analysed; spec in `docs/REFERENCE_ANALYSIS.md`
- Hub server: static hosting, WebSocket relay, pairing codes, resume tokens, rate limiting, QR generation (no dependencies)
- TV dashboard: boot sequence, home screen matching the reference layout, remote/keyboard focus navigation, toast, clock, controller panel with QR + code + player slots
- Phone controller: D-pad, 2 analog sticks, face buttons, L1/L2/R1/R2, Options/Create/Home, sensitivity + vibration settings, auto-reconnect, latency display
- Orb Rush: built-in playable demo (1-4 phones, keyboard, gamepad) with haptic feedback
- Tests: 13 protocol + 12 browser tests
\n## TV remote compatibility fix\n- Added Samsung/Tizen legacy key-code mappings for arrows, OK, Back and media keys.\n- Added click/touch activation for TV interface controls as a fallback.\n- The first remote key can dismiss boot animation and still navigate.\n