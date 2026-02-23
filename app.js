// Settings with defaults
let settings = {
    location: '',       // City, postal code, or address string
    lat: null,          // Latitude from GPS detect
    lng: null,          // Longitude from GPS detect
    locationType: 'address', // 'address' or 'coords'
    theme: "auto", // auto, default, ramadan, kids
    athan: "default" // Athan voice selection
};

const CALCULATION_METHOD = 2; // ISNA method

// Set to true to test Ramadan mode year-round
const RAMADAN_TEST_MODE = false;

// Prayer information
const PRAYER_INFO = {
    Fajr: {
        icon: '🌅',
        rakats: [
            { type: 'Sunnah', count: 2, required: false },
            { type: 'Fard', count: 2, required: true }
        ],
        description: 'The pre-dawn prayer. Wake up before sunrise to pray and start your day with blessings.'
    },
    Dhuhr: {
        icon: '☀️',
        rakats: [
            { type: 'Sunnah', count: 4, required: false },
            { type: 'Fard', count: 4, required: true },
            { type: 'Sunnah', count: 2, required: false }
        ],
        description: 'The noon prayer. A midday break to reconnect with Allah and recharge spiritually.'
    },
    Asr: {
        icon: '🌤️',
        rakats: [
            { type: 'Sunnah', count: 4, required: false },
            { type: 'Fard', count: 4, required: true }
        ],
        description: 'The afternoon prayer. Performed in the late afternoon before the sun begins to set.'
    },
    Maghrib: {
        icon: '🌆',
        rakats: [
            { type: 'Fard', count: 3, required: true },
            { type: 'Sunnah', count: 2, required: false }
        ],
        description: 'The sunset prayer. Pray just after the sun sets and break your fast during Ramadan.'
    },
    Isha: {
        icon: '🌙',
        rakats: [
            { type: 'Sunnah', count: 4, required: false },
            { type: 'Fard', count: 4, required: true },
            { type: 'Sunnah', count: 2, required: false },
            { type: 'Witr', count: 3, required: false }
        ],
        description: 'The night prayer. Complete your day with worship and reflection before sleep.'
    }
};

let prayerTimesData = null;
let nextPrayerInfo = null;
let isRamadan = false;
let lastAnnouncedPrayer = null;
let showingTomorrow = false;
let currentHijriData = null;    // Hijri data for current viewed date
let locationTimezone = null;    // IANA timezone from Aladhan API (e.g. "America/New_York")

// Date navigation and caching state
let currentViewedDate = null;  // Date being viewed (user navigates this)
let todayDate = null;           // Actual today (never changes except midnight)
let prayerCache = null;         // Cache object from localStorage
const CACHE_VERSION = "1.0";
const CACHE_KEY = "athanClockPrayerCache";
const CACHE_DAYS_RANGE = 3;     // ±3 days from today
const CACHE_EXPIRY_DAYS = 7;    // Entries older than 7 days are stale

// Load settings from localStorage
function loadSettings() {
    const savedSettings = localStorage.getItem('athanClockSettings');
    if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        // Migrate legacy zipCode field
        if (!parsed.location && parsed.zipCode) {
            parsed.location = parsed.zipCode;
            parsed.locationType = 'address';
        }
        settings = { ...settings, ...parsed };
    }
}

// Save settings to localStorage
function saveSettingsToStorage() {
    localStorage.setItem('athanClockSettings', JSON.stringify(settings));
}

// Initialize settings on page load
loadSettings();

// ==================== DATE HELPER FUNCTIONS ====================

// Format date as YYYY-MM-DD for cache keys
function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Add/subtract days from a date
function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

// Check if two dates are the same day
function isSameDay(date1, date2) {
    return formatDateKey(date1) === formatDateKey(date2);
}

// ==================== CACHE MANAGEMENT FUNCTIONS ====================

// Initialize cache from localStorage
function loadPrayerCache() {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (!cached) {
            prayerCache = createEmptyCache();
            return;
        }

        const parsed = JSON.parse(cached);

        // Validate cache version and settings
        if (parsed.cacheVersion !== CACHE_VERSION ||
            parsed.location !== settings.location ||
            parsed.locationType !== settings.locationType) {
            console.log('Cache invalidated: version or settings mismatch');
            prayerCache = createEmptyCache();
            return;
        }

        prayerCache = parsed;
        if (parsed.timezone) locationTimezone = parsed.timezone;
        cleanExpiredEntries();
    } catch (error) {
        console.error('Error loading cache:', error);
        prayerCache = createEmptyCache();
    }
}

// Create empty cache structure
function createEmptyCache() {
    return {
        cacheVersion: CACHE_VERSION,
        location: settings.location,
        locationType: settings.locationType,
        timezone: null,
        lastUpdated: Date.now(),
        dates: {}
    };
}

// Save cache to localStorage
function savePrayerCache() {
    try {
        prayerCache.lastUpdated = Date.now();
        localStorage.setItem(CACHE_KEY, JSON.stringify(prayerCache));
    } catch (error) {
        console.error('Error saving cache:', error);
        // Handle quota exceeded
        if (error.name === 'QuotaExceededError') {
            console.warn('localStorage quota exceeded, keeping only today ±1 day');
            // Keep only today ±1 day
            const today = formatDateKey(new Date());
            const yesterday = formatDateKey(addDays(new Date(), -1));
            const tomorrow = formatDateKey(addDays(new Date(), 1));

            const minimumCache = {};
            if (prayerCache.dates[yesterday]) minimumCache[yesterday] = prayerCache.dates[yesterday];
            if (prayerCache.dates[today]) minimumCache[today] = prayerCache.dates[today];
            if (prayerCache.dates[tomorrow]) minimumCache[tomorrow] = prayerCache.dates[tomorrow];

            prayerCache.dates = minimumCache;
            localStorage.setItem(CACHE_KEY, JSON.stringify(prayerCache));
        }
    }
}

// Remove entries older than CACHE_EXPIRY_DAYS
function cleanExpiredEntries() {
    const now = Date.now();
    const expiryMs = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

    Object.keys(prayerCache.dates).forEach(dateKey => {
        const entry = prayerCache.dates[dateKey];
        if (now - entry.fetchedAt > expiryMs) {
            delete prayerCache.dates[dateKey];
        }
    });
}

// Clear entire cache
function clearPrayerCache() {
    prayerCache = createEmptyCache();
    localStorage.removeItem(CACHE_KEY);
}

// Get cached prayer times for a specific date
function getCachedPrayerTimes(date) {
    const dateKey = formatDateKey(date);
    return prayerCache.dates[dateKey] || null;
}

// Store prayer times in cache
function cachePrayerTimes(date, timings, hijriData) {
    const dateKey = formatDateKey(date);
    prayerCache.dates[dateKey] = {
        timings: timings,
        hijriDate: `${hijriData.day} ${hijriData.month.en} ${hijriData.year} AH`,
        hijriDay: hijriData.day,
        hijriMonth: hijriData.month.en,
        hijriYear: hijriData.year,
        fetchedAt: Date.now()
    };
    savePrayerCache();
}

// Check if mobile viewport
function isMobileViewport() {
    return window.innerWidth <= 480 && window.matchMedia('(orientation: portrait)').matches;
}

// Update sundial icon position for mobile
function updateSundialIcon() {
    if (!isMobileViewport()) return;

    const nextPrayerSection = document.querySelector('.next-prayer-section');
    if (!nextPrayerSection) return;

    // Create icon if it doesn't exist
    let sundialIcon = document.querySelector('.sundial-icon');
    if (!sundialIcon) {
        sundialIcon = document.createElement('div');
        sundialIcon.className = 'sundial-icon';
        nextPrayerSection.appendChild(sundialIcon);
    }

    const now = new Date();
    let hour;
    if (locationTimezone) {
        const tp = new Intl.DateTimeFormat('en-US', {
            timeZone: locationTimezone, hour: 'numeric', minute: 'numeric', hour12: false
        }).formatToParts(now);
        hour = (parseInt(tp.find(p => p.type === 'hour').value) % 24)
             + parseInt(tp.find(p => p.type === 'minute').value) / 60.0;
    } else {
        hour = now.getHours() + now.getMinutes() / 60.0;
    }

    // Determine if day or night (6am to 6pm is day)
    const isDay = hour >= 6 && hour < 18;
    sundialIcon.innerHTML = isDay
        ? '<span class="material-icons">wb_sunny</span>'
        : '<span class="material-icons">nights_stay</span>';

    // Calculate position along arc (6am = left, 6pm = right)
    // Map 6am-6pm (12 hours) to 0-1 progress
    let progress = ((hour - 6) / 12);
    progress = Math.max(0, Math.min(1, progress)); // Clamp to 0-1

    // Calculate angle (180° to 0°, which is π to 0 radians)
    const angle = Math.PI * (1 - progress);

    // Arc parameters (matching CSS - 280px width, 140px radius)
    const sectionWidth = nextPrayerSection.offsetWidth;
    const radius = 140;
    const centerX = sectionWidth / 2;
    const centerY = 0 + 140; // top position (0) + radius

    // Calculate icon position (icon is 40px, so offset by 20 to center)
    const iconX = centerX + radius * Math.cos(angle) - 20;
    const iconY = centerY - radius * Math.sin(angle) - 20;

    sundialIcon.style.left = iconX + 'px';
    sundialIcon.style.top = iconY + 'px';
}

// Update clock every second
function updateClock() {
    const now = new Date();
    const tzOpts = locationTimezone ? { timeZone: locationTimezone } : {};
    const timeString = now.toLocaleTimeString('en-US', {
        ...tzOpts, hour: '2-digit', minute: '2-digit', hour12: true
    });
    document.getElementById('clock').textContent = timeString;

    // On mobile, also update the sundial time
    if (isMobileViewport() && nextPrayerInfo) {
        const currentTimeString = now.toLocaleTimeString('en-US', {
            ...tzOpts, hour: 'numeric', minute: '2-digit', hour12: true
        });
        document.getElementById('nextPrayerName').textContent = currentTimeString;
    }

    // Update sundial icon position
    updateSundialIcon();
}

setInterval(updateClock, 1000);
updateClock();

// Update Gregorian date
function updateGregorianDate() {
    const now = new Date();
    const tzOpts = locationTimezone ? { timeZone: locationTimezone } : {};
    const dateString = now.toLocaleDateString('en-US', {
        ...tzOpts, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    document.getElementById('gregorianDate').textContent = dateString;
}

updateGregorianDate();

// Update Gregorian date to show currently viewed date
function updateGregorianDateForViewed() {
    const tzOpts = locationTimezone ? { timeZone: locationTimezone } : {};
    const dateString = currentViewedDate.toLocaleDateString('en-US', {
        ...tzOpts, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    document.getElementById('gregorianDate').textContent = dateString;
}

// Update Hijri date from API data or cache
function updateHijriDate(hijriData) {
    const hijriDateString = `${hijriData.day} ${hijriData.month.en} ${hijriData.year} AH`;
    document.getElementById('hijriDate').textContent = hijriDateString;
}

// Fetch Hijri date
async function fetchHijriDate() {
    try {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();

        const response = await fetch(
            `https://api.aladhan.com/v1/gToH/${day}-${month}-${year}`
        );
        const data = await response.json();

        if (data.code === 200) {
            const hijri = data.data.hijri;
            const hijriDateString = `${hijri.day} ${hijri.month.en} ${hijri.year} AH`;
            document.getElementById('hijriDate').textContent = hijriDateString;
        }
    } catch (error) {
        console.error('Error fetching Hijri date:', error);
        document.getElementById('hijriDate').textContent = 'Hijri Date Unavailable';
    }
}

fetchHijriDate();

// ==================== CACHE-AWARE FETCH FUNCTIONS ====================

// Fetch with timeout helper (for Fire Tablet and slow connections)
function fetchWithTimeout(url, timeout = 15000) {
    return Promise.race([
        fetch(url),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), timeout)
        )
    ]);
}

// Fetch prayer times for a specific date (with caching)
async function fetchPrayerTimesForDate(date) {
    // Check cache first
    const cached = getCachedPrayerTimes(date);
    if (cached) {
        console.log(`Using cached data for ${formatDateKey(date)}`);
        return {
            timings: cached.timings,
            hijriData: {
                day: cached.hijriDay,
                month: { en: cached.hijriMonth },
                year: cached.hijriYear
            }
        };
    }

    // Fetch from API with timeout
    try {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();

        console.log(`Fetching prayer times for ${formatDateKey(date)}...`);

        const apiUrl = (settings.locationType === 'coords' && settings.lat && settings.lng)
            ? `https://api.aladhan.com/v1/timings/${day}-${month}-${year}?latitude=${settings.lat}&longitude=${settings.lng}&method=${CALCULATION_METHOD}`
            : `https://api.aladhan.com/v1/timingsByAddress/${day}-${month}-${year}?address=${encodeURIComponent(settings.location)}&method=${CALCULATION_METHOD}`;

        const response = await fetchWithTimeout(apiUrl, 15000);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.code === 200 && data.data && data.data.timings) {
            const timings = data.data.timings;
            const hijriData = data.data.date.hijri;

            // Store and cache the location timezone
            if (data.data.meta && data.data.meta.timezone) {
                locationTimezone = data.data.meta.timezone;
                prayerCache.timezone = locationTimezone;
            }

            cachePrayerTimes(date, timings, hijriData);

            console.log(`Successfully fetched prayer times for ${formatDateKey(date)}`);
            return { timings, hijriData };
        } else {
            throw new Error('Invalid API response');
        }
    } catch (error) {
        console.error('Error fetching prayer times:', error);

        // If fetch failed and we have cached data (even expired), use it
        if (cached) {
            console.log('Using stale cache as fallback');
            return {
                timings: cached.timings,
                hijriData: {
                    day: cached.hijriDay,
                    month: { en: cached.hijriMonth },
                    year: cached.hijriYear
                }
            };
        }

        throw error;
    }
}

// Initialize and prefetch prayer times (called on page load)
async function initializePrayerTimes() {
    todayDate = new Date();
    currentViewedDate = new Date(todayDate);

    loadPrayerCache();

    // Validate location
    if (!settings.location || settings.location.trim() === '') {
        document.getElementById('prayerGrid').innerHTML = `
            <div class="loading" style="text-align: center;">
                <div style="font-size: 48px; margin-bottom: 15px;">📍</div>
                <div style="font-size: 18px; margin-bottom: 10px;">Welcome to Nimazi!</div>
                <div style="font-size: 14px; opacity: 0.8; margin-bottom: 20px;">Please set your location to see prayer times</div>
                <button onclick="openSettings()" style="padding: 12px 24px; font-size: 14px; border: none; background: linear-gradient(135deg, #f4d571 0%, #e0c45c 100%); color: #1a4d2e; border-radius: 8px; cursor: pointer; font-weight: 600;">Open Settings</button>
            </div>
        `;
        return;
    }

    // Set loading timeout (20 seconds) for slow devices like Fire Tablet
    const loadingTimeout = setTimeout(() => {
        const grid = document.getElementById('prayerGrid');
        if (grid && grid.innerHTML.includes('Loading prayer times')) {
            console.warn('Loading timeout exceeded - showing error');
            grid.innerHTML = `
                <div class="loading" style="text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 15px;">⏱️</div>
                    <div style="font-size: 16px; margin-bottom: 10px;">Loading is taking longer than expected</div>
                    <div style="font-size: 13px; opacity: 0.8; margin-bottom: 15px;">This may be due to slow network. Try refreshing or check your connection.</div>
                    <button onclick="location.reload()" style="padding: 10px 20px; font-size: 13px; border: none; background: linear-gradient(135deg, #f4d571 0%, #e0c45c 100%); color: #1a4d2e; border-radius: 8px; cursor: pointer; font-weight: 600; margin-right: 8px;">Retry</button>
                    <button onclick="openSettings()" style="padding: 10px 20px; font-size: 13px; border: 2px solid #f4d571; background: transparent; color: #f4d571; border-radius: 8px; cursor: pointer; font-weight: 600;">Settings</button>
                </div>
            `;
        }
    }, 20000);

    try {
        // Fetch today first (blocking)
        const todayData = await fetchPrayerTimesForDate(todayDate);
        prayerTimesData = todayData.timings;
        currentHijriData = todayData.hijriData;

        // Clear the loading timeout since we succeeded
        clearTimeout(loadingTimeout);

        // Update UI with today's data
        displayPrayerTimes();
        updateNextPrayer();
        updateHijriDate(todayData.hijriData);
        checkRamadanMode();
        updateDateNavigationUI();

        // Prefetch ±CACHE_DAYS_RANGE days in background
        const prefetchPromises = [];
        for (let i = -CACHE_DAYS_RANGE; i <= CACHE_DAYS_RANGE; i++) {
            if (i === 0) continue; // Already fetched today
            const date = addDays(todayDate, i);
            const cached = getCachedPrayerTimes(date);
            if (!cached) {
                prefetchPromises.push(
                    fetchPrayerTimesForDate(date).catch(err => {
                        console.warn(`Failed to prefetch ${formatDateKey(date)}:`, err);
                    })
                );
            }
        }

        // Prefetch in background
        if (prefetchPromises.length > 0) {
            Promise.all(prefetchPromises).then(() => {
                console.log('Background prefetch completed');
            }).catch(err => {
                console.warn('Some prefetch requests failed:', err);
            });
        }

    } catch (error) {
        console.error('Error initializing prayer times:', error);
        clearTimeout(loadingTimeout); // Clear timeout since we're showing error now

        const errorMsg = error.message === 'Request timeout'
            ? 'Connection timeout - network may be slow'
            : 'Failed to load prayer times';

        document.getElementById('prayerGrid').innerHTML = `
            <div class="loading" style="text-align: center;">
                <div style="font-size: 48px; margin-bottom: 15px;">⚠️</div>
                <div style="font-size: 16px; margin-bottom: 10px;">${errorMsg}</div>
                <div style="font-size: 13px; opacity: 0.8; margin-bottom: 15px;">Please check your internet connection and try again</div>
                <button onclick="location.reload()" style="padding: 10px 20px; font-size: 13px; border: none; background: linear-gradient(135deg, #f4d571 0%, #e0c45c 100%); color: #1a4d2e; border-radius: 8px; cursor: pointer; font-weight: 600; margin-right: 8px;">Retry</button>
                <button onclick="openSettings()" style="padding: 10px 20px; font-size: 13px; border: 2px solid #f4d571; background: transparent; color: #f4d571; border-radius: 8px; cursor: pointer; font-weight: 600;">Settings</button>
            </div>
        `;
    }
}

// Load and display prayer times for currently viewed date
async function loadPrayerTimesForCurrentView() {
    try {
        const data = await fetchPrayerTimesForDate(currentViewedDate);
        prayerTimesData = data.timings;
        currentHijriData = data.hijriData; // Store for use in updateNextPrayer
        displayPrayerTimes();
        updateNextPrayer();
        updateHijriDate(data.hijriData);
        checkRamadanMode();
        updateDateNavigationUI();

        // Background prefetch adjacent dates
        const prevDate = addDays(currentViewedDate, -1);
        const nextDate = addDays(currentViewedDate, 1);

        if (!getCachedPrayerTimes(prevDate)) {
            fetchPrayerTimesForDate(prevDate).catch(() => {});
        }
        if (!getCachedPrayerTimes(nextDate)) {
            fetchPrayerTimesForDate(nextDate).catch(() => {});
        }

    } catch (error) {
        console.error('Error loading prayer times:', error);
        document.getElementById('prayerGrid').innerHTML =
            '<div class="loading">Failed to load prayer times. Please check your connection.</div>';
    }
}

// Fetch prayer times (LEGACY - kept for backward compatibility, will be removed)
async function fetchPrayerTimes() {
    try {
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const year = today.getFullYear();

        const legacyUrl = (settings.locationType === 'coords' && settings.lat && settings.lng)
            ? `https://api.aladhan.com/v1/timings/${day}-${month}-${year}?latitude=${settings.lat}&longitude=${settings.lng}&method=${CALCULATION_METHOD}`
            : `https://api.aladhan.com/v1/timingsByAddress/${day}-${month}-${year}?address=${encodeURIComponent(settings.location)}&method=${CALCULATION_METHOD}`;
        const response = await fetch(legacyUrl);
        const data = await response.json();

        if (data.code === 200 && data.data && data.data.timings) {
            prayerTimesData = data.data.timings;
            displayPrayerTimes();
            updateNextPrayer();
            checkRamadanMode();
        } else {
            throw new Error('Invalid API response');
        }
    } catch (error) {
        console.error('Error fetching prayer times:', error);
        document.getElementById('prayerGrid').innerHTML =
            '<div class="loading">Failed to load prayer times. Please check your connection and refresh.</div>';
    }
}

// Display prayer times (updated for date navigation)
function displayPrayerTimes() {
    // All prayer times to display (excluding Imsak for mobile)
    let prayerList = [
        { key: 'Imsak', name: 'Sehri', label: 'Stop Eating (Suhoor)', isRamadanSpecial: true },
        { key: 'Fajr', name: 'Fajr', label: 'Dawn Prayer' },
        { key: 'Dhuhr', name: 'Dhuhr', label: 'Noon Prayer' },
        { key: 'Asr', name: 'Asr', label: 'Afternoon Prayer' },
        { key: 'Maghrib', name: 'Maghrib', label: 'Sunset Prayer', isRamadanSpecial: true },
        { key: 'Isha', name: 'Isha', label: 'Night Prayer' }
    ];

    // On mobile, exclude Imsak from main list (shown in Ramadan banner instead)
    if (isMobileViewport()) {
        prayerList = prayerList.filter(p => p.key !== 'Imsak');
    }

    const grid = document.getElementById('prayerGrid');
    grid.innerHTML = '';

    const now = new Date();
    const isViewingToday = currentViewedDate && todayDate && isSameDay(currentViewedDate, todayDate);

    prayerList.forEach(prayer => {
        // Skip if prayer time not available
        if (!prayerTimesData[prayer.key]) return;

        const timeString = prayerTimesData[prayer.key].split(' ')[0];
        const prayerTime = parseTimeString(timeString, currentViewedDate);

        const card = document.createElement('div');
        card.className = 'prayer-card';

        // Check if this is the next prayer (only when viewing today)
        if (isViewingToday && nextPrayerInfo && nextPrayerInfo.name === prayer.key) {
            card.classList.add('active');
        }

        // Highlight Ramadan special times
        if (isRamadan && prayer.isRamadanSpecial) {
            card.classList.add('ramadan-special');
        }

        // Check if prayer has passed (only if viewing today)
        if (isViewingToday && prayerTime < now) {
            card.classList.add('passed');
        }

        let ramadanLabel = '';
        if (isRamadan && prayer.isRamadanSpecial) {
            if (prayer.key === 'Imsak') {
                ramadanLabel = '<div class="prayer-label">Seheri / Suhoor</div>';
            } else if (prayer.key === 'Maghrib') {
                ramadanLabel = '';
            }
        }

        // No tomorrow label needed (replaced by date badge)

        // Get rakats info (show only required rakats)
        const prayerInfo = PRAYER_INFO[prayer.key];
        const requiredRakats = prayerInfo ? prayerInfo.rakats.filter(r => r.required).reduce((sum, r) => sum + r.count, 0) : 0;
        const rakatsText = requiredRakats > 0 ? `${requiredRakats} Rakats (Required)` : '';

        card.innerHTML = `
            <div>
                ${ramadanLabel}
                <div class="prayer-name">${prayer.name}</div>
                ${rakatsText ? `<div class="prayer-rakats">${rakatsText}</div>` : ''}
            </div>
            <div class="prayer-time">${formatTime(timeString)}</div>
        `;

        // Add click handler for main prayers only
        const mainPrayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
        if (mainPrayers.includes(prayer.key)) {
            card.onclick = () => showPrayerDetails(prayer.key, timeString);
        }

        grid.appendChild(card);
    });

    // Add Ramadan banner at the bottom on mobile
    if (isMobileViewport() && isRamadan) {
        const ramadanBanner = document.createElement('div');
        ramadanBanner.className = 'ramadan-banner-mobile';

        const imsakTime = prayerTimesData['Imsak'] ? prayerTimesData['Imsak'].split(' ')[0] : '--:--';
        const maghribTime = prayerTimesData['Maghrib'] ? prayerTimesData['Maghrib'].split(' ')[0] : '--:--';

        ramadanBanner.innerHTML = `
            <div class="ramadan-banner-title">
                <span class="moon-icon">🌙</span>
                <span class="ramadan-text">Ramadan Mubarak</span>
            </div>
            <div class="ramadan-times-row">
                <div class="ramadan-time-box">
                    <div class="ramadan-time-label">Suhoor Ends</div>
                    <div class="ramadan-time-value">${formatTime(imsakTime)}</div>
                </div>
                <div class="ramadan-time-box">
                    <div class="ramadan-time-label">Iftar</div>
                    <div class="ramadan-time-value">${formatTime(maghribTime)}</div>
                </div>
            </div>
        `;

        grid.appendChild(ramadanBanner);
    }
}

// Parse time string to Date object anchored to the location's timezone.
// e.g. "05:43" in "Europe/London" returns the UTC moment when London's clock reads 05:43.
function parseTimeString(timeString, forDate = null) {
    const baseDate = forDate ? new Date(forDate) : new Date();
    const [h, m] = timeString.split(':').map(Number);

    if (!locationTimezone) {
        // Fallback: use browser local time (single-timezone setup)
        const d = new Date(baseDate);
        d.setHours(h, m, 0, 0);
        return d;
    }

    const y  = baseDate.getFullYear();
    const mo = String(baseDate.getMonth() + 1).padStart(2, '0');
    const d  = String(baseDate.getDate()).padStart(2, '0');

    // Treat the prayer time naively as UTC to get a rough anchor
    const roughUTC = new Date(`${y}-${mo}-${d}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00Z`);

    // Find what the target timezone's clock reads at that UTC moment
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: locationTimezone,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
    }).formatToParts(roughUTC);

    const localH = parseInt(parts.find(p => p.type === 'hour').value) % 24;
    const localM = parseInt(parts.find(p => p.type === 'minute').value);

    // Compute the UTC offset in minutes and correct the timestamp
    let offsetMins = (localH - h) * 60 + (localM - m);
    if (offsetMins >  720) offsetMins -= 1440;  // handle day-boundary wraparound
    if (offsetMins < -720) offsetMins += 1440;

    return new Date(roughUTC.getTime() - offsetMins * 60000);
}

// Format time to 12-hour format
function formatTime(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`;
}

// Update next prayer (only relevant when viewing today)
function updateNextPrayer() {
    const isViewingToday = currentViewedDate && todayDate && isSameDay(currentViewedDate, todayDate);

    if (!isViewingToday) {
        // Restore visibility of all sections when viewing other dates
        document.querySelector('.next-prayer-info').style.display = 'flex';
        document.querySelector('.next-prayer-time-info').style.display = 'flex';
        document.querySelector('.countdown-label').style.display = 'block';

        // Remove all-complete class from countdown-info
        const countdownInfo = document.querySelector('.countdown-info');
        countdownInfo.classList.remove('all-complete');

        // Not viewing today
        if (isMobileViewport()) {
            // Mobile: Show current time in sundial position
            const now = new Date();
            const currentTimeString = now.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
            document.getElementById('nextPrayerName').textContent = currentTimeString;

            // Hide next prayer time section
            document.querySelector('.next-prayer-time-info').style.display = 'none';

            // Show "Back to Today" button in countdown area
            document.querySelector('.countdown-label').style.display = 'none';
            document.getElementById('countdown').innerHTML = `
                <button class="back-to-today-mobile" onclick="navigateToToday()">
                    <span class="material-icons">today</span>
                    Back to Today
                </button>
            `;
            document.getElementById('countdown').style.display = 'block';
        } else {
            // Desktop: Show sunrise/sunset and day info
            const sunriseTime = prayerTimesData['Sunrise'] ? prayerTimesData['Sunrise'].split(' ')[0] : '--:--';
            const sunsetTime = prayerTimesData['Sunset'] ? prayerTimesData['Sunset'].split(' ')[0] : '--:--';

            // Update labels and values for sunrise/sunset
            document.querySelector('.next-prayer-info-label').textContent = 'Sunrise';
            document.getElementById('nextPrayerName').textContent = formatTime(sunriseTime);

            document.querySelector('.next-prayer-time-label').textContent = 'Sunset';
            document.getElementById('nextPrayerTime').textContent = formatTime(sunsetTime);

            // Calculate and show daylight duration and Islamic date
            if (prayerTimesData['Sunrise'] && prayerTimesData['Sunset']) {
                const sunrise = parseTimeString(sunriseTime, currentViewedDate);
                const sunset = parseTimeString(sunsetTime, currentViewedDate);
                const daylightMs = sunset - sunrise;
                const hours = Math.floor(daylightMs / (1000 * 60 * 60));
                const minutes = Math.floor((daylightMs % (1000 * 60 * 60)) / (1000 * 60));

                // Show daylight duration
                document.querySelector('.countdown-label').textContent = 'Moon Phase';
                document.querySelector('.countdown-label').style.display = 'block';

                // Create summary with daylight duration and Islamic date (moon phase indicator)
                let summaryText = `☀️ ${hours}h ${minutes}m daylight`;
                if (currentHijriData) {
                    const hijriDay = parseInt(currentHijriData.day);
                    let moonPhase = '';
                    if (hijriDay === 1) moonPhase = '🌑 New Moon';
                    else if (hijriDay < 7) moonPhase = '🌒 Waxing Crescent';
                    else if (hijriDay < 14) moonPhase = '🌓 First Quarter';
                    else if (hijriDay === 14 || hijriDay === 15) moonPhase = '🌕 Full Moon';
                    else if (hijriDay < 22) moonPhase = '🌗 Last Quarter';
                    else moonPhase = '🌘 Waning Crescent';

                    summaryText = `${moonPhase}`;
                }

                document.getElementById('countdown').textContent = summaryText;
                document.getElementById('countdown').style.display = 'block';
            } else {
                document.querySelector('.countdown-label').style.display = 'none';
                document.getElementById('countdown').style.display = 'none';
            }
        }

        nextPrayerInfo = null;
        showingTomorrow = false;
        return;
    }

    // Restore original labels when viewing today
    document.querySelector('.next-prayer-info-label').textContent = 'Next Prayer';
    document.querySelector('.next-prayer-time-label').textContent = 'Prayer Time';
    document.querySelector('.countdown-label').textContent = 'Time Remaining';

    // Restore visibility of all sections
    document.querySelector('.next-prayer-info').style.display = 'flex';
    document.querySelector('.next-prayer-time-info').style.display = 'flex';

    // Show countdown and label when viewing today
    const countdownElements = document.querySelectorAll('.countdown-label, #countdown');
    countdownElements.forEach(el => el.style.display = 'block');

    // Only include the 5 main prayers for "next prayer" determination
    const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    const now = new Date();

    let nextPrayer = null;

    for (const prayer of prayers) {
        if (!prayerTimesData[prayer]) continue;

        const timeString = prayerTimesData[prayer].split(' ')[0];
        const prayerTime = parseTimeString(timeString, todayDate);

        if (prayerTime > now) {
            nextPrayer = {
                name: prayer,
                time: prayerTime,
                timeString: timeString
            };
            break;
        }
    }

    // If no prayer found today, it means all prayers have passed
    if (!nextPrayer) {
        // Hide next prayer and prayer time sections
        document.querySelector('.next-prayer-info').style.display = 'none';
        document.querySelector('.next-prayer-time-info').style.display = 'none';

        // Hide the countdown label but show the countdown message
        document.querySelector('.countdown-label').style.display = 'none';
        document.getElementById('countdown').style.display = 'block';

        // Add all-complete class to countdown-info
        const countdownInfo = document.querySelector('.countdown-info');
        countdownInfo.classList.add('all-complete');

        // Set the completion message with two lines
        document.getElementById('countdown').innerHTML = `
            <div class="complete-main">🌙 All prayers complete today</div>
            <div class="complete-sub">May your prayers be accepted</div>
        `;

        nextPrayerInfo = null;
        showingTomorrow = true;
    } else {
        // Restore visibility of all sections
        document.querySelector('.next-prayer-info').style.display = 'flex';
        document.querySelector('.next-prayer-time-info').style.display = 'flex';
        document.querySelector('.countdown-label').style.display = 'block';

        // Remove all-complete class from countdown-info
        const countdownInfo = document.querySelector('.countdown-info');
        countdownInfo.classList.remove('all-complete');

        // Check if mobile - show current time in nextPrayerName, prayer name in nextPrayerTime
        if (isMobileViewport()) {
            const now = new Date();
            const tzOpts = locationTimezone ? { timeZone: locationTimezone } : {};
            const currentTimeString = now.toLocaleTimeString('en-US', {
                ...tzOpts, hour: 'numeric', minute: '2-digit', hour12: true
            });
            document.getElementById('nextPrayerName').textContent = currentTimeString;
            document.getElementById('nextPrayerTime').textContent = nextPrayer.name;
        } else {
            document.getElementById('nextPrayerName').textContent = nextPrayer.name;
            document.getElementById('nextPrayerTime').textContent = formatTime(nextPrayer.timeString);
        }

        const countdownEls = document.querySelectorAll('.countdown-label, #countdown');
        countdownEls.forEach(el => el.style.display = 'block');
        nextPrayerInfo = nextPrayer;
        showingTomorrow = false;
    }
}

// Update countdown
function updateCountdown() {
    if (!nextPrayerInfo || !nextPrayerInfo.time) {
        return;
    }

    const now = new Date();
    const diff = nextPrayerInfo.time - now;

    if (diff <= 0) {
        // Prayer time has arrived, refresh data
        fetchPrayerTimes();
        return;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const countdownText = `${hours}h ${minutes}m ${seconds}s remaining`;
    document.getElementById('countdown').textContent = countdownText;
}

setInterval(updateCountdown, 1000);

// Check if we're in Ramadan and show special times
function checkRamadanMode() {
    // Ramadan dates - Update these each year:
    // 2025: March 1 - March 30
    // 2026: February 17 - March 18
    const now = new Date();
    const year = now.getFullYear();

    let ramadanStart, ramadanEnd;
    if (year === 2025) {
        ramadanStart = new Date(2025, 2, 1); // March 1, 2025 (month is 0-indexed)
        ramadanEnd = new Date(2025, 2, 30); // March 30, 2025
    } else if (year === 2026) {
        ramadanStart = new Date(2026, 1, 17); // February 17, 2026 (month is 0-indexed)
        ramadanEnd = new Date(2026, 2, 18); // March 18, 2026
    } else {
        // Default to not Ramadan if year not configured
        ramadanStart = new Date(2099, 0, 1);
        ramadanEnd = new Date(2099, 0, 1);
    }

    // Compare only the date parts (ignore time)
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startDate = new Date(ramadanStart.getFullYear(), ramadanStart.getMonth(), ramadanStart.getDate());
    const endDate = new Date(ramadanEnd.getFullYear(), ramadanEnd.getMonth(), ramadanEnd.getDate());

    isRamadan = RAMADAN_TEST_MODE || (todayDate >= startDate && todayDate <= endDate);

    // Apply theme based on user preference
    applyTheme();

    // Re-render prayer times to apply Ramadan styling
    displayPrayerTimes();
}

// Apply theme based on settings and Ramadan status
function applyTheme() {
    const body = document.body;

    // Remove all theme classes first
    body.classList.remove('ramadan-mode', 'kids-mode');

    if (settings.theme === 'auto') {
        // Auto mode: apply Ramadan theme during Ramadan
        if (isRamadan) {
            body.classList.add('ramadan-mode');
        }
    } else if (settings.theme === 'ramadan') {
        // Always use Ramadan theme
        body.classList.add('ramadan-mode');
    } else if (settings.theme === 'kids') {
        // Kids theme
        body.classList.add('kids-mode');
    }
    // else: Default theme (no class needed)
}

// ==================== DATE NAVIGATION FUNCTIONS ====================

// Debounce navigation to prevent rapid clicks
let navigationDebounceTimer = null;
function navigateDateDebounced(offset) {
    clearTimeout(navigationDebounceTimer);

    // Get the clicked button
    const prevButton = document.getElementById('dateNavPrev');
    const nextButton = document.getElementById('dateNavNext');
    const clickedButton = offset < 0 ? prevButton : nextButton;

    // Add visual feedback
    clickedButton.classList.add('pressing');

    // Disable buttons during navigation
    prevButton.disabled = true;
    nextButton.disabled = true;

    navigationDebounceTimer = setTimeout(() => {
        // Remove pressing class
        clickedButton.classList.remove('pressing');
        navigateDate(offset);
    }, 150);
}

// Navigate to different date
function navigateDate(offset) {
    const prayerGrid = document.getElementById('prayerGrid');
    const prayerSection = document.querySelector('.next-prayer-section');

    // Determine animation direction
    const slideOutClass = offset > 0 ? 'slide-out-left' : 'slide-out-right';
    const slideInClass = offset > 0 ? 'slide-in-right' : 'slide-in-left';

    // Add slide-out animation
    prayerGrid.classList.add(slideOutClass);
    prayerSection.classList.add(slideOutClass);

    // Wait for slide-out animation to complete
    setTimeout(() => {
        // Remove slide-out classes
        prayerGrid.classList.remove(slideOutClass);
        prayerSection.classList.remove(slideOutClass);

        // Update date and load new data
        currentViewedDate = addDays(currentViewedDate, offset);
        loadPrayerTimesForCurrentView();

        // Add slide-in animation
        prayerGrid.classList.add(slideInClass);
        prayerSection.classList.add(slideInClass);

        // Remove slide-in classes after animation completes
        setTimeout(() => {
            prayerGrid.classList.remove(slideInClass);
            prayerSection.classList.remove(slideInClass);
        }, 300);
    }, 300);
}

// Navigate back to today
function navigateToToday() {
    currentViewedDate = new Date(todayDate);
    loadPrayerTimesForCurrentView();
}

// Update the date navigation UI elements
function updateDateNavigationUI() {
    const isToday = isSameDay(currentViewedDate, todayDate);
    const badge = document.getElementById('dateNavigationBadge');
    const label = document.getElementById('viewedDateLabel');
    const prayerSection = document.querySelector('.next-prayer-section');

    if (isToday) {
        label.textContent = 'Today';
        badge.style.display = 'none'; // Hide badge when viewing today
        prayerSection.classList.remove('viewing-different-date'); // Back to 3 columns
    } else {
        const dayDiff = Math.floor((currentViewedDate - todayDate) / (1000 * 60 * 60 * 24));

        if (dayDiff === 1) {
            label.textContent = 'Tomorrow';
        } else if (dayDiff === -1) {
            label.textContent = 'Yesterday';
        } else {
            label.textContent = currentViewedDate.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: currentViewedDate.getFullYear() !== todayDate.getFullYear() ? 'numeric' : undefined
            });
        }

        badge.style.display = 'flex'; // Show badge as flex column
        prayerSection.classList.add('viewing-different-date'); // Switch to 4 columns
    }

    // Update Gregorian date display (always show viewed date)
    updateGregorianDateForViewed();

    // Enable/disable navigation buttons based on cache availability
    updateNavigationButtons();
}

// Enable/disable navigation buttons
function updateNavigationButtons() {
    const prevButton = document.getElementById('dateNavPrev');
    const nextButton = document.getElementById('dateNavNext');

    // Can navigate back 1 day, forward 30 days
    const daysSinceToday = Math.floor((currentViewedDate - todayDate) / (1000 * 60 * 60 * 24));

    prevButton.disabled = daysSinceToday <= -1;
    nextButton.disabled = daysSinceToday >= 30;
}

// ==================== SWIPE GESTURE HANDLING ====================

let touchStartX = 0;
let touchEndX = 0;
let touchStartY = 0;
let touchEndY = 0;
let isSwiping = false;
const SWIPE_THRESHOLD = 50; // Minimum distance for a swipe

function handleSwipeGesture() {
    const swipeDistance = touchEndX - touchStartX;
    const verticalDistance = Math.abs(touchEndY - touchStartY);

    // Only process horizontal swipes (vertical distance should be small)
    if (verticalDistance > 50) {
        isSwiping = false;
        return;
    }

    // Right swipe (go to previous day)
    if (swipeDistance > SWIPE_THRESHOLD) {
        const prevButton = document.getElementById('dateNavPrev');
        if (!prevButton.disabled) {
            prevButton.classList.add('pressing');
            setTimeout(() => prevButton.classList.remove('pressing'), 300);
        }
        navigateDateDebounced(-1);
    }
    // Left swipe (go to next day)
    else if (swipeDistance < -SWIPE_THRESHOLD) {
        const nextButton = document.getElementById('dateNavNext');
        if (!nextButton.disabled) {
            nextButton.classList.add('pressing');
            setTimeout(() => nextButton.classList.remove('pressing'), 300);
        }
        navigateDateDebounced(1);
    }

    isSwiping = false;
}

// Add touch event listeners to the document body
document.addEventListener('touchstart', (e) => {
    // Don't interfere with modal interactions
    if (e.target.closest('.settings-modal, .prayer-modal, .prayer-details-modal')) {
        return;
    }

    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
    isSwiping = true;
}, { passive: true });

document.addEventListener('touchmove', (e) => {
    if (!isSwiping) return;

    // Optional: Add subtle visual feedback during swipe
    const currentX = e.changedTouches[0].screenX;
    const diff = currentX - touchStartX;

    // Only show feedback for horizontal swipes
    if (Math.abs(diff) > 10) {
        const prayerGrid = document.getElementById('prayerGrid');
        const opacity = Math.max(0.7, 1 - Math.abs(diff) / 200);
        prayerGrid.style.opacity = opacity;
    }
}, { passive: true });

document.addEventListener('touchend', (e) => {
    // Don't interfere with modal interactions
    if (e.target.closest('.settings-modal, .prayer-modal, .prayer-details-modal')) {
        return;
    }

    if (isSwiping) {
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;

        // Reset opacity
        const prayerGrid = document.getElementById('prayerGrid');
        prayerGrid.style.opacity = '1';

        handleSwipeGesture();
    }
}, { passive: true });

// Initialize
initializePrayerTimes();

// Set initial athan audio source
updateAthanAudioSource();

// Refresh prayer times at midnight
setInterval(() => {
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() === 0) {
        // Reset dates and reinitialize
        todayDate = new Date();
        currentViewedDate = new Date(todayDate);
        cleanExpiredEntries();
        savePrayerCache();
        initializePrayerTimes();
        lastAnnouncedPrayer = null; // Reset announced prayer at midnight
    }
}, 60000); // Check every minute

// Check for prayer time and play athan
function checkPrayerTime() {
    // Only check if we have prayer data and are viewing today
    if (!prayerTimesData || !todayDate || !currentViewedDate) return;

    // CRITICAL: Only play athan when viewing today, not when browsing other dates
    if (!isSameDay(currentViewedDate, todayDate)) return;

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Only check the 5 main prayers
    const mainPrayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

    for (const prayer of mainPrayers) {
        if (!prayerTimesData[prayer]) continue;

        const prayerTimeString = prayerTimesData[prayer].split(' ')[0];

        // Validate prayer time format before comparing
        if (!prayerTimeString || prayerTimeString.length < 4) continue;

        // Check if current time matches prayer time and hasn't been announced yet
        if (currentTime === prayerTimeString && lastAnnouncedPrayer !== prayer) {
            playAthan(prayer, prayerTimeString);
            lastAnnouncedPrayer = prayer;
            break;
        }
    }
}

// Play athan and show modal
function playAthan(prayerName, prayerTime) {
    const modal = document.getElementById('prayerModal');
    const audio = document.getElementById('athanAudio');

    // Update modal content
    document.getElementById('modalPrayerName').textContent = `${prayerName} Prayer Time`;
    document.getElementById('modalPrayerTime').textContent = formatTime(prayerTime);

    // Add prayer info if available
    const infoDiv = document.getElementById('modalPrayerInfo');
    if (PRAYER_INFO[prayerName]) {
        const info = PRAYER_INFO[prayerName];
        const rakatsText = info.rakats.map(r => {
            const label = r.required ? `${r.count} ${r.type} (Required)` : `${r.count} ${r.type}`;
            return label;
        }).join(' + ');
        infoDiv.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 5px;">${info.icon} ${rakatsText}</div>
            <div style="font-size: 13px; opacity: 0.9;">${info.description}</div>
        `;
        infoDiv.style.display = 'block';
    } else {
        infoDiv.style.display = 'none';
    }

    // Show modal
    modal.classList.add('show');

    // Auto-close modal when athan finishes
    audio.onended = function() {
        stopAthan();
    };

    // Play audio
    audio.currentTime = 0;
    audio.play().catch(error => {
        console.error('Error playing athan:', error);
    });
}

// Stop athan and close modal
function stopAthan() {
    const modal = document.getElementById('prayerModal');
    const audio = document.getElementById('athanAudio');

    // Stop audio
    audio.pause();
    audio.currentTime = 0;

    // Hide modal
    modal.classList.remove('show');
}

// Update the athan audio source based on settings
function updateAthanAudioSource() {
    const audio = document.getElementById('athanAudio');
    const source = audio.querySelector('source');
    const athanFile = `athan/${settings.athan}.mp3`;

    // Only update if the source has changed
    if (source.src !== athanFile) {
        source.src = athanFile;
        audio.load(); // Reload the audio element with new source
    }
}

// Preview the selected athan (play/stop toggle)
function previewAthan() {
    const athanSelect = document.getElementById('athanSelect');
    const previewButton = document.getElementById('previewAthanButton');
    const selectedAthan = athanSelect.value;
    const audio = document.getElementById('athanAudio');
    const source = audio.querySelector('source');

    // Check if audio is currently playing
    if (!audio.paused) {
        // Stop the audio
        audio.pause();
        audio.currentTime = 0;
        previewButton.innerHTML = '🔊 Play';
        return;
    }

    // Update audio source to selected athan
    const previewFile = `athan/${selectedAthan}.mp3`;
    source.src = previewFile;
    audio.load();

    // Change button to stop state
    previewButton.innerHTML = '⏹ Stop';

    // Play the full athan
    audio.currentTime = 0;
    audio.play().catch(error => {
        console.error('Error playing athan:', error);
        alert('Unable to play athan. Please check your audio settings.');
        previewButton.innerHTML = '🔊 Play';
    });

    // Reset button when audio ends
    audio.onended = function() {
        previewButton.innerHTML = '🔊 Play';
    };
}

// Play athan manually (called from button)
function playAthanManually() {
    const now = new Date();
    const currentTimeFormatted = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });

    // Show modal with current time
    const modal = document.getElementById('prayerModal');
    const audio = document.getElementById('athanAudio');

    document.getElementById('modalPrayerName').textContent = 'Athan';
    document.getElementById('modalPrayerTime').textContent = currentTimeFormatted;

    // Show modal
    modal.classList.add('show');

    // Auto-close modal when athan finishes
    audio.onended = function() {
        stopAthan();
    };

    // Play audio
    audio.currentTime = 0;
    audio.play().catch(error => {
        console.error('Error playing athan:', error);
    });
}

// Check for prayer time every second
setInterval(checkPrayerTime, 1000);

// Audio element setup - ensure it stays playing
const athanAudio = document.getElementById('athanAudio');

// Handle audio errors
athanAudio.onerror = function(e) {
    console.error('Audio error:', e);
};

// Handle audio stalling
athanAudio.onstalled = function() {
    console.warn('Audio stalled, attempting to resume...');
};

// Handle audio suspension (browser paused it)
athanAudio.onsuspend = function() {
    console.warn('Audio suspended by browser');
};

// Log when audio starts playing
athanAudio.onplay = function() {
    console.log('Athan started playing');
};

// Log when audio is paused
athanAudio.onpause = function() {
    console.log('Athan paused');
};


// Show prayer details modal
function showPrayerDetails(prayerName, prayerTime) {
    const modal = document.getElementById('prayerDetailsModal');
    const info = PRAYER_INFO[prayerName];

    if (!info) return;

    // Update modal content
    document.getElementById('detailsPrayerName').textContent = `${info.icon} ${prayerName}`;
    document.getElementById('detailsPrayerTime').textContent = formatTime(prayerTime);

    // Build rakats info with required/optional distinction
    const rakatsHtml = info.rakats.map(r => {
        const requiredClass = r.required ? 'rakat-required' : 'rakat-optional';
        const requiredLabel = r.required ? ' (Required)' : ' (Optional)';
        return `<div class="rakat-item ${requiredClass}">
            <span class="rakat-type">${r.type}${requiredLabel}:</span>
            ${r.count} Rakat${r.count > 1 ? 's' : ''}
        </div>`;
    }).join('');
    document.getElementById('rakatsInfo').innerHTML = rakatsHtml;

    // Set description
    document.getElementById('prayerDescription').textContent = info.description;

    // Show modal
    modal.classList.add('show');
}

// Close prayer details modal
function closePrayerDetails() {
    const modal = document.getElementById('prayerDetailsModal');
    modal.classList.remove('show');
}

// ==================== ONLINE/OFFLINE EVENT LISTENERS ====================

// Handle coming back online
window.addEventListener('online', () => {
    console.log('Back online - refreshing current view');
    if (currentViewedDate && todayDate) {
        loadPrayerTimesForCurrentView();
    }
});

// Handle going offline
window.addEventListener('offline', () => {
    console.log('Offline mode - using cached data');
});

// Handle window resize to reposition sundial icon
window.addEventListener('resize', () => {
    updateSundialIcon();
});

// ==================== MODAL BACKDROP CLICK HANDLERS ====================

// Close modals when clicking on backdrop (outside modal content)
document.getElementById('prayerModal').addEventListener('click', (e) => {
    if (e.target.id === 'prayerModal') {
        stopAthan();
    }
});

document.getElementById('prayerDetailsModal').addEventListener('click', (e) => {
    if (e.target.id === 'prayerDetailsModal') {
        closePrayerDetails();
    }
});

