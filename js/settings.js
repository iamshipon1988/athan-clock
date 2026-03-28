// Pre-fill form from saved settings
(function initSettingsPage() {
    const defaults = { location: '', lat: null, lng: null, locationType: 'address', theme: 'auto', athan: 'default', athanLength: 'full' };
    const saved = localStorage.getItem('athanClockSettings');
    let s = saved ? { ...defaults, ...JSON.parse(saved) } : defaults;

    // Migrate legacy zipCode field
    if (!s.location && s.zipCode) {
        s.location    = s.zipCode;
        s.locationType = 'address';
    }

    const input = document.getElementById('locationInput');
    input.value = s.location || '';

    // Restore GPS/autocomplete coordinates so Save re-uses them
    if (s.locationType === 'coords' && s.lat && s.lng) {
        input.dataset.lat          = s.lat;
        input.dataset.lng          = s.lng;
        input.dataset.locationType = 'coords';
    }

    document.getElementById('themeSelect').value = s.theme;
    document.getElementById('athanSelect').value = s.athan;
    document.getElementById('athanLengthSelect').value = s.athanLength;

    registerNimaziServiceWorker();
    updateNotificationPermissionUI();
})();

// Wire up shared autocomplete (utils.js)
setupLocationAutocomplete(
    document.getElementById('locationInput'),
    document.getElementById('locationInput').parentElement,
    null // no submit-on-Enter; the form has its own Save button
);

function cancelSettings() {
    history.back();
}

function saveSettings() {
    const input = document.getElementById('locationInput');
    const location = input.value.trim();
    const theme = document.getElementById('themeSelect').value;
    const athan = document.getElementById('athanSelect').value;
    const athanLength = document.getElementById('athanLengthSelect').value;

    if (!location) {
        alert('Please enter a location to see prayer times');
        return;
    }

    const lat          = input.dataset.lat ? parseFloat(input.dataset.lat) : null;
    const lng          = input.dataset.lng ? parseFloat(input.dataset.lng) : null;
    const locationType = input.dataset.locationType || 'address';

    localStorage.setItem('athanClockSettings', JSON.stringify({ location, lat, lng, locationType, theme, athan, athanLength }));

    // Navigate to prayer times so the app refreshes with new settings
    window.location.href = 'index.html';
}

// Preview the selected athan (play/stop toggle)
function previewAthan() {
    const athanSelect = document.getElementById('athanSelect');
    const athanLengthSelect = document.getElementById('athanLengthSelect');
    const previewButton = document.getElementById('previewAthanButton');
    const audio = document.getElementById('athanAudio');
    const source = audio.querySelector('source');
    const isShortAthan = athanLengthSelect.value === 'short';

    if (!audio.paused) {
        window.clearTimeout(audio._previewStopTimer);
        audio.pause();
        audio.currentTime = 0;
        previewButton.textContent = '🔊 Play';
        return;
    }

    source.src = `athan/${athanSelect.value}.mp3`;
    audio.load();
    previewButton.textContent = '⏹ Stop';
    window.clearTimeout(audio._previewStopTimer);
    audio.currentTime = 0;
    audio.play().catch(() => {
        alert('Unable to play athan. Please check your audio settings.');
        previewButton.textContent = '🔊 Play';
    });

    if (isShortAthan) {
        window.clearTimeout(audio._previewStopTimer);
        audio._previewStopTimer = window.setTimeout(() => {
            audio.pause();
            audio.currentTime = 0;
            previewButton.textContent = '🔊 Play';
        }, 15000);
    }

    audio.onended = () => {
        window.clearTimeout(audio._previewStopTimer);
        previewButton.textContent = '🔊 Play';
    };
}

function updateNotificationPermissionUI() {
    const button = document.getElementById('notificationPermissionButton');
    const status = document.getElementById('notificationStatus');

    if (!button || !status) return;

    if (!('Notification' in window)) {
        button.disabled = true;
        button.textContent = 'Not Supported';
        status.textContent = 'This browser does not support web notifications.';
        return;
    }

    if (Notification.permission === 'granted') {
        button.disabled = true;
        button.textContent = 'Notifications Enabled';
        status.textContent = 'Prayer notifications are enabled for this device.';
        return;
    }

    button.disabled = false;
    button.textContent = 'Enable Notifications';

    if (Notification.permission === 'denied') {
        status.textContent = 'Notifications are blocked. Re-enable them in your browser or iPhone settings.';
        return;
    }

    if (!isStandaloneDisplayMode()) {
        status.textContent = 'On iPhone, web notifications require adding Nimazi to the home screen first.';
        return;
    }

    status.textContent = 'Enable notifications so Nimazi can show a prayer alert when the app is active.';
}

async function requestPrayerNotifications() {
    const permission = await requestPrayerNotificationPermission();
    updateNotificationPermissionUI();

    if (permission === 'granted') {
        alert('Prayer notifications are now enabled on this device.');
    } else if (permission === 'denied') {
        alert('Notifications were blocked. You can change this later in browser or iPhone settings.');
    }
}

// Thin wrapper so the HTML onclick attribute stays simple
function detectLocation() {
    detectUserLocation(
        document.getElementById('locationInput'),
        document.getElementById('detectLocationButton')
    );
}
