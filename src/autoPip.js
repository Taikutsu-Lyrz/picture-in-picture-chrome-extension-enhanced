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

const SETTINGS_KEY = "pipPlusSettings";
const DEFAULT_SETTINGS = {
  autoPip: false,
  autoPipMinimize: false,
};

let settings = { ...DEFAULT_SETTINGS };
let lastAutoPipRequest = 0;

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

function loadSettings() {
  chrome.storage.sync.get(SETTINGS_KEY, (data) => {
    settings = {
      ...DEFAULT_SETTINGS,
      ...(data[SETTINGS_KEY] || {}),
    };
  });
}

function maybeRequestAutoPip() {
  const now = Date.now();
  if (now - lastAutoPipRequest < 1000) {
    return;
  }

  const video = findLargestPlayingVideo();
  if (!video || video.paused || video.ended || document.pictureInPictureElement === video) {
    return;
  }

  lastAutoPipRequest = now;
  video.requestPictureInPicture().catch(() => {});
}

// Requests PiP when Chrome triggers the automatic PiP media action.
navigator.mediaSession.setActionHandler("enterpictureinpicture", () => {
  if (settings.autoPip || settings.autoPipMinimize) {
    maybeRequestAutoPip();
  }
});

loadSettings();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes[SETTINGS_KEY]) {
    settings = {
      ...DEFAULT_SETTINGS,
      ...(changes[SETTINGS_KEY].newValue || {}),
    };
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "hidden") {
    return;
  }

  if (settings.autoPip || settings.autoPipMinimize) {
    maybeRequestAutoPip();
  }
});

window.addEventListener("blur", () => {
  if (!settings.autoPipMinimize) {
    return;
  }

  setTimeout(() => {
    if (document.visibilityState === "hidden") {
      maybeRequestAutoPip();
    }
  }, 50);
});
