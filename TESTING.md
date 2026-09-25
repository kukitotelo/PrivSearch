# PrivSearch – Estrategia de Pruebas

## Pruebas Implementadas (Fase 1)

1. **DorkParser Unit Tests** (`tests/unit/dorkParser.test.ts`):
   - Cobertura de campos simples: `domain:example.com`, `ip:192.168.1.1`, `port:443`.
   - Cobertura de rangos: `port:80-443`.
   - Operadores lógicos: `AND`, `OR`, `NOT`.
   - Precedencia de operadores: `NOT` > `AND` > `OR`.
   - Expresiones agrupadas con paréntesis.
   - Frases exactas entre comillas: `"exact phrase"`.
   - Juxtaposición de términos (AND implícito): `foo bar`.
   - Detección de sintaxis inválida y cadenas vacías.

2. **QueryClassifier Tests** (`tests/unit/queryClassifier.test.ts`):
   - Detección y clasificación de URL directa, dominio, IP, ASN, consulta Dork y texto plano.

3. **Storage & SQLite Tests** (`tests/unit/sqliteAdapter.test.ts`):
   - Inicialización del esquema relacional `schema.sql`.
   - Inserción y consulta de observaciones con metadatos de confianza y tipo de observación.
   - Inserción y recuperación de dominios e IPs.

## Ejecución de las Pruebas

```bash
cd ~/PrivSearch
npm test
```
