// Pre-fill form from saved settings
(function initSettingsPage() {
    const defaults = { location: '', lat: null, lng: null, locationType: 'address', theme: 'auto', athan: 'default' };
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
    document.getElementById('athanSelect').value  = s.athan;
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
    const input    = document.getElementById('locationInput');
    const location = input.value.trim();
    const theme    = document.getElementById('themeSelect').value;
    const athan    = document.getElementById('athanSelect').value;

    if (!location) {
        alert('Please enter a location to see prayer times');
        return;
    }

    const lat          = input.dataset.lat ? parseFloat(input.dataset.lat) : null;
    const lng          = input.dataset.lng ? parseFloat(input.dataset.lng) : null;
    const locationType = input.dataset.locationType || 'address';

    localStorage.setItem('athanClockSettings', JSON.stringify({ location, lat, lng, locationType, theme, athan }));

    // Navigate to prayer times so the app refreshes with new settings
    window.location.href = 'index.html';
}

// Preview the selected athan (play/stop toggle)
function previewAthan() {
    const athanSelect   = document.getElementById('athanSelect');
    const previewButton = document.getElementById('previewAthanButton');
    const audio         = document.getElementById('athanAudio');
    const source        = audio.querySelector('source');

    if (!audio.paused) {
        audio.pause();
        audio.currentTime    = 0;
        previewButton.innerHTML = '🔊 Play';
        return;
    }

    source.src = `athan/${athanSelect.value}.mp3`;
    audio.load();
    previewButton.innerHTML = '⏹ Stop';
    audio.currentTime = 0;
    audio.play().catch(() => {
        alert('Unable to play athan. Please check your audio settings.');
        previewButton.innerHTML = '🔊 Play';
    });
    audio.onended = () => { previewButton.innerHTML = '🔊 Play'; };
}

// Thin wrapper so the HTML onclick attribute stays simple
function detectLocation() {
    detectUserLocation(
        document.getElementById('locationInput'),
        document.getElementById('detectLocationButton')
    );
}
