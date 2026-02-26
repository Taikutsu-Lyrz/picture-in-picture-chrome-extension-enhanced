// Copyright 2018 Google LLC
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

// Shared helper: inject script.js into a tab to toggle PiP.
// chrome.scripting.executeScript runs with extension permissions,
// which provides the user-gesture context needed for
// requestPictureInPicture() -- even after returning from PiP.
// This is the same mechanism Chrome uses internally for tab-switch auto PiP.
async function injectPipToggle(tabId) {
  if (!tabId) {
    return;
  }

  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: ["script.js"],
  }).catch(() => {});
}

// Runs when the extension action icon is clicked.
chrome.action.onClicked.addListener((tab) => {
  injectPipToggle(tab.id);
});

// Alt+P keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-pip") {
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return;
  }

  await injectPipToggle(tab.id);
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "PIP_PLUS_SETTINGS_UPDATED") {
    refreshAutoPipState()
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  // autoPip.js asks us to toggle PiP via background injection.
  // This is the fix: content scripts can't call requestPictureInPicture()
  // without user gesture after returning from PiP. But
  // chrome.scripting.executeScript from the background can.
  if (message?.type === "PIP_PLUS_REQUEST_PIP") {
    const tabId = sender?.tab?.id;
    if (tabId) {
      injectPipToggle(tabId)
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));
    } else {
      sendResponse({ ok: false });
    }
    return true;
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  const { autoPip } = await chrome.storage.local.get({ autoPip: true });
  chrome.contextMenus.create({
    id: "autoPip",
    contexts: ["action"],
    title: "Automatic picture-in-picture (BETA)",
    type: "checkbox",
    checked: autoPip,
  });
  await refreshAutoPipState();
});

chrome.runtime.onStartup.addListener(async () => {
  chrome.action.setBadgeBackgroundColor({ color: "#4285F4" });
  chrome.action.setBadgeTextColor({ color: "#fff" });
  await refreshAutoPipState();
});

chrome.contextMenus.onClicked.addListener(async ({ checked: autoPip }) => {
  chrome.storage.local.set({ autoPip });
  await refreshAutoPipState();
});

chrome.storage.onChanged.addListener(async (changes, area) => {
  if ((area === "local" && changes.autoPip) ||
      (area === "sync" && changes[SETTINGS_KEY])) {
    await refreshAutoPipState();
  }
});

async function refreshAutoPipState() {
  const [{ autoPip: menuAutoPip }, syncData] = await Promise.all([
    chrome.storage.local.get({ autoPip: true }),
    chrome.storage.sync.get(SETTINGS_KEY),
  ]);

  const settings = syncData[SETTINGS_KEY] || {};
  const enabled = !!(menuAutoPip || settings.autoPip || settings.autoPipMinimize);

  await updateContentScripts(enabled);

  if (enabled) {
    await ensureAutoPipOnActiveTab();
  }
}

// Registers or removes the auto PiP content script.
async function updateContentScripts(autoPipEnabled) {
  chrome.action.setTitle({title: `Automatic picture-in-picture (${autoPipEnabled ? "on" : "off"})`});
  chrome.action.setBadgeText({ text: autoPipEnabled ? "★" : "" });

  await chrome.scripting.unregisterContentScripts({ ids: ["autoPip"] }).catch(() => {});

  if (!autoPipEnabled) {
    return;
  }

  await chrome.scripting.registerContentScripts([{
    id: "autoPip",
    js: ["autoPip.js"],
    matches: ["<all_urls>"],
    runAt: "document_start"
  }]);
}

async function ensureAutoPipOnActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return;
  }

  await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    files: ["autoPip.js"],
  }).catch(() => {});
}
