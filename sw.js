// Recite Mark offline worker. VERSION changes on every build so phones pick up the new app.
const VERSION = 'rm-0b068cc389';
const FILES = ["./", "index.html", "manifest.webmanifest", "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png"];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION && k !== 'rm-fonts' && k !== 'rm-push').map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open('rm-fonts').then(c => c.match(r).then(hit => hit || fetch(r).then(res => { c.put(r, res.clone()); return res; }))));
    return;
  }
  if (u.origin !== location.origin) return;
  if (r.mode === 'navigate') {
    // Online: newest app. Offline: the saved copy.
    e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(VERSION).then(c => c.put('index.html', cp)); return res; })
      .catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(r).then(hit => hit || fetch(r)));
});
// Phone notifications from the team relay (relaypatch2). The push has no text: the app saved who this phone is.
self.addEventListener('push', e => {
  e.waitUntil(caches.open('rm-push').then(c => c.match(self.registration.scope + '__push-role')).then(r => r ? r.json() : {}).catch(() => ({})).then(o => {
    const body = o.coach && !o.quiz ? 'A quizzer sent a report. Tap to open.' : o.quiz && !o.coach ? 'New plan from ' + (o.coachName || 'your coach') + '. Tap to open.' : 'Something new from your TBQ team. Tap to open.';
    return self.registration.showNotification('Recite Mark', { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'tbq-relay', renotify: true, requireInteraction: true });
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
    for (const w of ws) if ('focus' in w) { try { w.postMessage({ rl: 'check' }); } catch (x) {} return w.focus(); }
    return clients.openWindow('./');
  }));
});
