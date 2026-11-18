# TODO (priority order)
- [ ] **P0** Android TV shell (Kotlin, WebView) + run on Android TV emulator; verify real remote key codes (DPAD, Back = keyCode 4)
- [ ] **P0** Test pad on a real Android phone and an iPhone over real Wi-Fi (latency, multi-touch, landscape, fullscreen)
- [ ] **P1** Game library data model (SQLite), import flow for user-owned files, organise by platform, last-played, save info
- [ ] **P1** Emulator host interface + first libretro core (retro 8/16-bit) with controller mapping, save states, settings
- [ ] **P1** User profiles screen, settings screen (resolution/performance/controllers), search
- [ ] **P2** Store: catalogue of open-source / public-domain / official-API games, detail pages, install/import
- [ ] **P2** Customisable pad layouts, stick as menu navigation, key-repeat when holding D-pad
- [ ] **P2** Session expiry/cleanup on hub, optional TLS, PS Remote Play research
- [ ] **P3** Media tab, screenshots, error-reporting UI, 4K asset pipeline
## Known limitations
- iPhone Safari has no vibration API (haptics Android-only); pad needs a modern browser with Pointer Events
- WebSocket server handles unfragmented text frames only (what browsers send)
- Store, Library, Search, Settings, Profiles, Media are shown as "coming soon" (no fake buttons)
