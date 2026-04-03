# Task Queue — Hearth Desktop

Last updated: 2026-04-03
Pipeline: Hearth Desktop PRD Competitive Analysis

## P0 — Critical (Ship Now)

*(No P0 items — text messaging PRDs are already in progress)*

---

## P1 — High (Next Sprint)

### Thread: Screen Sharing (#03_screen_share_system.md)

- [ ] **T-SCREEN-01**: Add `nokhwa` crate to `src-tauri/Cargo.toml` for cross-platform screen capture
- [ ] **T-SCREEN-02**: Implement `enumerate_sources()` Tauri command — list screens + windows
- [ ] **T-SCREEN-03**: Build Source Picker modal UI (Svelte) with thumbnail previews
- [ ] **T-SCREEN-04**: Implement `start_screen_share(sourceId, quality)` Tauri command
- [ ] **T-SCREEN-05**: Hook screen capture into existing WebRTC pipeline (PR #17 MediaStream track)
- [ ] **T-SCREEN-06**: Build ShareTile UI component (floating overlay showing active sharer)
- [ ] **T-SCREEN-07**: Implement quality controls (bitrate, resolution, FPS sliders)
- [ ] **T-SCREEN-08**: Implement `stop_screen_share()` command
- [ ] **T-SCREEN-09**: Test on Linux (X11 + Wayland via xdg-desktop-portal), macOS, Windows

### Thread: Video Calls (#04_video_calls_system.md)

- [ ] **T-VIDEO-01**: Add camera capture to existing WebRTC pipeline (extend PR #17)
- [ ] **T-VIDEO-02**: Implement `enumerate_cameras()` via browser `navigator.mediaDevices`
- [ ] **T-VIDEO-03**: Build camera picker dropdown UI with preview
- [ ] **T-VIDEO-04**: Implement `start_video(cameraId)` / `stop_video()` commands
- [ ] **T-VIDEO-05**: Build VideoGrid UI (1-tile, 2×2, 3×3, 4-col scrollable)
- [ ] **T-VIDEO-06**: Add speaking indicator overlay to video tiles
- [ ] **T-VIDEO-07**: Implement adaptive video quality (scale resolution/FPS by participant count)
- [ ] **T-VIDEO-08**: Integrate video toggle button into voice channel UI
- [ ] **T-VIDEO-09**: Test WebRTC video with 4+ simultaneous participants

### Thread: Message Threads (#05_message_threads_system.md)

- [ ] **T-THREAD-01**: Define Thread + ThreadMember data models in TypeScript
- [ ] **T-THREAD-02**: Add thread API client methods (`createThread`, `listThreads`, `getThreadMessages`)
- [ ] **T-THREAD-03**: Build Thread Pillar sidebar component
- [ ] **T-THREAD-04**: Build "Start thread" button (appears on message hover)
- [ ] **T-THREAD-05**: Build Thread view (separate message list + input)
- [ ] **T-THREAD-06**: Implement thread archive/unarchive
- [ ] **T-THREAD-07**: Implement auto-archive timer logic
- [ ] **T-THREAD-08**: Thread join/leave + notification preference toggle
- [ ] **T-THREAD-09**: Thread unread badge indicators
- [ ] **T-THREAD-10**: Integration test with real Hearth API thread endpoints

### Thread: Audio Processing Pipeline (#07_audio_processing_pipeline.md)

- [ ] **T-AUDIO-01**: Add noise suppression WebAudio Worklet + WASM model (Sony DNN or RNNoise)
- [ ] **T-AUDIO-02**: Implement `VoiceProcessingPipeline` class chaining mic → denoise → AEC → AGC → encoder
- [ ] **T-AUDIO-03**: Integrate `AcousticEchoCanceller` and `GainNode` AGC via Web Audio API
- [ ] **T-AUDIO-04**: Build audio settings panel (preset selector: Voice/Music/Accessibility, toggle switches)
- [ ] **T-AUDIO-05**: Add audio level meter component for input monitoring
- [ ] **T-AUDIO-06**: Per-channel voice settings override persistence via `tauri-plugin-store`
- [ ] **T-AUDIO-07**: CPU profiling + optimization — target <15% CPU on i5-8250U / M1 during 4-person call
- [ ] **T-AUDIO-08**: Browser compatibility test (Chrome, Firefox, Safari, Edge)

### Thread: Message Search (#08_message_search_discovery.md)

- [ ] **T-SEARCH-01**: Add `rusqlite` with FTS5 to `src-tauri/Cargo.toml`
- [ ] **T-SEARCH-02**: Implement Rust commands: `search_messages(query, filters)`, `index_message(msg)`, `rebuild_index()`
- [ ] **T-SEARCH-03**: Build `QueryParser` for filter tokens (`from:`, `in:`, `has:`, `during:`)
- [ ] **T-SEARCH-04**: Build `SearchModal.svelte` with filter token input + results list
- [ ] **T-SEARCH-05**: Implement search result click → navigate to message in context
- [ ] **T-SEARCH-06**: Add search history (last 10 queries) via `tauri-plugin-store`
- [ ] **T-SEARCH-07**: Background indexing queue — index new messages within 60s of receipt
- [ ] **T-SEARCH-08**: LRU eviction for index — cap at 500K messages per server
- [ ] **T-SEARCH-09**: `Ctrl/Cmd+F` global shortcut binding to open search modal

### Thread: Rich Media Embeds (#09_rich_media_embeds.md)

- [ ] **T-EMBED-01**: Build `LinkPreviewFetcher` — expand short URLs, fetch HTML, parse OG/Twitter Card meta
- [ ] **T-EMBED-02**: Build `LinkPreview.svelte` — rich card component (title, description, thumbnail, site name)
- [ ] **T-EMBED-03**: Add per-URL-type embed handlers: YouTube, GitHub, Twitch, Twitter/X, Spotify, SoundCloud
- [ ] **T-EMBED-04**: Build `ImageEmbed.svelte` — inline image display with lazy-load + lightbox
- [ ] **T-EMBED-05**: Build `VideoEmbed.svelte` — inline video player (YouTube/native)
- [ ] **T-EMBED-06**: Build `AudioEmbed.svelte` — music service preview cards
- [ ] **T-EMBED-07**: Implement media cache (disk-based LRU, default 500MB limit)
- [ ] **T-EMBED-08**: Add "Disable link preview" per-message toggle in compose box
- [ ] **T-EMBED-09**: NSFW image blur with click-to-reveal overlay

---

## P2 — Medium (Future)

- [ ] **T-P2-01**: Screenshot capture standalone feature (screenshot hotkey → share to channel)
- [ ] **T-P2-02**: Custom status messages (online/idle/dnd/custom)
- [ ] **T-P2-03**: Per-channel notification sounds
- [ ] **T-P2-04**: Keyboard shortcut customization UI
- [ ] **T-P2-05**: Background blur for video (TensorFlow.js WASM / MediaPipe)
- [ ] **T-P2-06**: Rich text editor (markdown toolbar, emoji picker)


---

## Notes

- All P1 tasks depend on PRD #1 (text messaging) being stable
- Screen share and video call both extend the WebRTC pipeline from PR #17 — coordinate to avoid conflicts
- Thread UI (T-THREAD-03, T-THREAD-05) needs design spec from Hearth design team
