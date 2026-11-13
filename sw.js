// Recite Mark offline worker. VERSION changes on every build so phones pick up the new app.
const VERSION = 'rm-b1fad7ca1b';
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
    // Online: newest app. Offline: the saved copy. Weak signal: after 4 s open the saved copy instead of waiting
    // (the newer copy still downloads and is used next time). resumepatch, 2026-11-13.
    const net = fetch(r, { cache: 'no-store' }).then(res => { if (res.ok) { const cp = res.clone(); e.waitUntil(caches.open(VERSION).then(c => c.put('index.html', cp))); } return res; });
    e.waitUntil(net.catch(() => {}));
    e.respondWith(new Promise(done => {
      let sent = false; const send = x => { if (!sent && x) { sent = true; done(x); } };
      const saved = () => caches.match('index.html');
      const t = setTimeout(() => saved().then(send), 4000);
      net.then(res => { clearTimeout(t); if (res.ok) send(res); else saved().then(c => send(c || res)); },
        () => { clearTimeout(t); saved().then(c => send(c || Response.error())); });
    }));
    return;
  }
  e.respondWith(caches.match(r).then(hit => hit || fetch(r)));
});
// Phone notifications from the team relay (relaypatch2). The push has no text: the app saved who this phone is.
self.addEventListener('push', e => {
  // an app that is already open checks the relay right away (relaypatch4)
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => ws.forEach(w => { try { w.postMessage({ rl: 'check' }); } catch (x) {} })).catch(() => {}));
  e.waitUntil(caches.open('rm-push').then(c => c.match(self.registration.scope + '__push-role')).then(r => r ? r.json() : {}).catch(() => ({})).then(o =>
    // a quizzer's phone peeks at its own box (only the code kind letter is readable) to tell a plan from a nudge
    (o.quiz && o.url && o.qbox ? fetch(o.url + '/m/' + o.qbox, { cache: 'no-store' }).then(r => r.json()).then(j => (j.items || []).map(x => String(x.body).slice(5, 6))).catch(() => []) : Promise.resolve([])).then(kinds => {
    const coach = o.coachName || 'your coach';
    const body = o.coach && !o.quiz ? 'A quizzer sent a report. Tap to open.' : o.quiz && !o.coach ? (kinds.includes('P') ? 'New plan from ' + coach + '. Tap to open.' : kinds.includes('N') ? 'Message from ' + coach + '. Tap to read it.' : 'Something new from ' + coach + '. Tap to open.') : 'Something new from your TBQ team. Tap to open.';
    return self.registration.showNotification('Recite Mark', { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'tbq-relay', renotify: true, requireInteraction: true });
  })));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
    for (const w of ws) if ('focus' in w) { try { w.postMessage({ rl: 'check' }); } catch (x) {} return w.focus(); }
    return clients.openWindow('./?rl=1');
  }));
});
