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

(async function () {
    'use strict';

    const pipBtn = document.getElementById('pipBtn');
    const pipLabel = document.getElementById('pipLabel');
    const volSlider = document.getElementById('volSlider');
    const volLabel = document.getElementById('volLabel');
    const controls = document.getElementById('controls');
    const noVideo = document.getElementById('noVideo');
    const statusText = document.getElementById('statusText');

    // Setting toggles
    const optAutoPip = document.getElementById('optAutoPip');
    const optAutoPipMinimize = document.getElementById('optAutoPipMinimize');
    const optLoop = document.getElementById('optLoop');

    const SETTINGS_KEY = 'pipPlusSettings';

    const DEFAULTS = {
        autoPip: false,
        autoPipMinimize: false,
        loopToggle: false,
    };

    // -- Load settings --
    let settings = { ...DEFAULTS };
    try {
        const stored = await chrome.storage.sync.get(SETTINGS_KEY);
        if (stored[SETTINGS_KEY]) {
            settings = { ...DEFAULTS, ...stored[SETTINGS_KEY] };
        }
    } catch (e) { }

    optAutoPip.checked = settings.autoPip;
    optAutoPipMinimize.checked = settings.autoPipMinimize;
    optLoop.checked = settings.loopToggle;

    // -- Save on toggle --
    function saveSettings() {
        settings.autoPip = optAutoPip.checked;
        settings.autoPipMinimize = optAutoPipMinimize.checked;
        settings.loopToggle = optLoop.checked;
        chrome.storage.sync.set({ [SETTINGS_KEY]: settings }, () => {
            chrome.runtime.sendMessage({ type: 'PIP_PLUS_SETTINGS_UPDATED' }).catch(() => { });
        });
    }

    optAutoPip.addEventListener('change', saveSettings);
    optAutoPipMinimize.addEventListener('change', saveSettings);
    optLoop.addEventListener('change', saveSettings);

    // -- Get active tab --
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) { showNoVideo(); return; }

    // -- Check for video --
    let hasVideo = false;
    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id, allFrames: true },
            func: () => {
                const vids = document.querySelectorAll('video');
                for (const v of vids) {
                    if (!v.disablePictureInPicture) {
                        return {
                            volume: Math.round(v.volume * 100),
                            pip: !!document.pictureInPictureElement,
                        };
                    }
                }
                return null;
            },
        });
        const found = results.find(r => r?.result != null);
        if (found?.result) {
            hasVideo = true;
            volSlider.value = found.result.volume;
            volLabel.textContent = found.result.volume + '%';
            if (found.result.pip) {
                pipBtn.classList.add('active');
                pipLabel.textContent = 'Exit PiP';
                statusText.textContent = 'PiP is active';
            }
        }
    } catch (e) {
        console.warn('Video check error:', e);
    }

    if (!hasVideo) { showNoVideo(); return; }
    controls.style.display = 'block';

    // -- PiP Toggle --
    pipBtn.addEventListener('click', async () => {
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id, allFrames: true },
                files: ['script.js'],
            });

            setTimeout(async () => {
                try {
                    const results = await chrome.scripting.executeScript({
                        target: { tabId: tab.id, allFrames: true },
                        func: () => !!document.pictureInPictureElement,
                    });
                    const isPip = results.some(r => r?.result === true);
                    if (isPip) {
                        pipBtn.classList.add('active');
                        pipLabel.textContent = 'Exit PiP';
                        statusText.textContent = 'PiP is active';

                        // Apply loop setting
                        try {
                            await chrome.scripting.executeScript({
                                target: { tabId: tab.id, allFrames: true },
                                func: (loop) => {
                                    const video = document.querySelector('video');
                                    if (video && loop) video.loop = true;
                                },
                                args: [settings.loopToggle],
                            });
                        } catch (e) { }
                    } else {
                        pipBtn.classList.remove('active');
                        pipLabel.textContent = 'Enter PiP';
                        statusText.textContent = 'Click the button or press Alt+P';
                    }
                } catch (e) { }
            }, 500);
        } catch (e) {
            console.warn('PiP toggle error:', e);
        }
    });

    // -- Volume --
    volSlider.addEventListener('input', async () => {
        const val = Number(volSlider.value);
        volLabel.textContent = val + '%';
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id, allFrames: true },
                func: (volume) => {
                    document.querySelectorAll('video').forEach(v => {
                        v.volume = volume / 100;
                        v.muted = volume === 0;
                    });
                },
                args: [val],
            });
        } catch (e) { }
    });

    function showNoVideo() {
        noVideo.style.display = 'block';
        controls.style.display = 'none';
    }
})();
