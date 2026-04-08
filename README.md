# MiDía ✨ — Organizador Personal

App web progresiva (PWA) para organizar turnos médicos, tareas pendientes y obligaciones de la facultad. Funciona en el navegador y se puede instalar como acceso rápido en la pantalla de inicio de Android e iOS.

---

## Archivos del proyecto

```
midia-app/
├── midia.html      ← La aplicación completa
├── sw.js           ← Service Worker (notificaciones + modo offline)
├── manifest.json   ← Metadatos de la PWA (nombre, ícono, colores)
└── README.md       ← Este archivo
```

> Los 3 archivos deben estar siempre en la **misma carpeta** para que la app funcione correctamente.

---

## Cómo hostear en GitHub Pages (gratis)

1. Crear una cuenta en [github.com](https://github.com) si no tenés una.
2. Crear un repositorio nuevo (ej: `midia`), dejarlo en **público**.
3. Subir los 3 archivos: `midia.html`, `sw.js` y `manifest.json`.
4. Ir a **Settings → Pages → Branch: main → Save**.
5. En unos minutos GitHub te da una URL del estilo:
   ```
   https://tuusuario.github.io/midia/midia.html
   ```
6. Esa es la URL que vas a usar para instalar la app.

> ⚠️ Las notificaciones solo funcionan con HTTPS. GitHub Pages ya lo incluye automáticamente.

---

## Instalación en Android

**Navegador recomendado: Google Chrome**

1. Abrí Chrome en tu Android.
2. Ingresá a la URL de tu GitHub Pages.
3. Tocá el menú de los **tres puntos** (⋮) arriba a la derecha.
4. Seleccioná **"Añadir a pantalla de inicio"** o **"Instalar app"**.
5. Confirmá el nombre y tocá **Agregar**.
6. El ícono aparece en tu pantalla de inicio como cualquier app.
7. La próxima vez que la abrís desde el ícono, aceptá el permiso de notificaciones cuando te lo pida.

> En algunos Android también puede aparecer un banner automático en la parte de abajo de Chrome sugiriendo instalarla.

---

## Instalación en iOS (iPhone)

**Navegador requerido: Safari** ← Chrome en iOS *no* soporta instalación de PWAs

1. Abrí **Safari** (no Chrome) en tu iPhone.
2. Ingresá a la URL de tu GitHub Pages.
3. Tocá el botón de **compartir** — el ícono de cajita con flecha hacia arriba (↑) en la barra inferior.
4. En el menú que aparece, scrolleá hacia abajo y tocá **"Añadir a pantalla de inicio"**.
5. Editá el nombre si querés (por defecto dice "MiDía") y tocá **Añadir** arriba a la derecha.
6. El ícono aparece en tu pantalla de inicio.
7. **Importante:** siempre abrí la app desde ese ícono, no desde Safari, para que las notificaciones funcionen.

### Activar notificaciones en iOS

- Requiere **iOS 16.4 o superior** (iPhone 14 Pro lo soporta ✓).
- La primera vez que abrís la app desde el ícono del home, aparece un cartel para activar notificaciones.
- Tocá **"Sí, activar"** → iOS muestra el popup del sistema → tocá **Permitir**.
- Para verificar que funciona, tocá el 🔔 en el header → **"Enviar notificación de prueba"**.

---

## Qué notificaciones envía

| Cuándo | Qué dice |
|---|---|
| Al abrir la app (si hay cosas para hoy) | Lista de ítems del día |
| 8:00 AM del día anterior | Resumen de lo que vence mañana |
| 8:00 AM del día (si hay pendientes) | Buenos días + cantidad de ítems |

---

## Cómo usar la app

| Sección | Para qué |
|---|---|
| 🏥 **Turnos** | Turnos médicos con fecha, hora, lugar y notas |
| ✅ **Tareas** | Pendientes con prioridad (Alta / Media / Baja) y fecha límite |
| 🎓 **Facu** | TPs, parciales, finales y proyectos con fecha de entrega |
| 📋 **Historial** | Todo lo que completaste, filtrable por categoría |

- Tocá **+** para agregar un ítem en la sección activa.
- Los ítems se ordenan automáticamente por fecha más próxima.
- Las fechas cambian de color: 🔴 hoy/vencido · 🟡 mañana o en 3 días · 🔵 más adelante.
- Al tachar un ítem pasa al historial con la fecha en que lo completaste.

---

## Modificar la app

Todo el código está en `midia.html`. Algunas cosas fáciles de cambiar:

- **Colores:** buscá `:root {` al inicio del CSS y modificá las variables `--primary`, `--secondary`, etc.
- **Tu nombre en la notificación de buenos días:** buscá `Buenos días, Matias` en el JS.
- **Hora de la notificación matutina:** buscá `T08:00:00` y cambiá la hora.
- **Tipos de tarea de facu:** buscá las opciones del `<select id="f-tipo">` y agregá los que necesites.

---

## Tecnologías usadas

- HTML + CSS + JavaScript puro (sin frameworks)
- Web App Manifest (PWA)
- Service Worker API (offline + notificaciones)
- Notifications API
- localStorage (datos guardados en el dispositivo)
