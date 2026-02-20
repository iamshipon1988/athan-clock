// Apply theme from main app settings
(function () {
    const saved = localStorage.getItem('athanClockSettings');
    if (!saved) return;
    try {
        const s = JSON.parse(saved);
        document.body.classList.remove('ramadan-mode', 'kids-mode');

        if (s.theme === 'ramadan') {
            document.body.classList.add('ramadan-mode');
        } else if (s.theme === 'kids') {
            document.body.classList.add('kids-mode');
        } else if (s.theme === 'auto') {
            const now = new Date();
            const y = now.getFullYear();
            let start, end;
            if (y === 2025) {
                start = new Date(2025, 2, 1);
                end   = new Date(2025, 2, 30);
            } else if (y === 2026) {
                start = new Date(2026, 1, 17);
                end   = new Date(2026, 2, 18);
            } else if (y === 2027) {
                start = new Date(2027, 1, 6);
                end   = new Date(2027, 2, 7);
            }
            if (start && end && now >= start && now <= end) {
                document.body.classList.add('ramadan-mode');
            }
        }
    } catch (e) { /* ignore parse errors */ }
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
