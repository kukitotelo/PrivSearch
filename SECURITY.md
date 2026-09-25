# PrivSearch – Política y Modelo de Seguridad

## 1. Sandbox y Aislamiento de Procesos en Electron
- `contextIsolation: true`: El renderer no comparte prototipos ni variables globales con el script de preload.
- `nodeIntegration: false`: Ningún script web o UI tiene acceso al runtime de Node.js, `child_process`, `fs` ni sockets nativos.
- `sandbox: true`: La ejecución de pestañas de navegación se encuentra enjaulada en el sandbox nativo de Chromium.

## 2. Gestión de Permisos Explícitos
- Por defecto, **todos los permisos sensibles** (`camera`, `microphone`, `geolocation`, `notifications`, `clipboard-read`, etc.) son rechazados (`DENY`).
- Ningún sitio web recibe permisos de manera silenciosa.
- Se implementa un canal de consulta al usuario (`PermissionManager`) para origin específico.

## 3. Manejo de Sitios Anti-Bot / Cloudflare
- PrivSearch es compatible con desafíos legítimos de verificación de navegador.
- **No se implementa evasión activa de CAPTCHA ni alteración de encabezados de autenticación.**
- Cuando un sitio legítimo presenta un desafío, se ejecuta normalmente dentro de la sesión aislada de la pestaña sin deshabilitar las protecciones del navegador.

## 4. Registro y Logs
- No se registran credenciales, contraseñas ni datos sensibles en los logs locales de la aplicación.
