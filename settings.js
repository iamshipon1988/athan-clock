// Pre-fill form from saved settings
(function initSettingsPage() {
    const defaults = { zipCode: '', theme: 'auto', athan: 'default' };
    const saved = localStorage.getItem('athanClockSettings');
    const s = saved ? { ...defaults, ...JSON.parse(saved) } : defaults;

    document.getElementById('zipCodeInput').value = s.zipCode || '';
    document.getElementById('themeSelect').value = s.theme;
    document.getElementById('athanSelect').value = s.athan;
})();

function cancelSettings() {
    history.back();
}

function saveSettings() {
    const zipCode = document.getElementById('zipCodeInput').value.trim();
    const theme   = document.getElementById('themeSelect').value;
    const athan   = document.getElementById('athanSelect').value;

    if (!zipCode) {
        alert('Please enter a ZIP code to see prayer times');
        return;
    }
    if (!/^\d{5}$/.test(zipCode)) {
        alert('Please enter a valid 5-digit ZIP code');
        return;
    }

    localStorage.setItem('athanClockSettings', JSON.stringify({ zipCode, theme, athan }));

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
        audio.currentTime = 0;
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

// Detect user location and populate ZIP code
async function detectLocation() {
    const button      = document.getElementById('detectLocationButton');
    const zipCodeInput = document.getElementById('zipCodeInput');

    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser');
        return;
    }

    button.disabled = true;
    button.innerHTML = '<span class="material-icons rotating">refresh</span>';

    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                timeout: 10000,
                maximumAge: 300000
            });
        });

        const { latitude, longitude } = position.coords;
        const response = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
        );

        if (!response.ok) throw new Error('Failed to fetch location data');

        const data = await response.json();
        const zipCode = data.postcode || data.postalCode;

        if (zipCode && /^\d{5}$/.test(zipCode)) {
            zipCodeInput.value = zipCode;
            button.innerHTML = '<span class="material-icons">check_circle</span>';
            setTimeout(() => {
                button.innerHTML = '<span class="material-icons">my_location</span>';
                button.disabled = false;
            }, 2000);
        } else {
            throw new Error('Could not determine ZIP code from location');
        }

    } catch (error) {
        button.innerHTML = '<span class="material-icons">error</span>';

        let msg = 'Could not detect location. ';
        if (error.code === 1)      msg += 'Please enable location permissions.';
        else if (error.code === 2) msg += 'Location unavailable.';
        else if (error.code === 3) msg += 'Request timeout.';
        else                       msg += error.message || 'Please try again.';

        alert(msg);
        setTimeout(() => {
            button.innerHTML = '<span class="material-icons">my_location</span>';
            button.disabled = false;
        }, 2000);
    }
}
