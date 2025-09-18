# Global Audio Player Systems

## Overview
The DSALearningApp ships with a reusable, app-wide audio stack composed of two complementary experiences:
- **Overlay Player** – a full-screen modal built on top of `react-h5-audio-player` for immersive playback with rich metadata and keyboard shortcuts.
- **Header Mini Player** – a compact controller that lives in the primary header and keeps playback controls accessible while the user navigates the app. It shines because it is minimal yet powerful, including an inline playback-speed cycler the team loves.

Both players are orchestrated by a shared context (`GlobalAudioPlayerContext`) and a custom hook (`useGlobalAudioPlayer`). The hook centralises lifecycle management, decodes/streams audio files provided by the Tauri backend, and keeps UI modes in sync so the two shells never fight over state. Copying this trio of hook + context + two UI shells lets you bring the same behaviour into another project with minimal refactoring.

## Core Modules
### `useGlobalAudioPlayer` hook (`src/hooks/useGlobalAudioPlayer.ts`)
- Defines the canonical `AudioPlayerState` shape: `{ isOpen, uiMode: 'overlay' | 'header', isPlaying, isLoading, currentTime, duration, volume, playbackRate, error }`.
- Maintains the currently loaded recording (`currentRecording`) and a ref to the active `<audio>` element so both players can manipulate the same element.
- Exposes the public API consumed across the app:
  - `playRecording(recording)` – resolves a streamable file URL via Tauri (`resolve_recording_absolute_path`) and falls back to a base64 data URI (`get_audio_data`) when needed. On success it opens the player in `header` mode with fresh state.
  - `closePlayer()` – stops playback, resets state, and clears the current recording.
  - Mutators: `setPlaybackRate`, `setVolume`, `setCurrentTime`, `setUIMode`, `updatePlayerState`, `setAudioElementRef`.
- Persists `playbackRate` and other fields in React state so both UI shells render consistent status.

### `GlobalAudioPlayerContext` provider (`src/contexts/GlobalAudioPlayerContext.tsx`)
- Instantiates the hook once at the root, exposing the API through React context (`useGlobalAudioPlayerContext`).
- Renders the overlay player only when `playerState.isOpen && playerState.uiMode === 'overlay'`, letting the header mini player own the default experience while still supporting an expanded view.
- Wraps the entire app tree (`src/App.tsx`) so any component – e.g. `RecordingHistory` – can request playback.

### Overlay Player (`src/components/GlobalAudioPlayer.tsx`)
- Wraps `react-h5-audio-player`, injecting our CSS skin (`GlobalAudioPlayer.css`) for consistent styling across light/dark themes.
- Metadata panel shows length, size, and creation date, using helpers to format seconds, bytes, and ISO timestamps.
- Registers keyboard shortcuts while open: `Esc` closes, `Space` toggles play/pause, `←/→` scrubs ±10 seconds.
- Respects workspace "focus mode" by dimming the backdrop when the optional `EnhancedWorkspaceContext` reports `isActive`.
- Offers explicit playback-rate buttons (`[0.75, 1, 1.5, 2, 2.5, 3]`) that call `setPlaybackRate` and synchronise the underlying `<audio>` element via `audioPlayerRef`.

### Header Mini Player (`src/components/HeaderMiniAudioPlayer.tsx`)
- Renders only when `playerState.uiMode === 'header'`, keeping the header uncluttered unless a track is active.
- Mounts a plain `<audio>` element so we keep bundle weight low and avoid re-rendering the heavy overlay widget.
- Binds DOM events (`play`, `pause`, `ended`) to `updatePlayerState` so context stays the source of truth.
- Implements a beloved speed cycler: iterates through `[0.75, 1, 1.25, 1.5, 2]`, updates context via `setPlaybackRate`, and immediately applies the new rate to the `<audio>` element.
- Provides quick actions: `Play/Pause`, `Change speed`, and `Stop` (calls `closePlayer()`), plus inline filename display with truncation for long names.

### Backend integration (`src-tauri/src/commands/audio.rs`)
- `resolve_recording_absolute_path` uses Tauri's `PathResolver` to convert the app-relative `filepath` into a filesystem path compatible with `convertFileSrc`.
- `get_audio_data` reads the file, converts it to base64 (`data:audio/wav;base64,...`) as a last resort for environments where streaming from disk is blocked.
- Additional commands (e.g. `get_card_recordings`, `delete_recording`) feed the UI but are optional for a minimal integration.

### Styling (`src/components/GlobalAudioPlayer.css`)
- Overrides `react-h5-audio-player` classes to match the app brand: circular play/pause button, custom skip controls, bespoke progress bar, and dark-mode variants.
- Header mini player relies on utility classes (Tailwind) rather than a dedicated stylesheet.

## Playback Flow
1. A feature such as `RecordingHistory` loads metadata via Tauri (`get_card_recordings`).
2. When the user clicks **Play**, the component calls `playRecording()` with `{ id, filename, filepath, duration?, file_size?, created_at }`.
3. The hook resolves the preferred audio source (`fileUrl` or fallback `audioUrl`), stores it in `currentRecording`, and opens the player (`isOpen = true`, `uiMode = 'header'`).
4. The header mini player renders, attaches itself to the audio element, and synchronises play/pause/end events back into context.
5. If the user opens the full overlay (by calling `setUIMode('overlay')` from any UI affordance you add), the same state drives the modal player with enhanced controls.
6. Closing either shell (`closePlayer`) pauses playback, zeroes the timeline, and hides both players.

## Reusing in Another Project
1. **Copy the trio** – bring over `useGlobalAudioPlayer.ts`, `GlobalAudioPlayerContext.tsx`, `GlobalAudioPlayer.tsx`, and `HeaderMiniAudioPlayer.tsx`, plus `GlobalAudioPlayer.css` and the `react-h5-audio-player` dependency.
2. **Wrap your app** – render `<GlobalAudioPlayerProvider>` high in the tree (ideally around your router/layout) so `useGlobalAudioPlayerContext()` is reachable anywhere.
3. **Supply recordings** – ensure whichever list/detail screen owns audio invokes `playRecording()` with the expected shape. Adapt the Tauri commands or wire up an equivalent data service if your project uses a different backend.
4. **Embed the mini player** – insert `<HeaderMiniAudioPlayer />` in your header or global toolbar. It remains invisible until a track is active.
5. **Expose an overlay trigger** (optional) – call `setUIMode('overlay')` from a button or hotkey to bring up the modal experience; the overlay already knows how to downgrade back to header mode when playback starts.
6. **Tune speeds & styling** – adjust the `playbackRates` arrays or CSS skin to match the new product's UX while keeping the shared state machinery intact.

## Public API Reference
- `playerState` (`AudioPlayerState`) – read-only snapshot for UI rendering.
- `currentRecording` (`PlayingRecording | null`) – includes `fileUrl` and/or `audioUrl` after resolution.
- `playRecording(recording)` – async; loads sources, opens the player.
- `closePlayer()` – hides UI and stops audio.
- `updatePlayerState(partial)` – low-level escape hatch for custom UI extensions.
- `setUIMode('overlay' | 'header')` – switches between shells.
- `setPlaybackRate(rate)` / `setVolume(volume)` / `setCurrentTime(seconds)` – convenience mutators that also touch the bound `<audio>` element.
- `setAudioElementRef(audioEl)` – allows any UI to register the element it owns; called by both players during `useEffect`.

## Implementation Tips
- **Single source of truth** – always manipulate playback through context helpers so overlay and header stay in sync.
- **Speed persistence** – because `setPlaybackRate` updates context first, you can later persist `playerState.playbackRate` (e.g. to `localStorage`) if desired.
- **Keyboard accessibility** – the overlay already wires common shortcuts; mirror any extra key bindings in the mini player if you add them.
- **Backend portability** – if you are not on Tauri, replace the `invoke` calls in `playRecording` with your fetch/storage mechanism but keep the rest of the hook untouched.
- **Error surfacing** – `playerState.error` is rendered inside the overlay. Consider adding a toast or badge in the header mini player if you want instant feedback there as well.

By reusing these modules you preserve the simplified header controller that the team loves while still having the modal experience for deep focus sessions. The separation of state, UI shells, and backend resolution makes it straightforward to transplant into any React-based project.
