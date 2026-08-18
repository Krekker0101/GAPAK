self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { body: event.data ? event.data.text() : '' }; }
  const title = typeof payload.title === 'string' ? payload.title : 'GAPAK';
  const body = typeof payload.body === 'string' ? payload.body : '';
  const targetUrl = typeof payload.targetUrl === 'string' ? payload.targetUrl : '/';
  event.waitUntil(self.registration.showNotification(title, {
    body,
    data: { targetUrl },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const rawTarget = event.notification.data && typeof event.notification.data.targetUrl === 'string'
    ? event.notification.data.targetUrl
    : '/';
  let safeTarget = self.location.origin;
  try {
    const target = new URL(rawTarget, self.location.origin);
    if (target.origin === self.location.origin) safeTarget = target.href;
  } catch {
    // Malformed or cross-origin notification targets always fall back to the app root.
  }
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((windowClient) => windowClient.url.startsWith(self.location.origin));
    return existing ? existing.focus().then(() => existing.navigate(safeTarget)) : clients.openWindow(safeTarget);
  }));
});
