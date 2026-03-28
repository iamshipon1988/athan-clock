self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil((async () => {
        const allClients = await self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true,
        });

        for (const client of allClients) {
            if ('focus' in client) {
                client.focus();
                if ('navigate' in client && event.notification.data && event.notification.data.url) {
                    client.navigate(event.notification.data.url);
                }
                return;
            }
        }

        if (self.clients.openWindow) {
            await self.clients.openWindow((event.notification.data && event.notification.data.url) || './index.html');
        }
    })());
});
