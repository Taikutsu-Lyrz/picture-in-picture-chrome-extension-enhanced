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

// Runs when the extension action icon is clicked.
chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    files: ["script.js"],
  });
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
