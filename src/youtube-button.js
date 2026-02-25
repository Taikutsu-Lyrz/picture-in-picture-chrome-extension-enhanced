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

// PiP+ -- YouTube button + Standard PiP with MediaSession controls.
// MAIN world -- all DOM built with createElementNS (Trusted Types safe).

(function () {
    if (window.__ytPipLoaded) return;
    window.__ytPipLoaded = true;

    var BTN_ID = '__yt-pip-btn__';
    var NS = 'http://www.w3.org/2000/svg';
    var SETTINGS_KEY = 'pipPlusSettings';

    // Default settings (matches popup.js)
    var settings = {
        loopToggle: false,
    };

    // -- Load settings from storage --
    function loadSettings(cb) {
        try {
            if (window.__pipPlusSettings) {
                for (var k in window.__pipPlusSettings) settings[k] = window.__pipPlusSettings[k];
            }
        } catch (e) { }
        if (cb) cb();
    }

    // Listen for settings updates from the extension
    window.addEventListener('message', function (e) {
        if (e.data && e.data.type === 'PIP_PLUS_SETTINGS') {
            for (var k in e.data.settings) settings[k] = e.data.settings[k];
            applyLoop();
        }
    });

    // -- SVG builder (Trusted Types safe) --
    function makeSvg(vb, w, h, pathData) {
        var s = document.createElementNS(NS, 'svg');
        s.setAttribute('viewBox', vb);
        s.setAttribute('width', String(w));
        s.setAttribute('height', String(h));
        for (var i = 0; i < pathData.length; i++) {
            var p = document.createElementNS(NS, 'path');
            p.setAttribute('fill', pathData[i].f || 'white');
            p.setAttribute('d', pathData[i].d);
            s.appendChild(p);
        }
        return s;
    }

    function iconPip() {
        return makeSvg('0 0 24 24', 24, 24, [
            { f: '#fff', d: 'M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z' }
        ]);
    }

    function getVideo() {
        return document.querySelector('#movie_player video')
            || document.querySelector('.html5-main-video')
            || document.querySelector('video');
    }

    // -- Apply loop setting to video immediately --
    function applyLoop() {
        var video = getVideo();
        if (video) {
            video.loop = !!settings.loopToggle;
        }
    }

    // -- Standard PiP with MediaSession controls --
    async function togglePip() {
        var video = getVideo();
        if (!video) return;

        // Exit if already in PiP
        if (document.pictureInPictureElement === video) {
            await document.exitPictureInPicture();
            return;
        }

        // Enter standard PiP
        await video.requestPictureInPicture();

        // Apply settings
        loadSettings();

        // Previous track
        try {
            navigator.mediaSession.setActionHandler('previoustrack', function () {
                var b = document.querySelector('.ytp-prev-button');
                if (b) b.click();
            });
        } catch (e) { }

        // Next track
        try {
            navigator.mediaSession.setActionHandler('nexttrack', function () {
                var b = document.querySelector('.ytp-next-button');
                if (b) b.click();
            });
        } catch (e) { }

        // Seek backward (-10s)
        try {
            navigator.mediaSession.setActionHandler('seekbackward', function (details) {
                video.currentTime = Math.max(0, video.currentTime - (details.seekOffset || 10));
            });
        } catch (e) { }

        // Seek forward (+10s)
        try {
            navigator.mediaSession.setActionHandler('seekforward', function (details) {
                video.currentTime = Math.min(video.duration || Infinity, video.currentTime + (details.seekOffset || 10));
            });
        } catch (e) { }

        // Loop toggle
        if (settings.loopToggle) {
            video.loop = true;
        }

        // Keep position state updated
        function updatePosition() {
            try {
                if (video.duration && isFinite(video.duration)) {
                    navigator.mediaSession.setPositionState({
                        duration: video.duration,
                        playbackRate: video.playbackRate || 1,
                        position: Math.min(video.currentTime, video.duration),
                    });
                }
            } catch (e) { }
        }
        video.addEventListener('timeupdate', updatePosition);
        updatePosition();

        // Update position when video changes (YouTube auto-play / SPA navigation)
        video.addEventListener('loadedmetadata', updatePosition);
        video.addEventListener('durationchange', updatePosition);
    }

    // -- Inject YouTube button --
    function tryInject() {
        if (document.getElementById(BTN_ID)) return;
        var controls = document.querySelector('.ytp-right-controls');
        if (!controls) return;

        var btn = document.createElement('button');
        btn.id = BTN_ID;
        btn.className = 'ytp-button';
        btn.title = 'PiP+';
        btn.setAttribute('aria-label', 'Picture-in-Picture');
        btn.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;vertical-align:top;';
        btn.appendChild(iconPip());
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            togglePip();
        });

        var ref = controls.querySelector('.ytp-settings-button');
        try {
            if (ref && ref.parentNode) ref.parentNode.insertBefore(btn, ref);
            else controls.appendChild(btn);
        } catch (e) {
            try { controls.appendChild(btn); } catch (_) { }
        }
    }

    // -- Boot --
    loadSettings();

    var poll = setInterval(function () {
        tryInject();
        if (document.getElementById(BTN_ID)) clearInterval(poll);
    }, 1000);

    window.addEventListener('yt-navigate-finish', function () {
        setTimeout(function () { if (!document.getElementById(BTN_ID)) tryInject(); }, 2000);
    });
})();
