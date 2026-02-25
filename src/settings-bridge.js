// PiP+ settings bridge — runs in ISOLATED world on YouTube.
// Reads settings from chrome.storage and posts them to MAIN world
// where youtube-button.js can receive them.

(function () {
    var SETTINGS_KEY = 'pipPlusSettings';

    function pushSettings() {
        chrome.storage.sync.get(SETTINGS_KEY, function (data) {
            var settings = data[SETTINGS_KEY] || {};
            window.postMessage({
                type: 'PIP_PLUS_SETTINGS',
                settings: settings,
            }, '*');
        });
    }

    // Push on load
    pushSettings();

    // Push when settings change
    chrome.storage.onChanged.addListener(function (changes, area) {
        if (area === 'sync' && changes[SETTINGS_KEY]) {
            window.postMessage({
                type: 'PIP_PLUS_SETTINGS',
                settings: changes[SETTINGS_KEY].newValue || {},
            }, '*');
        }
    });

    // Re-push on YouTube SPA navigation
    window.addEventListener('yt-navigate-finish', function () {
        setTimeout(pushSettings, 1000);
    });
})();
