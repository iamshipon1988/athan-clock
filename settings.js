// Pre-fill form from saved settings
(function initSettingsPage() {
    const defaults = { location: '', lat: null, lng: null, locationType: 'address', theme: 'auto', athan: 'default' };
    const saved = localStorage.getItem('athanClockSettings');
    let s = saved ? { ...defaults, ...JSON.parse(saved) } : defaults;

    // Migrate legacy zipCode field
    if (!s.location && s.zipCode) {
        s.location = s.zipCode;
        s.locationType = 'address';
    }

    const input = document.getElementById('locationInput');
    input.value = s.location || '';

    // Restore GPS/autocomplete coordinates so Save re-uses them
    if (s.locationType === 'coords' && s.lat && s.lng) {
        input.dataset.lat = s.lat;
        input.dataset.lng = s.lng;
        input.dataset.locationType = 'coords';
    }

    // Clear coordinate data if user manually edits the field
    input.addEventListener('input', () => {
        delete input.dataset.lat;
        delete input.dataset.lng;
        delete input.dataset.locationType;
    });

    document.getElementById('themeSelect').value = s.theme;
    document.getElementById('athanSelect').value = s.athan;
})();

// Wire up autocomplete after IIFE
setupLocationAutocomplete();

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

    const lat = input.dataset.lat ? parseFloat(input.dataset.lat) : null;
    const lng = input.dataset.lng ? parseFloat(input.dataset.lng) : null;
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

// Detect user location via GPS and populate the location field
async function detectLocation() {
    const button        = document.getElementById('detectLocationButton');
    const locationInput = document.getElementById('locationInput');

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
        const city    = data.city || data.locality || data.principalSubdivision;
        const country = data.countryName || data.countryCode;
        const label   = city ? `${city}, ${country}` : country;

        if (label) {
            locationInput.value = label;
            locationInput.dataset.lat          = latitude;
            locationInput.dataset.lng          = longitude;
            locationInput.dataset.locationType = 'coords';
            hideSuggestions();
            button.innerHTML = '<span class="material-icons">check_circle</span>';
            setTimeout(() => {
                button.innerHTML = '<span class="material-icons">my_location</span>';
                button.disabled  = false;
            }, 2000);
        } else {
            throw new Error('Could not determine location name');
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
            button.disabled  = false;
        }, 2000);
    }
}

// ── Autocomplete ──────────────────────────────────────────────

let _autocompleteTimeout = null;

function setupLocationAutocomplete() {
    const input = document.getElementById('locationInput');

    input.addEventListener('input', () => {
        clearTimeout(_autocompleteTimeout);
        const query = input.value.trim();
        if (query.length < 3) { hideSuggestions(); return; }
        _autocompleteTimeout = setTimeout(() => fetchLocationSuggestions(query), 350);
    });

    // Keyboard navigation
    input.addEventListener('keydown', (e) => {
        const list = document.getElementById('locationSuggestions');
        if (!list) return;

        const items = Array.from(list.querySelectorAll('.location-suggestion-item'));
        if (!items.length) return;

        const activeIdx = items.findIndex(i => i.classList.contains('active'));

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const next = activeIdx < items.length - 1 ? activeIdx + 1 : 0;
            items.forEach(i => i.classList.remove('active'));
            items[next].classList.add('active');
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prev = activeIdx > 0 ? activeIdx - 1 : items.length - 1;
            items.forEach(i => i.classList.remove('active'));
            items[prev].classList.add('active');
        } else if (e.key === 'Enter') {
            const active = list.querySelector('.location-suggestion-item.active');
            if (active) { e.preventDefault(); active.click(); }
        } else if (e.key === 'Escape') {
            hideSuggestions();
        }
    });

    // Dismiss on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#locationSuggestions') && e.target.id !== 'locationInput') {
            hideSuggestions();
        }
    });
}

async function fetchLocationSuggestions(query) {
    try {
        const res = await fetch(
            `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&lang=en`
        );
        if (!res.ok) return;
        const data = await res.json();
        showSuggestions(data.features || []);
    } catch (e) {
        // Silently fail — user can still type manually
    }
}

function showSuggestions(features) {
    hideSuggestions();
    if (!features.length) return;

    const input   = document.getElementById('locationInput');
    const wrapper = input.closest('.zip-input-group');
    const list    = document.createElement('ul');
    list.id        = 'locationSuggestions';
    list.className = 'location-suggestions';

    features.forEach(feature => {
        const p    = feature.properties || {};
        const coords = feature.geometry.coordinates; // GeoJSON: [lng, lat]
        const lng  = coords[0];
        const lat  = coords[1];

        const name    = p.name || p.county || '';
        const state   = p.state || '';
        const country = p.country || '';

        if (!name && !country) return;

        const inputLabel = name && country ? `${name}, ${country}` : (name || country);
        const sublabel   = [state, country].filter(Boolean).join(', ');

        const li = document.createElement('li');
        li.className = 'location-suggestion-item';
        li.innerHTML = `
            <span class="suggestion-primary">${name || country}</span>
            ${sublabel ? `<span class="suggestion-secondary">${sublabel}</span>` : ''}
        `;

        li.addEventListener('click', () => {
            input.value = inputLabel;
            input.dataset.lat          = lat;
            input.dataset.lng          = lng;
            input.dataset.locationType = 'coords';
            hideSuggestions();
        });

        list.appendChild(li);
    });

    if (list.children.length) wrapper.appendChild(list);
}

function hideSuggestions() {
    const el = document.getElementById('locationSuggestions');
    if (el) el.remove();
}
