// Apply theme from main app settings.
// Ramadan dates are maintained in utils.js — update RAMADAN_DATES there each year.
(function () {
    document.body.classList.remove('ramadan-mode', 'kids-mode');

    let theme = 'auto';
    const saved = localStorage.getItem('athanClockSettings');
    if (saved) {
        try {
            const s = JSON.parse(saved);
            theme = s.theme || 'auto';
        } catch (e) { /* ignore parse errors */ }
    }

    if (theme === 'ramadan') {
        document.body.classList.add('ramadan-mode');
    } else if (theme === 'kids') {
        document.body.classList.add('kids-mode');
    } else if (theme === 'auto' && isCurrentlyRamadan()) {
        document.body.classList.add('ramadan-mode');
    }
})();

function toggleSection(id) {
    const section = document.getElementById(id);
    const body    = section.querySelector('.guide-section-body');
    const chevron = section.querySelector('.guide-chevron');
    const btn     = section.querySelector('.guide-section-header');
    const isOpen  = section.classList.contains('open');

    section.classList.toggle('open');

    if (isOpen) {
        body.style.maxHeight = '0';
        chevron.style.transform = 'rotate(0deg)';
        btn.setAttribute('aria-expanded', 'false');
    } else {
        body.style.maxHeight = body.scrollHeight + 'px';
        chevron.style.transform = 'rotate(180deg)';
        btn.setAttribute('aria-expanded', 'true');
    }
}
