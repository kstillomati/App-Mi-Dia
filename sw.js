// ═══════════════════════════════════════════
//  MiDía — Service Worker v3
//  Soporta: cache offline + notificaciones locales
// ═══════════════════════════════════════════

const CACHE_NAME = 'midia-v3';
const CACHE_FILES = ['./midia.html', './sw.js'];

// ── INSTALL: cachear archivos
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(CACHE_FILES).catch(() => { }))
  );
});

// ── ACTIVATE: limpiar caches viejas
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── FETCH: offline-first
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match('./midia.html'));
    })
  );
});

// ── NOTIFICACIONES PROGRAMADAS
//    El cliente manda mensajes con los items a notificar y cuándo
let timers = [];

self.addEventListener('message', e => {
  const msg = e.data;
  if (!msg) return;

  // Limpiar timers anteriores
  if (msg.type === 'SCHEDULE_NOTIFICATIONS') {
    timers.forEach(t => clearTimeout(t));
    timers = [];

    const items = msg.items || [];
    const now = Date.now();

    items.forEach(item => {
      const delay = item.fireAt - now;
      // Solo programamos notificaciones en las próximas 48 horas
      if (delay >= 0 && delay <= 172800000) {
        const t = setTimeout(() => {
          self.registration.showNotification(item.title, {
            body: item.body,
            icon: item.icon || './icon.png',
            badge: item.badge || './icon.png',
            tag: item.tag || item.id,
            renotify: true,
            vibrate: [200, 100, 200, 100, 200],
            data: { url: './' },
            actions: [{ action: 'open', title: '📱 Abrir app' }]
          });
        }, delay);
        timers.push(t);
      }
    });

    // Responder al cliente
    e.source?.postMessage({ type: 'NOTIFICATIONS_SCHEDULED', count: items.length });
  }

  // Test de notificación inmediata
  if (msg.type === 'TEST_NOTIFICATION') {
    self.registration.showNotification('✅ Notificaciones activas', {
      body: '¡Todo listo! MiDía te va a avisar de tus pendientes.',
      tag: 'test',
      vibrate: [200, 100, 200],
      data: { url: './' }
    });
  }
});

// ── CLICK EN NOTIFICACIÓN → abrir app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      // Si la app ya está abierta, enfocarla
      for (const c of cs) {
        if (c.url.includes('midia') && 'focus' in c) return c.focus();
      }
      // Si no, abrirla
      return self.clients.openWindow('./midia.html');
    })
  );
});

// ── PUSH (para futura integración con servidor)
self.addEventListener('push', e => {
  if (!e.data) return;
  try {
    const payload = e.data.json();
    e.waitUntil(
      self.registration.showNotification(payload.title || '📅 MiDía', {
        body: payload.body || '',
        tag: payload.tag || 'push',
        vibrate: [200, 100, 200],
        data: { url: './' }
      })
    );
  } catch (_) { }
});
