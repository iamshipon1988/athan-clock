# Ramadan Athan Clock 🕌

A beautiful, accessible Islamic prayer time application with dual themes, offline caching, and date navigation. Display accurate prayer times for any location with an elegant glassmorphic interface.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

### Core Functionality
- **Accurate Prayer Times**: Fetches prayer times using the Aladhan API
- **Dual Themes**:
  - Default green theme with elegant dark aesthetic
  - Ramadan golden theme with warm, light colors
  - Auto-switching during Ramadan
- **Date Navigation**: Browse prayer times for yesterday, today, and up to 30 days in the future
- **Offline Support**: Caches up to a week of prayer times for offline access
- **Athan Audio**: Plays traditional athan at prayer times (customizable)
- **Next Prayer Countdown**: Live countdown to the next prayer

### Smart Features
- **Sunrise/Sunset Info**: When viewing future dates, displays sunrise/sunset times
- **Moon Phase Indicator**: Shows Islamic calendar-based moon phases
- **Daylight Duration**: Calculates and displays hours of daylight for any date
- **Swipe Gestures**: Navigate between dates with touch swipes on mobile
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **WCAG AA Accessible**: High contrast colors and proper text shadows for readability

### Prayer Information
- Click any prayer card to view detailed information:
  - Number of Rakats (Fard, Sunnah, Nafl)
  - Prayer descriptions and significance
  - Exact prayer times

## 🚀 Getting Started

### Prerequisites
- A modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection (for initial load and updates)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/athan-clock.git
   cd athan-clock
   ```

2. **Open the application**
   - Simply open `index.html` in your web browser
   - Or serve it using a local web server:
     ```bash
     # Using Python 3
     python -m http.server 8000

     # Using Node.js
     npx serve
     ```

3. **Configure your location**
   - Click the settings (⚙️) button
   - Enter your ZIP code
   - Choose your theme preference
   - Click Save

## 🎨 Themes

### Default Theme (Green)
- Rich green gradient backgrounds
- Glassmorphic cards with blur effects
- White text with shadows for contrast
- Perfect for daily use

### Ramadan Theme (Golden)
- Warm golden/brown color palette
- Light backgrounds with high contrast text
- Special highlighting for Suhoor and Iftar times
- No text shadows for clean, accessible design

### Theme Options
- **Auto**: Automatically switches to Ramadan theme during Ramadan month
- **Default**: Always use the green theme
- **Ramadan**: Always use the golden theme

## 📱 Usage

### Navigation
- **Today**: Shows current prayer times with live countdown
- **Navigate**: Use chevron buttons (◀ ▶) to view other dates
- **Swipe**: On mobile, swipe left/right to navigate dates
- **Back to Today**: Click the button when viewing other dates

### Viewing Different Dates
When viewing future or past dates:
- **Sunrise/Sunset**: Displays sunrise and sunset times
- **Moon Phase**: Shows Islamic calendar moon phase
- **Daylight Duration**: Total hours of daylight
- Prayer times shown without "next prayer" indication

### Prayer Cards
- **Green border**: Current/upcoming prayer
- **Dimmed**: Past prayers (when viewing today)
- **Click**: View detailed prayer information
- **Ramadan Special**: Suhoor (Imsak) and Iftar (Maghrib) are highlighted

## 🔧 Technical Details

### Technologies Used
- **HTML5**: Semantic markup
- **CSS3**: Glassmorphism, gradients, animations
- **JavaScript**: Vanilla ES6+
- **API**: [Aladhan API](https://aladhan.com/prayer-times-api) for prayer times
- **Fonts**:
  - Amiri (Arabic calligraphy)
  - Libre Baskerville (numbers)
  - Poppins (UI text)

### Caching Strategy
- Stores 7 days of prayer times (today ±3 days)
- Uses localStorage for persistence
- Automatic cache invalidation after 7 days
- Stale cache used as fallback when offline
- Cache cleared when ZIP code changes

### Browser Compatibility
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Android)

## 📂 Project Structure

```
athan-clock/
├── index.html          # Main HTML structure
├── styles.css          # All styling (both themes)
├── app.js             # Application logic
├── athan.mp3          # Athan audio file
├── assets/
│   └── images/
│       ├── bg-green.jpg    # Default theme background
│       └── bg-ramadan.jpg  # Ramadan theme background
└── README.md          # This file
```

## ⚙️ Configuration

### Settings Available
1. **ZIP Code**: Enter your location's ZIP code for accurate prayer times
2. **Theme**: Choose between Auto, Default (Green), or Ramadan (Golden)

### Customization
To modify prayer calculation method, edit `app.js`:
```javascript
const CALCULATION_METHOD = 2; // ISNA (Default for North America)
```

Available methods:
- 1: University of Islamic Sciences, Karachi
- 2: Islamic Society of North America (ISNA)
- 3: Muslim World League (MWL)
- 4: Umm al-Qura, Makkah
- 5: Egyptian General Authority of Survey

## 🎯 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` | Previous day (when navigation is enabled) |
| `→` | Next day (when navigation is enabled) |
| `Esc` | Close modals |

## 🐛 Troubleshooting

### Prayer times not loading
- Check your internet connection
- Verify your ZIP code is correct
- Clear browser cache and reload

### Athan not playing
- Check browser audio permissions
- Ensure volume is turned up
- Verify `athan.mp3` file exists

### Cache issues
- Open browser DevTools → Application → Local Storage
- Clear `athanClockPrayerCache` entry
- Refresh the page

## 📝 License

MIT License - feel free to use this project for personal or commercial purposes.

## 👨‍💻 Author

**Sazzad Hossain**
- Website: [sazzad.me](https://sazzad.me)
- GitHub: [@yourusername](https://github.com/yourusername)

## 🙏 Acknowledgments

- Prayer times data from [Aladhan API](https://aladhan.com/)
- Islamic calculations based on standard methods
- Font families from Google Fonts
- Background images from [source]

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📮 Support

For issues, questions, or suggestions, please open an issue on GitHub.

---

Made with ❤️ for the Muslim community
