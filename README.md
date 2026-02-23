# Nimazi
### Your Muslim Prayer Companion

A lightweight, open-source Islamic prayer time web app. Enter any city, postal code, or address and Nimazi will deliver accurate prayer times, play the Athan at each prayer, and guide you through how to pray — with no account, no ads, and no tracking.

🌐 **Live at [nimazi.com](https://nimazi.com)**

![License](https://img.shields.io/badge/license-Personal%20Use-blue)

---

## Features

- **Accurate Prayer Times** — powered by the [Aladhan API](https://aladhan.com/prayer-times-api) for any city or location worldwide
- **Location Autocomplete** — type a city, postal code, or address with live suggestions; or tap "detect" for GPS
- **Athan Alerts** — plays the call to prayer at each prayer time with a choice of voices (Makkah, Madinah, Al-Aqsa, and more)
- **Live Countdown** — real-time countdown to the next prayer with a timezone-aware clock
- **Date Navigation** — browse prayer times up to 30 days forward or back with chevron buttons or left/right swipe
- **Prayer Detail Cards** — tap any prayer to see its Rakats, description, and significance
- **Prayer Guide** — step-by-step Wudu and Salah instructions for Fajr through Isha, Tarawih, and Eid
- **Offline Cache** — stores ±3 days of prayer times in localStorage so the app works without a connection
- **Three Themes** — Default (green), Ramadan (golden), and Kids (colorful); Auto mode switches to Ramadan theme during Ramadan
- **PWA / Add to Home Screen** — installable on iOS and Android with proper safe-area support for the iPhone home indicator
- **Onboarding** — friendly first-run modal so new users never have to hunt for the Settings page

---

## Getting Started

No setup required. Clone and open:

```bash
git clone https://github.com/iamshipon1988/nimazi.git
cd nimazi
open index.html          # macOS
# or
npx serve .              # any platform — avoids file:// quirks
```

On first load, an onboarding modal will ask for your location. Type a city name or tap the GPS icon. Settings can be changed any time via the Settings page.

---

## Themes

| Theme | When |
|-------|------|
| **Default** (green) | Year-round default |
| **Ramadan** (golden) | Manually selected, or Auto mode during Ramadan |
| **Kids** (colorful) | Family-friendly high-contrast palette |

The `auto` theme switches to Ramadan golden automatically during the Ramadan month and returns to Default after Eid.

---

## Project Structure

```
nimazi/
├── index.html          # Prayer times (main page)
├── settings.html       # Location, theme, and athan settings
├── guide.html          # Step-by-step prayer guide
├── about.html          # About, credits, and GitHub link
│
├── js/
│   ├── utils.js        # Shared utilities: Ramadan dates, location detect, autocomplete
│   ├── app.js          # Core logic: fetch, cache, display, athan, countdown
│   ├── settings.js     # Settings page: save/load preferences
│   └── guide.js        # Guide page: theme application, section toggles
│
├── css/
│   └── styles.css      # All styles — design tokens at top, themes at bottom
│
├── athan/              # Athan MP3 audio files
├── assets/             # Images, favicon, branding SVGs
└── CONTRIBUTING.md     # Contributor guide
```

---

## Technical Details

- **Vanilla JS** — no frameworks, no build step, no dependencies to install
- **APIs**: [Aladhan](https://aladhan.com) for prayer times · [Komoot Photon](https://photon.komoot.io) for location autocomplete · [BigDataCloud](https://www.bigdatacloud.com) for reverse geocoding
- **Fonts**: Amiri (Arabic) · Source Sans 3 (UI) · Material Icons
- **Caching**: localStorage, ±3 days, invalidated on location change
- **Browser support**: Chrome/Edge 90+ · Firefox 88+ · Safari 14+ · iOS Safari · Chrome Android

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` | Previous day |
| `→` | Next day |
| `Esc` | Close modal |

---

## Troubleshooting

**Prayer times not loading** — check your internet connection, try a different location, or open Settings to re-enter your city.

**Athan not playing** — browsers require a user gesture before playing audio. Tap anywhere on the page first, then wait for the next prayer time. You can also preview the athan in Settings.

**Cache issues** — open DevTools → Application → Local Storage and clear the `athanClockPrayerCache` and `athanClockSettings` keys, then refresh.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for project conventions, how to run locally, how to add a theme, and how to update the annual Ramadan dates.

---

## License

Free for personal, non-commercial use. Commercial use is not permitted without prior written permission from the author. See [LICENSE](LICENSE) for full terms.

---

## Author

**Sazzad Hossain** · [sazzad.me](https://sazzad.me) · [@iamshipon1988](https://github.com/iamshipon1988)

---

Made with care for the Muslim community.
