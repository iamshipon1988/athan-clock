// Settings with defaults
let settings = {
    zipCode: "11426", // Default ZIP code
    country: "US",
    theme: "auto" // auto, default, ramadan
};

const CALCULATION_METHOD = 2; // ISNA method

// Set to true to test Ramadan mode year-round
const RAMADAN_TEST_MODE = false;

// Prayer information
const PRAYER_INFO = {
    Fajr: {
        icon: '🌅',
        rakats: [
            { type: 'Sunnah', count: 2 },
            { type: 'Fard', count: 2 }
        ],
        description: 'The pre-dawn prayer. Wake up before sunrise to pray and start your day with blessings.'
    },
    Dhuhr: {
        icon: '☀️',
        rakats: [
            { type: 'Sunnah', count: 4 },
            { type: 'Fard', count: 4 },
            { type: 'Sunnah', count: 2 }
        ],
        description: 'The noon prayer. A midday break to reconnect with Allah and recharge spiritually.'
    },
    Asr: {
        icon: '🌤️',
        rakats: [
            { type: 'Sunnah', count: 4 },
            { type: 'Fard', count: 4 }
        ],
        description: 'The afternoon prayer. Performed in the late afternoon before the sun begins to set.'
    },
    Maghrib: {
        icon: '🌆',
        rakats: [
            { type: 'Fard', count: 3 },
            { type: 'Sunnah', count: 2 }
        ],
        description: 'The sunset prayer. Pray just after the sun sets and break your fast during Ramadan.'
    },
    Isha: {
        icon: '🌙',
        rakats: [
            { type: 'Sunnah', count: 4 },
            { type: 'Fard', count: 4 },
            { type: 'Sunnah', count: 2 },
            { type: 'Witr', count: 3 }
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
        settings = { ...settings, ...JSON.parse(savedSettings) };
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
            parsed.zipCode !== settings.zipCode ||
            parsed.country !== settings.country) {
            console.log('Cache invalidated: version or settings mismatch');
            prayerCache = createEmptyCache();
            return;
        }

        prayerCache = parsed;
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
        zipCode: settings.zipCode,
        country: settings.country,
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

// Update clock every second
function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
    document.getElementById('clock').textContent = timeString;
}

setInterval(updateClock, 1000);
updateClock();

// Update Gregorian date
function updateGregorianDate() {
    const now = new Date();
    const dateString = now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    document.getElementById('gregorianDate').textContent = dateString;
}

updateGregorianDate();

// Update Gregorian date to show currently viewed date
function updateGregorianDateForViewed() {
    const dateString = currentViewedDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
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

    // Fetch from API
    try {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();

        const response = await fetch(
            `https://api.aladhan.com/v1/timingsByAddress/${day}-${month}-${year}?address=${settings.zipCode},${settings.country}&method=${CALCULATION_METHOD}`
        );
        const data = await response.json();

        if (data.code === 200 && data.data && data.data.timings) {
            const timings = data.data.timings;
            const hijriData = data.data.date.hijri;

            // Cache the result
            cachePrayerTimes(date, timings, hijriData);

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

    // Validate ZIP code
    if (!settings.zipCode || settings.zipCode.trim() === '') {
        document.getElementById('prayerGrid').innerHTML = `
            <div class="loading" style="text-align: center;">
                <div style="font-size: 48px; margin-bottom: 15px;">📍</div>
                <div style="font-size: 18px; margin-bottom: 10px;">Welcome to Athan Clock!</div>
                <div style="font-size: 14px; opacity: 0.8; margin-bottom: 20px;">Please set your location to see prayer times</div>
                <button onclick="openSettings()" style="padding: 12px 24px; font-size: 14px; border: none; background: linear-gradient(135deg, #f4d571 0%, #e0c45c 100%); color: #1a4d2e; border-radius: 8px; cursor: pointer; font-weight: 600;">Open Settings</button>
            </div>
        `;
        return;
    }

    try {
        // Fetch today first (blocking)
        const todayData = await fetchPrayerTimesForDate(todayDate);
        prayerTimesData = todayData.timings;
        currentHijriData = todayData.hijriData;

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
        document.getElementById('prayerGrid').innerHTML = `
            <div class="loading" style="text-align: center;">
                <div style="font-size: 48px; margin-bottom: 15px;">⚠️</div>
                <div style="font-size: 16px; margin-bottom: 10px;">Failed to load prayer times</div>
                <div style="font-size: 13px; opacity: 0.8; margin-bottom: 15px;">Please check your internet connection</div>
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

        // Use timingsByAddress endpoint which works with current dates
        const response = await fetch(
            `https://api.aladhan.com/v1/timingsByAddress/${day}-${month}-${year}?address=${settings.zipCode},${settings.country}&method=${CALCULATION_METHOD}`
        );
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
    // All prayer times to display
    const prayerList = [
        { key: 'Imsak', name: 'Sehri', label: 'Stop Eating (Suhoor)', isRamadanSpecial: true },
        { key: 'Fajr', name: 'Fajr', label: 'Dawn Prayer' },
        { key: 'Dhuhr', name: 'Dhuhr', label: 'Noon Prayer' },
        { key: 'Asr', name: 'Asr', label: 'Afternoon Prayer' },
        { key: 'Maghrib', name: 'Maghrib', label: 'Sunset Prayer', isRamadanSpecial: true },
        { key: 'Isha', name: 'Isha', label: 'Night Prayer' }
    ];

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
                ramadanLabel = '<div class="prayer-label">Iftar Time</div>';
            }
        }

        // No tomorrow label needed (replaced by date badge)

        card.innerHTML = `
            ${ramadanLabel}
            <div class="prayer-name">${prayer.name}</div>
            <div class="prayer-time">${formatTime(timeString)}</div>
        `;

        // Add click handler for main prayers only
        const mainPrayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
        if (mainPrayers.includes(prayer.key)) {
            card.onclick = () => showPrayerDetails(prayer.key, timeString);
        }

        grid.appendChild(card);
    });
}

// Parse time string to Date object for specific date
function parseTimeString(timeString, forDate = null) {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = forDate ? new Date(forDate) : new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
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
        // Not viewing today - show sunrise/sunset and day info
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

        nextPrayerInfo = null;
        showingTomorrow = false;
        return;
    }

    // Restore original labels when viewing today
    document.querySelector('.next-prayer-info-label').textContent = 'Next Prayer';
    document.querySelector('.next-prayer-time-label').textContent = 'Prayer Time';
    document.querySelector('.countdown-label').textContent = 'Time Remaining';

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
        // Show tomorrow's Fajr as next prayer
        const tomorrowDate = addDays(todayDate, 1);
        const tomorrowCached = getCachedPrayerTimes(tomorrowDate);

        if (tomorrowCached && tomorrowCached.timings['Fajr']) {
            const fajrTimeString = tomorrowCached.timings['Fajr'].split(' ')[0];
            document.getElementById('nextPrayerName').textContent = 'Fajr';
            document.getElementById('nextPrayerTime').textContent = formatTime(fajrTimeString);
            document.getElementById('countdown').textContent = 'All prayers completed for today';
        } else {
            // Fetch tomorrow's times in background
            fetchPrayerTimesForDate(tomorrowDate).then(data => {
                const fajrTimeString = data.timings['Fajr'].split(' ')[0];
                document.getElementById('nextPrayerName').textContent = 'Fajr';
                document.getElementById('nextPrayerTime').textContent = formatTime(fajrTimeString);
                document.getElementById('countdown').textContent = 'All prayers completed for today';
            }).catch(() => {
                document.getElementById('nextPrayerName').textContent = 'Fajr';
                document.getElementById('nextPrayerTime').textContent = '--:--';
                document.getElementById('countdown').textContent = 'All prayers completed for today';
            });
        }
        nextPrayerInfo = null;
        showingTomorrow = true;
    } else {
        document.getElementById('nextPrayerName').textContent = nextPrayer.name;
        document.getElementById('nextPrayerTime').textContent = formatTime(nextPrayer.timeString);
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
        ramadanStart = new Date('2025-03-01');
        ramadanEnd = new Date('2025-03-30');
    } else if (year === 2026) {
        ramadanStart = new Date('2026-02-17');
        ramadanEnd = new Date('2026-03-18');
    } else {
        // Default to not Ramadan if year not configured
        ramadanStart = new Date('2099-01-01');
        ramadanEnd = new Date('2099-01-01');
    }

    isRamadan = RAMADAN_TEST_MODE || (now >= ramadanStart && now <= ramadanEnd);

    if (isRamadan) {
        // Show Ramadan banner
        document.getElementById('ramadanBanner').style.display = 'block';

        // Suhoor ends at Imsak time (or Fajr if Imsak not available)
        const suhoorTime = prayerTimesData['Imsak'] || prayerTimesData['Fajr'];
        const suhoorTimeString = suhoorTime.split(' ')[0];
        document.getElementById('suhoorTime').textContent = formatTime(suhoorTimeString);

        // Iftar is at Maghrib time
        const maghribTime = prayerTimesData['Maghrib'].split(' ')[0];
        document.getElementById('iftarTime').textContent = formatTime(maghribTime);
    }

    // Apply theme based on user preference
    applyTheme();

    // Re-render prayer times to apply Ramadan styling
    displayPrayerTimes();
}

// Apply theme based on settings and Ramadan status
function applyTheme() {
    const body = document.body;

    if (settings.theme === 'auto') {
        // Auto mode: apply Ramadan theme during Ramadan
        if (isRamadan) {
            body.classList.add('ramadan-mode');
        } else {
            body.classList.remove('ramadan-mode');
        }
    } else if (settings.theme === 'ramadan') {
        // Always use Ramadan theme
        body.classList.add('ramadan-mode');
    } else {
        // Default theme
        body.classList.remove('ramadan-mode');
    }
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
        const rakatsText = info.rakats.map(r => `${r.count} ${r.type}`).join(' + ');
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

// Settings Modal Functions
function openSettings() {
    const modal = document.getElementById('settingsModal');
    const zipCodeInput = document.getElementById('zipCodeInput');
    const themeSelect = document.getElementById('themeSelect');

    // Populate current settings
    zipCodeInput.value = settings.zipCode;
    themeSelect.value = settings.theme;

    // Show modal
    modal.classList.add('show');
}

function closeSettings() {
    const modal = document.getElementById('settingsModal');
    modal.classList.remove('show');
}

function saveSettings() {
    const zipCodeInput = document.getElementById('zipCodeInput');
    const themeSelect = document.getElementById('themeSelect');

    // Validate ZIP code
    const newZipCode = zipCodeInput.value.trim();
    const oldZipCode = settings.zipCode;

    // Require ZIP code to be entered
    if (!newZipCode || newZipCode === '') {
        alert('Please enter a ZIP code to see prayer times');
        return;
    }

    // Validate ZIP code format
    if (!/^\d{5}$/.test(newZipCode)) {
        alert('Please enter a valid 5-digit ZIP code');
        return;
    }

    settings.zipCode = newZipCode;

    // Update theme preference
    settings.theme = themeSelect.value;

    // Save to localStorage
    saveSettingsToStorage();

    // Apply new theme immediately
    applyTheme();

    // Clear cache and refresh if ZIP code changed
    if (newZipCode !== oldZipCode) {
        clearPrayerCache();
        initializePrayerTimes();
    }

    // Close modal
    closeSettings();

    // Show confirmation
    console.log('Settings saved:', settings);
}

// Show prayer details modal
function showPrayerDetails(prayerName, prayerTime) {
    const modal = document.getElementById('prayerDetailsModal');
    const info = PRAYER_INFO[prayerName];

    if (!info) return;

    // Update modal content
    document.getElementById('detailsPrayerName').textContent = `${info.icon} ${prayerName}`;
    document.getElementById('detailsPrayerTime').textContent = formatTime(prayerTime);

    // Build rakats info
    const rakatsHtml = info.rakats.map(r =>
        `<div class="rakat-item"><span class="rakat-type">${r.type}:</span> ${r.count} Rakat${r.count > 1 ? 's' : ''}</div>`
    ).join('');
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

document.getElementById('settingsModal').addEventListener('click', (e) => {
    if (e.target.id === 'settingsModal') {
        closeSettings();
    }
});
