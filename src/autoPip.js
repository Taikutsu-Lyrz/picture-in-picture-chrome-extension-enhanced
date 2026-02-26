// Copyright 2025 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

(function () {
  if (window.__pipPlusAutoPipLoaded) {
    return;
  }
  window.__pipPlusAutoPipLoaded = true;

  const SETTINGS_KEY = "pipPlusSettings";
  const DEFAULT_SETTINGS = {
    autoPip: false,
    autoPipMinimize: false,
  };

  let settings = { ...DEFAULT_SETTINGS };
  let lastTrigger = 0;

  function findLargestPlayingVideo() {
    const videos = Array.from(document.querySelectorAll("video"))
      .filter((video) => video.readyState != 0)
      .filter((video) => video.disablePictureInPicture == false)
      .sort((v1, v2) => {
        const v1Rect = v1.getClientRects()[0] || { width: 0, height: 0 };
        const v2Rect = v2.getClientRects()[0] || { width: 0, height: 0 };
        return v2Rect.width * v2Rect.height - v1Rect.width * v1Rect.height;
      });

    if (videos.length === 0) {
      return;
    }

    return videos[0];
  }

  function isAutoPipEnabled() {
    return !!(settings.autoPip || settings.autoPipMinimize);
  }

  function hasEligibleVideo() {
    const video = findLargestPlayingVideo();
    if (!video || video.ended) {
      return false;
    }
    if (document.pictureInPictureElement === video) {
      return false;
    }
    return true;
  }

  // Ask the background service worker to inject script.js
  // This is the key fix: chrome.scripting.executeScript from the
  // background has proper permissions to call requestPictureInPicture()
  // even after returning from PiP, just like how tab-switch auto PiP works.
  function requestPipViaBackground() {
    const now = Date.now();
    if (now - lastTrigger < 1000) {
      return;
    }

    if (!hasEligibleVideo()) {
      return;
    }

    lastTrigger = now;
    chrome.runtime.sendMessage({ type: "PIP_PLUS_REQUEST_PIP" }).catch(() => {});
  }

  // Tab switch auto PiP -- this is the Chrome-native path that already works.
  // We keep registering this handler so Chrome's built-in automatic PiP
  // feature can trigger it. Chrome provides the user gesture for this path.
  function registerEnterPipHandler() {
    try {
      navigator.mediaSession.setActionHandler("enterpictureinpicture", null);
    } catch (_) {}

    try {
      navigator.mediaSession.setActionHandler("enterpictureinpicture", () => {
        const video = findLargestPlayingVideo();
        if (video && isAutoPipEnabled()) {
          video.requestPictureInPicture().catch(() => {});
        }
      });
    } catch (_) {}
  }

  function hookVideoLifecycle(video) {
    if (!video || video.__pipPlusHooked) {
      return;
    }

    video.__pipPlusHooked = true;
    video.addEventListener("leavepictureinpicture", () => {
      registerEnterPipHandler();
    });
    video.addEventListener("play", registerEnterPipHandler);
    video.addEventListener("pause", registerEnterPipHandler);
    video.addEventListener("loadedmetadata", registerEnterPipHandler);
  }

  function loadSettings() {
    chrome.storage.sync.get(SETTINGS_KEY, (data) => {
      settings = {
        ...DEFAULT_SETTINGS,
        ...(data[SETTINGS_KEY] || {}),
      };
      registerEnterPipHandler();
      hookVideoLifecycle(findLargestPlayingVideo());
    });
  }

  registerEnterPipHandler();
  loadSettings();
  hookVideoLifecycle(findLargestPlayingVideo());

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes[SETTINGS_KEY]) {
      settings = {
        ...DEFAULT_SETTINGS,
        ...(changes[SETTINGS_KEY].newValue || {}),
      };
      registerEnterPipHandler();
      hookVideoLifecycle(findLargestPlayingVideo());
    }
  });

  // Browser minimize / app switch: page goes hidden
  // Instead of calling requestPictureInPicture() directly (which fails
  // without user gesture after PiP return), we message the background
  // to inject script.js via chrome.scripting.executeScript.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "hidden") {
      registerEnterPipHandler();
      hookVideoLifecycle(findLargestPlayingVideo());
      return;
    }

    if (isAutoPipEnabled()) {
      requestPipViaBackground();
    }
  });

  window.addEventListener("blur", () => {
    if (!settings.autoPipMinimize) {
      return;
    }

    setTimeout(() => {
      if (document.visibilityState === "hidden") {
        requestPipViaBackground();
      }
    }, 50);
  });

  window.addEventListener("focus", () => {
    hookVideoLifecycle(findLargestPlayingVideo());
    registerEnterPipHandler();
  });

  const observer = new MutationObserver(() => {
    hookVideoLifecycle(findLargestPlayingVideo());
  });

  if (document.documentElement) {
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  setInterval(() => {
    if (isAutoPipEnabled()) {
      registerEnterPipHandler();
    }
  }, 5000);
})();
