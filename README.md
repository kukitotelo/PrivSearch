# PrivSearch

**PrivSearch** es un navegador web de escritorio y motor de búsqueda para investigación OSINT/Infosec, diseñado con un enfoque estricto de privacidad, modularidad y agregación de fuentes públicas.

> **IMPORTANTE**: Este proyecto es completamente independiente de OSIRIS. Cuenta con su propia arquitectura, base de datos local SQLite y capa de red.

---

## Características Principales

1. **Doble Modo Integrado**:
   - **Modo Browser**: Navegación web con aislamiento estricto de sesiones por pestaña (en memoria `TEMPORARY` o particiones persistentes).
   - **Modo Index / Dork**: Motor de búsqueda propio con parser recursivo descendente que no depende de motores externos para interpretar la consulta.
2. **Arquitectura de Red y Privacidad**:
   - Control de rutas: `DIRECT`, `HTTP_PROXY`, `HTTPS_PROXY`, `SOCKS5`, `TOR`.
   - Estado real verificado: No se muestran insignias engañosas como "VERIFIED" o "PROTECTED" sin una comprobación técnica a través de la sesión de red de Chromium/Electron.
   - Bloqueo de cookies de terceros y aislamiento de almacenamiento por sesión.
3. **Motor de Agregación de Fuentes Públicas**:
   - Conectores modulares: DNS (DoH configurable), Certificate Transparency (crt.sh), BGP/ASN (BGPView), Web e Infraestructura.
   - Planificador de consultas (`QueryPlanner`): Sólo ejecuta las fuentes requeridas por la consulta; las demás permanecen como `NOT_REQUESTED`.
4. **Base de Datos Local**:
   - Esquema relacional estructurado para almacenar observaciones, dominios, IPs, certificados y relaciones sin alterar la verdad del dato.

---

## Requisitos de Ejecución (Linux / Kali)

- **Node.js**: v20+ (detectado v26.9.0)
- **npm**: v10+
- **Python**: v3.10+ (opcional para conectores futuros)
- **Tor**: (opcional para enrutamiento SOCKS5 Tor)

---

## Puesta en Marcha

Para compilar y arrancar la aplicación:

```bash
chmod +x ./start.sh
./start.sh
```

O manualmente:

```bash
npm install
npm run build
npm start
```

---

## Ejecutar Pruebas Automatizadas

```bash
npm test
```
