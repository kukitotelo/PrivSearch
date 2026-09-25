# PrivSearch – Compromiso de Privacidad y Modelo de Red

## Veracidad del Estado de Privacidad
PrivSearch nunca muestra estados como "VERIFIED" o "PROTECTED" a menos que hayan sido técnicamente comprobados a través del stack de red de Chromium correspondiente a la sesión.

### Estados Permitidos:
- `NOT_TESTED`: No se ha ejecutado ninguna prueba de verificación activa.
- `NOT_IMPLEMENTED`: La verificación aún se encuentra en desarrollo.
- `CONFIGURED`: La configuración fue aplicada a la sesión, pero aún no se ha comprobado tráfico real saliente.
- `NOT_VERIFIED`: Se intentó comprobar pero no se pudo certificar el origen.
- `VERIFIED`: La comprobación técnica confirmó el tráfico a través del nodo/proxy esperado.
- `POSSIBLE_LEAK`: Se detectó divergencia entre la ruta configurada y la detectada.
- `ERROR`: La consulta de verificación falló.

## Aislamiento de Sesiones
- **Modo TEMPORARY**: Particiones en memoria (`tab-<uuid>`) que no escriben cookies ni caché en disco. Al cerrar la pestaña, toda la información se destruye.
- **Modo PERSISTENT**: Partición aislada en disco (`persist:tab-<uuid>`) para pestañas donde el usuario desee mantener sesión sin cruzar datos con otras pestañas.

## Cookies y Almacenamiento Cruzado
- Se interceptan y bloquean cabeceras `Cookie` y `Set-Cookie` en recursos cruzados cuando el initiator/origen difiere del host destino.
