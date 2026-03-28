// ============================================================
//  utils.js — Shared utilities for Nimazi
//  Loaded before app.js, settings.js, and guide.js.
// ============================================================

// ==================== RAMADAN DATES ====================
//
// Update this table each year before the current year ends.
// Dates are approximate Gregorian equivalents of the Islamic calendar.
//
const RAMADAN_DATES = {
    2025: { start: new Date(2025, 2,  1), end: new Date(2025, 2, 30) }, // Mar  1 – Mar 30
    2026: { start: new Date(2026, 1, 17), end: new Date(2026, 2, 18) }, // Feb 17 – Mar 18
    2027: { start: new Date(2027, 1,  6), end: new Date(2027, 2,  7) }, // Feb  6 – Mar  7
};

function isCurrentlyRamadan() {
    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dates = RAMADAN_DATES[now.getFullYear()];
    if (!dates) return false;
    const start = new Date(dates.start.getFullYear(), dates.start.getMonth(), dates.start.getDate());
    const end   = new Date(dates.end.getFullYear(),   dates.end.getMonth(),   dates.end.getDate());
    return today >= start && today <= end;
}

// ==================== LOCATION DETECTION ====================
//
// Detects the user's location via the browser Geolocation API and
// reverse-geocodes it to a human-readable city name.
//
// @param {HTMLInputElement} inputEl  — the text field to populate
// @param {HTMLButtonElement} buttonEl — the trigger button (shows spinner/check/error)
//
async function detectUserLocation(inputEl, buttonEl) {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser');
        return;
    }

    buttonEl.disabled = true;
    buttonEl.innerHTML = '<span class="material-icons rotating">refresh</span>';

    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                timeout: 10000,
                maximumAge: 300000,
            });
        });

        const { latitude, longitude } = position.coords;
        const response = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
        );
        if (!response.ok) throw new Error('Failed to fetch location data');

        const data    = await response.json();
        const city    = data.city || data.locality || data.principalSubdivision;
        const country = data.countryName || data.countryCode;
        const label   = city ? `${city}, ${country}` : country;

        if (!label) throw new Error('Could not determine location name');

        inputEl.value = label;
        inputEl.dataset.lat          = latitude;
        inputEl.dataset.lng          = longitude;
        inputEl.dataset.locationType = 'coords';
        hideLocationSuggestions(inputEl.parentElement);

        buttonEl.innerHTML = '<span class="material-icons">check_circle</span>';
        setTimeout(() => {
            buttonEl.innerHTML = '<span class="material-icons">my_location</span>';
            buttonEl.disabled  = false;
        }, 2000);

    } catch (error) {
        buttonEl.innerHTML = '<span class="material-icons">error</span>';

        let msg = 'Could not detect location. ';
        if (error.code === 1)      msg += 'Please enable location permissions.';
        else if (error.code === 2) msg += 'Location unavailable.';
        else if (error.code === 3) msg += 'Request timeout.';
        else                       msg += error.message || 'Please try again.';

        alert(msg);
        setTimeout(() => {
            buttonEl.innerHTML = '<span class="material-icons">my_location</span>';
            buttonEl.disabled  = false;
        }, 2000);
    }
}

// ==================== LOCATION AUTOCOMPLETE ====================
//
// A single implementation shared by the settings page and the onboarding modal.
//
// @param {HTMLInputElement} inputEl   — the text field
// @param {HTMLElement}      wrapperEl — parent element that receives the dropdown
// @param {Function|null}    onSubmit  — called when Enter is pressed with no active suggestion
//                                       (use for onboarding "Get Started"; pass null for settings)
//
let _autocompleteTimer = null;

async function fetchLocationSuggestions(query) {
    try {
        const res = await fetch(
            `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&lang=en`
        );
        if (!res.ok) return [];
        const data = await res.json();
        return data.features || [];
    } catch (e) {
        return []; // Silently fail — user can still type manually
    }
}

function renderLocationSuggestions(features, inputEl, wrapperEl) {
    hideLocationSuggestions(wrapperEl);
    if (!features.length) return;

    const list    = document.createElement('ul');
    list.className = 'location-suggestions';

    features.forEach(feature => {
        const p      = feature.properties || {};
        const coords = feature.geometry.coordinates; // GeoJSON: [lng, lat]
        const lng    = coords[0];
        const lat    = coords[1];

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
            inputEl.value = inputLabel;
            inputEl.dataset.lat          = lat;
            inputEl.dataset.lng          = lng;
            inputEl.dataset.locationType = 'coords';
            hideLocationSuggestions(wrapperEl);
        });
        list.appendChild(li);
    });

    if (list.children.length) wrapperEl.appendChild(list);
}

function hideLocationSuggestions(wrapperEl) {
    if (!wrapperEl) return;
    const el = wrapperEl.querySelector('.location-suggestions');
    if (el) el.remove();
}

function setupLocationAutocomplete(inputEl, wrapperEl, onSubmit) {
    if (inputEl._autocompleteSetup) return;
    inputEl._autocompleteSetup = true;

    // Clear stored coordinates when user types (so we don't save stale coords)
    inputEl.addEventListener('input', () => {
        delete inputEl.dataset.lat;
        delete inputEl.dataset.lng;
        delete inputEl.dataset.locationType;
        clearTimeout(_autocompleteTimer);
        const query = inputEl.value.trim();
        if (query.length < 3) { hideLocationSuggestions(wrapperEl); return; }
        _autocompleteTimer = setTimeout(async () => {
            const features = await fetchLocationSuggestions(query);
            renderLocationSuggestions(features, inputEl, wrapperEl);
        }, 350);
    });

    // Keyboard navigation within the dropdown
    inputEl.addEventListener('keydown', (e) => {
        const list = wrapperEl.querySelector('.location-suggestions');

        if (e.key === 'Escape') {
            hideLocationSuggestions(wrapperEl);
            return;
        }

        if (!list) {
            if (e.key === 'Enter' && onSubmit) { e.preventDefault(); onSubmit(); }
            return;
        }

        const items    = Array.from(list.querySelectorAll('.location-suggestion-item'));
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
            if (active) {
                e.preventDefault();
                active.click();
            } else if (onSubmit) {
                e.preventDefault();
                onSubmit();
            }
        }
    });

    // Dismiss dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!wrapperEl.contains(e.target)) {
            hideLocationSuggestions(wrapperEl);
        }
    });
}

// ==================== NOTIFICATIONS ====================

let nimaziServiceWorkerRegistrationPromise = null;

function isStandaloneDisplayMode() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

async function registerNimaziServiceWorker() {
    if (!('serviceWorker' in navigator)) return null;
    if (!nimaziServiceWorkerRegistrationPromise) {
        nimaziServiceWorkerRegistrationPromise = navigator.serviceWorker.register('sw.js');
    }
    try {
        return await nimaziServiceWorkerRegistrationPromise;
    } catch (error) {
        console.warn('Service worker registration failed:', error);
        return null;
    }
}

async function requestPrayerNotificationPermission() {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission !== 'default') return Notification.permission;
    await registerNimaziServiceWorker();
    return Notification.requestPermission();
}

async function showPrayerNotification(title, options = {}) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return false;

    const registration = await registerNimaziServiceWorker();
    if (registration && typeof registration.showNotification === 'function') {
        await registration.showNotification(title, options);
        return true;
    }

    try {
        new Notification(title, options);
        return true;
    } catch (error) {
        console.warn('Unable to show notification:', error);
        return false;
    }
}
