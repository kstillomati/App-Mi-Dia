// ═══════════════════════════════════════════════════════
//  DATOS
// ═══════════════════════════════════════════════════════
let currentTab = 'turnos';
let historialFilter = 'todo';
let selectedPriority = 'media';
let swRegistration = null;

let data = { turnos: [], tareas: [], facu: [], historial: [] };
let prefs = { notifPromptDismissed: false, notifScheduledToday: null, resumenDismissedDate: null };

function loadData() {
  try { const s = localStorage.getItem('midia_v1'); if (s) data = { ...data, ...JSON.parse(s) }; } catch(e) {}
  try { const p = localStorage.getItem('midia_prefs'); if (p) prefs = { ...prefs, ...JSON.parse(p) }; } catch(e) {}
}
function saveData()  { try { localStorage.setItem('midia_v1',   JSON.stringify(data));  } catch(e) {} }
function savePrefs() { try { localStorage.setItem('midia_prefs', JSON.stringify(prefs)); } catch(e) {} }

// ═══════════════════════════════════════════════════════
//  NAVEGACIÓN
// ═══════════════════════════════════════════════════════
function switchTab(tab) {
  currentTab = tab;
  ['turnos','tareas','facu','historial'].forEach(t => {
    document.getElementById('tab-' + t).classList.toggle('tab-hidden', t !== tab);
    document.getElementById('nav-' + t).classList.toggle('active', t === tab);
  });
  document.getElementById('fab-btn').style.display = (tab === 'historial') ? 'none' : 'flex';
}

// ═══════════════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════════════
let toastTimer;
function showToast(msg, icon = '✅') {
  const el   = document.getElementById('toast');
  const msgEl = document.getElementById('toast-msg');
  const icoEl = document.getElementById('toast-icon');
  msgEl.textContent = msg;
  icoEl.textContent = icon;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

// ═══════════════════════════════════════════════════════
//  RESUMEN DEL DÍA
// ═══════════════════════════════════════════════════════
function renderResumen() {
  const today    = todayStr();
  const tomorrow = tomorrowStr();
  const banner   = document.getElementById('resumen-banner');
  const itemsEl  = document.getElementById('resumen-items');

  // Verificar si fue dismissed hoy
  if (prefs.resumenDismissedDate === today) { banner.classList.remove('visible'); return; }

  const allItems = [...data.turnos, ...data.tareas, ...data.facu];
  const hoy  = allItems.filter(x => x.fecha === today);
  const man  = allItems.filter(x => x.fecha === tomorrow);

  // Items con fecha en los próximos 3 días (excl hoy y mañana)
  const prox = allItems.filter(x => {
    if (!x.fecha || x.fecha === today || x.fecha === tomorrow) return false;
    const d = new Date(x.fecha + 'T00:00:00');
    const t = new Date(); t.setHours(0,0,0,0);
    const diff = Math.round((d - t) / 86400000);
    return diff > 1 && diff <= 3;
  });

  if (hoy.length === 0 && man.length === 0 && prox.length === 0) {
    banner.classList.remove('visible');
    return;
  }

  banner.classList.add('visible');
  let html = '';

  if (hoy.length > 0) {
    html += `<div class="resumen-item"><span class="resumen-item-dot dot-hoy"></span><span><strong>Hoy:</strong> ${hoy.map(x => x.titulo).slice(0,2).join(', ')}${hoy.length > 2 ? ` y ${hoy.length-2} más` : ''}</span></div>`;
  }
  if (man.length > 0) {
    html += `<div class="resumen-item"><span class="resumen-item-dot dot-manana"></span><span><strong>Mañana:</strong> ${man.map(x => x.titulo).slice(0,2).join(', ')}${man.length > 2 ? ` y ${man.length-2} más` : ''}</span></div>`;
  }
  if (prox.length > 0) {
    html += `<div class="resumen-item"><span class="resumen-item-dot dot-prox"></span><span><strong>Próximos 3 días:</strong> ${prox.length} ítem${prox.length > 1 ? 's' : ''} más</span></div>`;
  }

  itemsEl.innerHTML = html;
}

function dismissResumen() {
  prefs.resumenDismissedDate = todayStr();
  savePrefs();
  document.getElementById('resumen-banner').classList.remove('visible');
}

// ═══════════════════════════════════════════════════════
//  NOTIFICACIONES
// ═══════════════════════════════════════════════════════
function checkNotifPrompt() {
  if (prefs.notifPromptDismissed) return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'default') return;
  // Mostrar prompt después de 3s
  setTimeout(() => {
    document.getElementById('notif-prompt').classList.add('visible');
  }, 3000);
}

async function requestNotifPermission(fromSettings = false) {
  if (!('Notification' in window)) {
    showToast('Tu navegador no soporta notificaciones', '❌');
    return;
  }
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    prefs.notifPromptDismissed = true;
    savePrefs();
    document.getElementById('notif-prompt').classList.remove('visible');
    document.getElementById('notify-dot').style.display = 'none';
    showToast('¡Notificaciones activadas!', '🔔');
    scheduleNotifications();
    if (fromSettings) { updateNotifStatus(); closeNotifModal(); }
  } else {
    showToast('Permiso denegado. Activalo en Ajustes del iPhone', '⚠️');
    document.getElementById('notif-dot').style.display = 'block';
    if (fromSettings) updateNotifStatus();
  }
}

function dismissNotifPrompt() {
  prefs.notifyPromptDismissed = true;
  savePrefs();
  document.getElementById('notify-prompt').classList.remove('visible');
}

function scheduleNotifications() {
  if (Notification.permission !== 'granted') return;
  if (!swRegistration?.active) return;

  const today    = todayStr();
  const tomorrow = tomorrowStr();
  const now      = Date.now();

  // 8am mañana
  const tm8 = new Date(tomorrow + 'T08:00:00');
  // 9am mañana (backup)
  const tm9 = new Date(tomorrow + 'T09:00:00');

  const allItems = [...data.turnos, ...data.tareas, ...data.facu];

  const items = [];

  // === Notificación de HOY (solo si son las 7am o más y no fue scheduled hoy) ===
  const hoyItems = allItems.filter(x => x.fecha === today);
  if (hoyItems.length > 0 && prefs.notifScheduledToday !== today) {
    const hour = new Date().getHours();
    if (hour >= 7) {
      items.push({
        id: 'hoy-' + today,
        tag: 'hoy',
        title: `📅 Hoy tenés ${hoyItems.length} cosa${hoyItems.length > 1 ? 's' : ''}`,
        body: hoyItems.slice(0,3).map(x => '• ' + x.titulo).join('\n'),
        fireAt: now + 2000
      });
    }
  }

  // === Notificación MAÑANA a las 8am ===
  const manItems = allItems.filter(x => x.fecha === tomorrow);
  if (manItems.length > 0 && tm8.getTime() > now) {
    items.push({
      id: 'manana-' + tomorrow,
      tag: 'manana',
      title: `🌅 Mañana: ${manItems.length} cosa${manItems.length > 1 ? 's' : ''} pendiente${manItems.length > 1 ? 's' : ''}`,
      body: manItems.slice(0,3).map(x => '• ' + x.titulo).join('\n'),
      fireAt: tm8.getTime()
    });
  }

  // === Resumen diario a las 8am mañana (aunque no haya items) ===
  const totalPending = data.turnos.length + data.tareas.length + data.facu.length;
  if (totalPending > 0 && !manItems.length && tm8.getTime() > now) {
    // No hay cosas para mañana pero hay pendientes en general → aviso el resumen
    items.push({
      id: 'resumen-' + tomorrow,
      tag: 'resumen',
      title: `☀️ Buenos días, Matias!`,
      body: `Tenés ${totalPending} ítem${totalPending > 1 ? 's' : ''} pendiente${totalPending > 1 ? 's' : ''} en MiDía`,
      fireAt: tm8.getTime()
    });
  }

  if (items.length > 0) {
    swRegistration.active.postMessage({ type: 'SCHEDULE_NOTIFICATIONS', items });
    prefs.notifScheduledToday = today;
    savePrefs();
  }
}

async function sendTestNotif() {
  if (Notification.permission !== 'granted') {
    await requestNotifPermission(false);
    return;
  }
  if (!swRegistration?.active) {
    showToast('El Service Worker no está activo aún', '⚠️');
    return;
  }
  swRegistration.active.postMessage({ type: 'TEST_NOTIFICATION' });
  showToast('Notificación de prueba enviada', '🔔');
  closeNotifModal();
}

// ═══════════════════════════════════════════════════════
//  MODAL NOTIFICACIONES
// ═══════════════════════════════════════════════════════
function openNotifSettings() {
  updateNotifStatus();
  document.getElementById('notif-modal-overlay').classList.add('open');
}
function closeNotifModal() {
  document.getElementById('notif-modal-overlay').classList.remove('open');
}
function handleNotifOverlayClick(e) {
  if (e.target === document.getElementById('notif-modal-overlay')) closeNotifModal();
}

function updateNotifStatus() {
  const permEl  = document.getElementById('ns-perm');
  const swEl    = document.getElementById('ns-sw');
  const httpsEl = document.getElementById('ns-https');

  // Permiso
  const perm = Notification?.permission || 'no soportado';
  const permLabels = { granted: 'Activado', denied: 'Denegado', default: 'Sin decidir' };
  permEl.textContent  = permLabels[perm] || perm;
  permEl.className    = 'notif-status ' + (perm === 'granted' ? 'on' : 'off');

  // Service Worker
  swEl.textContent = swRegistration?.active ? 'Activo' : 'Inactivo';
  swEl.className   = 'notif-status ' + (swRegistration?.active ? 'on' : 'off');

  // HTTPS
  const isHttps = location.protocol === 'https:' || location.hostname === 'localhost' || location.protocol === 'file:';
  httpsEl.textContent = isHttps ? 'OK' : 'Falta HTTPS';
  httpsEl.className   = 'notif-status ' + (isHttps ? 'on' : 'off');
}

// ═══════════════════════════════════════════════════════
//  MODAL ITEMS
// ═══════════════════════════════════════════════════════
const FORMS = {
  turnos: {
    title: '🏥 Nuevo Turno Médico',
    build: () => `
      <div class="form-group"><label class="form-label">Especialidad / Médico *</label><input class="form-input" id="f-titulo" placeholder="Ej: Dr. García · Cardiología" autocomplete="off"></div>
      <div class="form-group"><label class="form-label">Fecha</label><input class="form-input" id="f-fecha" type="date"></div>
      <div class="form-group"><label class="form-label">Hora</label><input class="form-input" id="f-hora" type="time"></div>
      <div class="form-group"><label class="form-label">Lugar / Dirección</label><input class="form-input" id="f-lugar" placeholder="Ej: Hospital Central, Consultorio 3" autocomplete="off"></div>
      <div class="form-group"><label class="form-label">Notas</label><textarea class="form-textarea" id="f-notas" placeholder="Recordatorios, síntomas, preguntas..."></textarea></div>
      <button class="btn-submit" onclick="addItem()">Guardar Turno</button>`
  },
  tareas: {
    title: '✅ Nueva Tarea',
    build: () => `
      <div class="form-group"><label class="form-label">Tarea *</label><input class="form-input" id="f-titulo" placeholder="¿Qué tenés que hacer?" autocomplete="off"></div>
      <div class="form-group"><label class="form-label">Descripción (opcional)</label><textarea class="form-textarea" id="f-desc" placeholder="Detalles, contexto..."></textarea></div>
      <div class="form-group"><label class="form-label">Prioridad</label>
        <div class="priority-selector">
          <button class="priority-btn" id="p-alta" onclick="selectPriority('alta')">🔴 Alta</button>
          <button class="priority-btn sel-media" id="p-media" onclick="selectPriority('media')">🟡 Media</button>
          <button class="priority-btn" id="p-baja" onclick="selectPriority('baja')">🟢 Baja</button>
        </div>
      </div>
      <div class="form-group"><label class="form-label">Fecha límite</label><input class="form-input" id="f-fecha" type="date"></div>
      <button class="btn-submit" onclick="addItem()">Guardar Tarea</button>`
  },
  facu: {
    title: '🎓 Tarea de Facultad',
    build: () => `
      <div class="form-group"><label class="form-label">Título *</label><input class="form-input" id="f-titulo" placeholder="Ej: TP2 · Base de Datos" autocomplete="off"></div>
      <div class="form-group"><label class="form-label">Materia</label><input class="form-input" id="f-materia" placeholder="Ej: Análisis de Sistemas" autocomplete="off"></div>
      <div class="form-group"><label class="form-label">Tipo</label>
        <select class="form-select" id="f-tipo">
          <option value="TP">📄 Trabajo Práctico</option>
          <option value="Parcial">📝 Parcial</option>
          <option value="Final">🎯 Final</option>
          <option value="Proyecto">💻 Proyecto</option>
          <option value="Exposición">🎤 Exposición</option>
          <option value="Lectura">📖 Lectura</option>
          <option value="Otro">📌 Otro</option>
        </select>
      </div>
      <div class="form-group"><label class="form-label">Fecha de entrega</label><input class="form-input" id="f-fecha" type="date"></div>
      <div class="form-group"><label class="form-label">Notas</label><textarea class="form-textarea" id="f-notas" placeholder="Consignas, links, requisitos..."></textarea></div>
      <button class="btn-submit" onclick="addItem()">Guardar</button>`
  }
};

function openModal() {
  selectedPriority = 'media';
  const f = FORMS[currentTab];
  document.getElementById('modal-title').textContent = f.title;
  document.getElementById('modal-body').innerHTML = f.build();

  const dateEl = document.getElementById('f-fecha');
  if (dateEl) {
    const d = new Date();
    if (currentTab !== 'turnos') d.setDate(d.getDate() + 1);
    dateEl.value = d.toISOString().split('T')[0];
  }

  document.getElementById('modal-overlay').classList.add('open');
  setTimeout(() => document.getElementById('f-titulo')?.focus(), 350);
}

function closeModal() { document.getElementById('modal-overlay').classList.remove('open'); }
function handleOverlayClick(e) { if (e.target === document.getElementById('modal-overlay')) closeModal(); }

function selectPriority(p) {
  selectedPriority = p;
  ['alta','media','baja'].forEach(x => {
    const b = document.getElementById('p-' + x);
    if (b) b.className = 'priority-btn' + (x === p ? ' sel-' + x : '');
  });
}

// ═══════════════════════════════════════════════════════
//  CRUD
// ═══════════════════════════════════════════════════════
function addItem() {
  const titleEl = document.getElementById('f-titulo');
  const titulo  = titleEl?.value.trim();
  if (!titulo) { titleEl?.classList.add('shake'); setTimeout(() => titleEl?.classList.remove('shake'), 400); return; }

  const id    = Date.now().toString();
  const fecha = document.getElementById('f-fecha')?.value || '';

  if (currentTab === 'turnos') {
    data.turnos.unshift({ id, titulo, fecha, hora: document.getElementById('f-hora')?.value || '', lugar: document.getElementById('f-lugar')?.value.trim() || '', notas: document.getElementById('f-notas')?.value.trim() || '', creado: new Date().toISOString() });
  } else if (currentTab === 'tareas') {
    data.tareas.unshift({ id, titulo, fecha, desc: document.getElementById('f-desc')?.value.trim() || '', prioridad: selectedPriority, creado: new Date().toISOString() });
  } else if (currentTab === 'facu') {
    data.facu.unshift({ id, titulo, fecha, materia: document.getElementById('f-materia')?.value.trim() || '', tipo: document.getElementById('f-tipo')?.value || 'TP', notas: document.getElementById('f-notas')?.value.trim() || '', creado: new Date().toISOString() });
  }

  saveData();
  renderAll();
  closeModal();
  showToast('Guardado ✨', '✅');
  scheduleNotifications();
}

function completeItem(tab, id) {
  const arr = data[tab];
  const idx = arr.findIndex(x => x.id === id);
  if (idx === -1) return;
  const item = { ...arr.splice(idx, 1)[0], categoria: tab, completadoEn: new Date().toISOString() };
  data.historial.unshift(item);
  saveData();
  renderAll();
  showToast('¡Completado! 🎉', '✅');
  scheduleNotifications();
}

function deleteItem(tab, id) {
  if (tab === 'historial') data.historial = data.historial.filter(x => x.id !== id);
  else data[tab] = data[tab].filter(x => x.id !== id);
  saveData();
  renderAll();
  scheduleNotifications();
}

// ═══════════════════════════════════════════════════════
//  UTILIDADES DE FECHA
// ═══════════════════════════════════════════════════════
function todayStr() {
  return new Date().toISOString().split('T')[0];
}
function tomorrowStr() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}
function formatDate(dateStr) {
  if (!dateStr) return null;
  const d     = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const diff  = Math.round((d - today) / 86400000);
  const label = d.toLocaleDateString('es-AR', { day:'numeric', month:'short' });
  if (diff < 0)   return { label: `Vencido · ${label}`, cls: 'badge-danger' };
  if (diff === 0) return { label: 'Hoy',     cls: 'badge-danger' };
  if (diff === 1) return { label: 'Mañana',  cls: 'badge-warning' };
  if (diff <= 3)  return { label: `En ${diff} días · ${label}`, cls: 'badge-warning' };
  return { label, cls: 'badge-primary' };
}

function updateBadge(tab, count) {
  const el = document.getElementById('badge-' + tab);
  if (!el) return;
  el.textContent = count;
  el.style.display = count > 0 ? 'flex' : 'none';
}

// ═══════════════════════════════════════════════════════
//  RENDER
// ═══════════════════════════════════════════════════════
function renderTurnos() {
  const list  = document.getElementById('list-turnos');
  const items = data.turnos;
  document.getElementById('count-turnos').textContent = items.length;
  updateBadge('turnos', items.length);
  if (!items.length) { list.innerHTML = `<div class="empty-state"><div class="empty-icon">🏥</div><div class="empty-title">Sin turnos pendientes</div><div class="empty-desc">Tocá el <strong>+</strong> para agregar un turno médico</div></div>`; return; }
  const sorted = [...items].sort((a,b) => !a.fecha ? 1 : !b.fecha ? -1 : a.fecha.localeCompare(b.fecha));
  list.innerHTML = sorted.map(t => {
    const date = t.fecha ? formatDate(t.fecha) : null;
    return `<div class="card turno-card">
      <div class="card-header"><div class="card-icon">🩺</div><div class="card-content"><div class="card-title">${esc(t.titulo)}</div>${t.lugar ? `<div class="card-subtitle">📍 ${esc(t.lugar)}</div>` : ''}</div></div>
      <div class="card-meta">${date ? `<span class="badge ${date.cls}">📅 ${date.label}</span>` : ''}${t.hora ? `<span class="badge badge-grey">🕐 ${t.hora}</span>` : ''}${t.notas ? `<span class="badge badge-grey">📝 Notas</span>` : ''}</div>
      ${t.notas ? `<div class="card-notes">${esc(t.notas)}</div>` : ''}
      <div class="card-actions"><button class="btn btn-delete" onclick="deleteItem('turnos','${t.id}')">🗑 Borrar</button><button class="btn btn-complete" onclick="completeItem('turnos','${t.id}')">✅ Asistí</button></div>
    </div>`;
  }).join('');
}

function renderTareas() {
  const list  = document.getElementById('list-tareas');
  const items = data.tareas;
  document.getElementById('count-tareas').textContent = items.length;
  updateBadge('tareas', items.length);
  if (!items.length) { list.innerHTML = `<div class="empty-state"><div class="empty-icon">🎉</div><div class="empty-title">¡Todo al día!</div><div class="empty-desc">Tocá el <strong>+</strong> para agregar una tarea</div></div>`; return; }
  const prioOrder = { alta:0, media:1, baja:2 };
  const sorted = [...items].sort((a,b) => prioOrder[a.prioridad] - prioOrder[b.prioridad]);
  const prioIcon  = { alta:'🔥', media:'📌', baja:'📎' };
  const prioLabel = { alta:'🔴 Alta', media:'🟡 Media', baja:'🟢 Baja' };
  const prioBadge = { alta:'badge-danger', media:'badge-warning', baja:'badge-success' };
  const prioClass = { alta:'priority-high', media:'priority-medium', baja:'priority-low' };
  list.innerHTML = sorted.map(t => {
    const date = t.fecha ? formatDate(t.fecha) : null;
    return `<div class="card ${prioClass[t.prioridad]}">
      <div class="card-header"><div class="card-icon">${prioIcon[t.prioridad]}</div><div class="card-content"><div class="card-title">${esc(t.titulo)}</div>${t.desc ? `<div class="card-subtitle">${esc(t.desc)}</div>` : ''}</div></div>
      <div class="card-meta"><span class="badge ${prioBadge[t.prioridad]}">${prioLabel[t.prioridad]}</span>${date ? `<span class="badge ${date.cls}">📅 ${date.label}</span>` : ''}</div>
      <div class="card-actions"><button class="btn btn-delete" onclick="deleteItem('tareas','${t.id}')">🗑 Borrar</button><button class="btn btn-complete" onclick="completeItem('tareas','${t.id}')">✅ Listo</button></div>
    </div>`;
  }).join('');
}

function renderFacu() {
  const list  = document.getElementById('list-facu');
  const items = data.facu;
  document.getElementById('count-facu').textContent = items.length;
  updateBadge('facu', items.length);
  if (!items.length) { list.innerHTML = `<div class="empty-state"><div class="empty-icon">🎓</div><div class="empty-title">Sin pendientes de facu</div><div class="empty-desc">Tocá el <strong>+</strong> para agregar parciales, TPs, finales...</div></div>`; return; }
  const sorted = [...items].sort((a,b) => !a.fecha ? 1 : !b.fecha ? -1 : a.fecha.localeCompare(b.fecha));
  const tipoIcon = { TP:'📄', Parcial:'📝', Final:'🎯', Proyecto:'💻', 'Exposición':'🎤', Lectura:'📖', Otro:'📌' };
  list.innerHTML = sorted.map(t => {
    const date = t.fecha ? formatDate(t.fecha) : null;
    return `<div class="card facu-card">
      <div class="card-header"><div class="card-icon">${tipoIcon[t.tipo]||'📌'}</div><div class="card-content"><div class="card-title">${esc(t.titulo)}</div>${t.materia ? `<div class="card-subtitle">📚 ${esc(t.materia)}</div>` : ''}</div></div>
      <div class="card-meta"><span class="badge badge-purple">${t.tipo}</span>${date ? `<span class="badge ${date.cls}">📅 ${date.label}</span>` : ''}</div>
      ${t.notas ? `<div class="card-notes">${esc(t.notas)}</div>` : ''}
      <div class="card-actions"><button class="btn btn-delete" onclick="deleteItem('facu','${t.id}')">🗑 Borrar</button><button class="btn btn-complete" onclick="completeItem('facu','${t.id}')">✅ Entregado</button></div>
    </div>`;
  }).join('');
}

function setFilter(f) {
  historialFilter = f;
  ['todo','turnos','tareas','facu'].forEach(x => document.getElementById('hf-'+x)?.classList.toggle('active', x===f));
  renderHistorial();
}

function renderHistorial() {
  const list  = document.getElementById('list-historial');
  let items   = data.historial;
  document.getElementById('count-historial').textContent = items.length;
  if (historialFilter !== 'todo') items = items.filter(x => x.categoria === historialFilter);
  if (!items.length) { list.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">Historial vacío</div><div class="empty-desc">Acá van a aparecer todas las cosas que completaste</div></div>`; return; }
  const catIcon  = { turnos:'🏥', tareas:'✅', facu:'🎓' };
  const catLabel = { turnos:'Turno', tareas:'Tarea', facu:'Facu' };
  list.innerHTML = items.map(t => {
    const d   = new Date(t.completadoEn);
    const str = d.toLocaleDateString('es-AR', { day:'numeric', month:'short', year:'numeric' });
    const sub = t.materia || t.lugar || t.desc || '';
    return `<div class="card historial-card">
      <div class="card-header"><div class="card-icon" style="background:#f1f5f9">${catIcon[t.categoria]||'✅'}</div><div class="card-content"><div class="card-title">${esc(t.titulo)}</div>${sub?`<div class="card-subtitle">${esc(sub)}</div>`:''}</div></div>
      <div class="card-meta"><span class="badge badge-success">✅ Completado</span><span class="badge badge-grey">${catLabel[t.categoria]||''}</span><span class="badge badge-grey">📅 ${str}</span></div>
      <div class="card-actions"><button class="btn btn-delete" onclick="deleteItem('historial','${t.id}')">🗑 Borrar</button></div>
    </div>`;
  }).join('');
}

function renderAll() {
  renderTurnos();
  renderTareas();
  renderFacu();
  renderHistorial();
  renderResumen();
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ═══════════════════════════════════════════════════════
//  SERVICE WORKER
// ═══════════════════════════════════════════════════════
async function initServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    swRegistration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    // Esperar a que esté activo
    if (!swRegistration.active) {
      await new Promise(resolve => {
        const sw = swRegistration.installing || swRegistration.waiting;
        if (!sw) { resolve(); return; }
        sw.addEventListener('statechange', () => { if (sw.state === 'activated') resolve(); });
        setTimeout(resolve, 3000);
      });
    }
    // Re-obtener con active
    swRegistration = await navigator.serviceWorker.getRegistration('./');
    scheduleNotifications();
  } catch(e) {
    console.warn('SW no disponible:', e);
  }
}

// ═══════════════════════════════════════════════════════
//  HEADER DATE
// ═══════════════════════════════════════════════════════
function setHeaderDate() {
  const d = new Date();
  document.getElementById('header-date').textContent =
    d.toLocaleDateString('es-AR', { weekday:'short', day:'numeric', month:'short' });
}

// ═══════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════
loadData();
setHeaderDate();
renderAll();
initServiceWorker().then(() => {
  checkNotifPrompt();
  // Si ya tiene permiso, reschedule
  if (Notification.permission === 'granted') {
    scheduleNotifications();
    document.getElementById('notif-dot').style.display = 'none';
  } else if (Notification.permission === 'denied') {
    document.getElementById('notif-dot').style.display = 'block';
  }
});
