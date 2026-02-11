const ZIP_CODE = "11426";
const COUNTRY = "US";
const CALCULATION_METHOD = 2; // ISNA method

// Set to true to test Ramadan mode year-round
const RAMADAN_TEST_MODE = false;

let prayerTimesData = null;
let nextPrayerInfo = null;
let isRamadan = false;
let lastAnnouncedPrayer = null;

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

// Fetch prayer times
async function fetchPrayerTimes() {
    try {
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const year = today.getFullYear();

        // Use timingsByAddress endpoint which works with current dates
        const response = await fetch(
            `https://api.aladhan.com/v1/timingsByAddress/${day}-${month}-${year}?address=${ZIP_CODE},${COUNTRY}&method=${CALCULATION_METHOD}`
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

// Display prayer times
function displayPrayerTimes() {
    // All prayer times to display
    const prayerList = [
        { key: 'Imsak', name: 'Sehri', label: 'Stop Eating (Suhoor)', isRamadanSpecial: true },
        { key: 'Fajr', name: 'Fajr', label: 'Dawn Prayer' },
        { key: 'Sunrise', name: 'Sunrise', label: 'Sunrise' },
        { key: 'Dhuhr', name: 'Dhuhr', label: 'Noon Prayer' },
        { key: 'Asr', name: 'Asr', label: 'Afternoon Prayer' },
        { key: 'Maghrib', name: 'Maghrib', label: 'Sunset Prayer', isRamadanSpecial: true },
        { key: 'Isha', name: 'Isha', label: 'Night Prayer' },
        { key: 'Midnight', name: 'Midnight', label: 'Islamic Midnight' }
    ];

    const grid = document.getElementById('prayerGrid');
    grid.innerHTML = '';

    const now = new Date();

    prayerList.forEach(prayer => {
        // Skip if prayer time not available
        if (!prayerTimesData[prayer.key]) return;

        const timeString = prayerTimesData[prayer.key].split(' ')[0];
        const prayerTime = parseTimeString(timeString);

        const card = document.createElement('div');
        card.className = 'prayer-card';

        // Check if this is the next prayer
        if (nextPrayerInfo && nextPrayerInfo.name === prayer.key) {
            card.classList.add('active');
        }

        // Highlight Ramadan special times
        if (isRamadan && prayer.isRamadanSpecial) {
            card.classList.add('ramadan-special');
        }

        // Check if prayer has passed
        if (prayerTime < now) {
            card.classList.add('passed');
        }

        const status = prayerTime > now ? 'Upcoming' : 'Completed';

        let ramadanLabel = '';
        if (isRamadan && prayer.isRamadanSpecial) {
            if (prayer.key === 'Imsak') {
                ramadanLabel = '<div class="prayer-label">Seheri / Suhoor</div>';
            } else if (prayer.key === 'Maghrib') {
                ramadanLabel = '<div class="prayer-label">Iftar Time</div>';
            }
        }

        card.innerHTML = `
            ${ramadanLabel}
            <div class="prayer-name">${prayer.name}</div>
            <div class="prayer-time">${formatTime(timeString)}</div>
            <div class="prayer-status">${status}</div>
        `;

        grid.appendChild(card);
    });
}

// Parse time string to Date object
function parseTimeString(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
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

// Update next prayer
function updateNextPrayer() {
    // Only include the 5 main prayers for "next prayer" determination
    const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    const now = new Date();

    let nextPrayer = null;

    for (const prayer of prayers) {
        if (!prayerTimesData[prayer]) continue;

        const timeString = prayerTimesData[prayer].split(' ')[0];
        const prayerTime = parseTimeString(timeString);

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
        nextPrayer = {
            name: 'Fajr',
            time: null,
            timeString: prayerTimesData['Fajr'].split(' ')[0]
        };
        document.getElementById('nextPrayerName').textContent = 'Fajr (Tomorrow)';
        document.getElementById('nextPrayerTime').textContent = formatTime(nextPrayer.timeString);
        document.getElementById('countdown').textContent = 'All prayers completed for today';
    } else {
        document.getElementById('nextPrayerName').textContent = nextPrayer.name;
        document.getElementById('nextPrayerTime').textContent = formatTime(nextPrayer.timeString);
    }

    nextPrayerInfo = nextPrayer;
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
        document.getElementById('ramadanBanner').style.display = 'block';

        // Suhoor ends at Imsak time (or Fajr if Imsak not available)
        const suhoorTime = prayerTimesData['Imsak'] || prayerTimesData['Fajr'];
        const suhoorTimeString = suhoorTime.split(' ')[0];
        document.getElementById('suhoorTime').textContent = formatTime(suhoorTimeString);

        // Iftar is at Maghrib time
        const maghribTime = prayerTimesData['Maghrib'].split(' ')[0];
        document.getElementById('iftarTime').textContent = formatTime(maghribTime);
    }

    // Re-render prayer times to apply Ramadan styling
    displayPrayerTimes();
}

// Initialize
fetchPrayerTimes();

// Refresh prayer times at midnight
setInterval(() => {
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() === 0) {
        fetchPrayerTimes();
        fetchHijriDate();
        updateGregorianDate();
        lastAnnouncedPrayer = null; // Reset announced prayer at midnight
    }
}, 60000); // Check every minute

// Check for prayer time and play athan
function checkPrayerTime() {
    if (!prayerTimesData) return;

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Only check the 5 main prayers
    const mainPrayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

    for (const prayer of mainPrayers) {
        if (!prayerTimesData[prayer]) continue;

        const prayerTimeString = prayerTimesData[prayer].split(' ')[0];

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

    // Show modal
    modal.classList.add('show');

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

    // Play audio
    audio.currentTime = 0;
    audio.play().catch(error => {
        console.error('Error playing athan:', error);
    });
}

// Check for prayer time every second
setInterval(checkPrayerTime, 1000);
