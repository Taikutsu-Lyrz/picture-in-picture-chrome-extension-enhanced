# PiP+ -- Picture-in-Picture Enhanced

A Chrome extension that lets you watch videos in a floating window (always on top) with custom controls, volume adjustment, and settings. Works on any website with a video element.

Based on Google's [Picture-in-Picture Extension](https://github.com/GoogleChromeLabs/picture-in-picture-chrome-extension), with a redesigned popup, YouTube integration, and configurable settings.

---

## Features

- **PiP Toggle** -- Enter and exit Picture-in-Picture from the popup, YouTube player controls, or keyboard shortcut.
- **Volume Control** -- Adjust video volume directly from the extension popup.
- **YouTube Button** -- A PiP button is injected into YouTube's player controls bar for quick access.
- **Auto PiP on tab switch** -- Automatically enters Picture-in-Picture when you switch tabs. Works on any website with a playing video.
- **Auto PiP on minimize** -- Automatically enters Picture-in-Picture when you minimize the browser or switch to another app.
- **Loop Toggle** -- Enables video looping. When toggled on, the video restarts automatically when it reaches the end.
- **Keyboard Shortcut** -- Press Alt+P (Option+P on macOS) to toggle PiP from any tab.
- **Works Everywhere** -- Any website with a `<video>` element is supported.

---

## Installation

### From source (Developer Mode)

1. Clone or download this repository.
2. Open `chrome://extensions/` in Chrome.
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Click **Load unpacked**.
5. Select the `src/` folder inside this repository.

---

## Usage

| Action | How |
|---|---|
| Toggle PiP | Click the extension icon, then click the **Enter PiP** button |
| Toggle PiP (keyboard) | Press `Alt+P` |
| Toggle PiP (YouTube) | Click the PiP+ button in YouTube's player controls |
| Adjust volume | Use the volume slider in the extension popup |
| Enable auto PiP | Open the popup and toggle **Auto PiP on tab switch** or **Auto PiP on minimize** |

---

## Settings

The extension popup includes a settings panel with three options:

| Setting | Description |
|---|---|
| Auto PiP on tab switch | Automatically enters PiP when you switch to another tab. Works on any website with a playing video. |
| Auto PiP on minimize | Automatically enters PiP when you minimize the browser or switch to another app (Alt+Tab). |
| Loop toggle | Enables video looping. When active, the video restarts automatically when it reaches the end. |

---

## Known Issues

- **YouTube PiP return-button edge case** -- On some Chrome and YouTube versions, after returning from PiP using the PiP window controls (top-right buttons), the next auto PiP trigger (tab switch, app switch, or minimize) may not fire until playback is nudged.
- **Current workaround** -- Pause and resume the video once, then auto PiP works again.
- **Intermittent playback stutter** -- Some systems may briefly stutter when switching app/window state while auto PiP is active due to browser-level media/session timing.

---

## Project Structure

```text
src/
  manifest.json         Extension manifest (Manifest V3)
  background.js         Service worker: shortcuts and script registration
  script.js             Core PiP toggle logic (works on all sites)
  autoPip.js            Auto PiP logic for tab/app switching
  youtube-button.js     YouTube integration: PiP button and player hooks
  settings-bridge.js    Settings bridge for MAIN world scripts
  popup.html            Extension popup UI
  popup.js              Popup logic: PiP toggle, volume, settings
  assets/               Extension icons
```

---

## Changes from Google's Original Extension

This project is a fork of [GoogleChromeLabs/picture-in-picture-chrome-extension](https://github.com/GoogleChromeLabs/picture-in-picture-chrome-extension). The original extension provided a minimal PiP toggle with a keyboard shortcut and a basic auto PiP beta feature. Below is a summary of what was changed.

### What was kept

- `script.js` -- Core PiP toggle behavior that finds the largest video and toggles Picture-in-Picture.
- Keyboard shortcut support -- Alt+P shortcut behavior.
- Manifest V3 architecture -- Service worker and scripting-based execution model.

### What was added

- **Extension popup** (`popup.html`, `popup.js`) -- Full popup UI with PiP toggle, volume control, and settings.
- **YouTube button** (`youtube-button.js`) -- PiP+ button injected into YouTube player controls.
- **Settings system** -- Toggles stored in `chrome.storage.sync` for auto PiP and loop behavior.
- **Settings bridge** (`settings-bridge.js`) -- Bridges settings from extension storage to MAIN world scripts.
- **Auto PiP via MediaSession API** -- Auto PiP behavior registered with `navigator.mediaSession.setActionHandler('enterpictureinpicture', ...)`.
- **Multi-frame video detection** -- Popup detection scans all frames so embedded video players are detected.

---

## License

Apache License 2.0. See [LICENSE](LICENSE) for details.

Original extension by [Google Chrome Labs](https://github.com/GoogleChromeLabs).
