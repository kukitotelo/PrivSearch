# PrivSearch – Arquitectura del Sistema

```
PrivSearch (~/PrivSearch)
├── src/
│   ├── main/                  # Proceso principal de Electron (Node.js/TypeScript)
│   │   ├── index.ts           # Inicialización de BrowserWindow y ciclo de vida
│   │   ├── SessionManager.ts  # Particionado y aislamiento de sesiones por pestaña
│   │   ├── NetworkLayer.ts    # Control de proxy, Tor y fetch a través de Electron session
│   │   ├── PrivacyLayer.ts    # Cálculo del estado real de privacidad
│   │   ├── PermissionManager.ts# Modelo estricto de permisos (por defecto DENY)
│   │   ├── types.ts           # Definición de tipos, estados y contratos
│   │   └── ipc/               # Controladores IPC validados (Browser, Search, Privacy)
│   ├── preload/               # Preload aislado (contextBridge, sin Node en renderer)
│   ├── renderer/              # Interfaz de usuario (HTML/CSS y TypeScript sin Node)
│   ├── search/                # Motor de búsqueda y agregación
│   │   ├── SearchEngine.ts    # Orquestador del flujo de consulta
│   │   ├── QueryClassifier.ts # Clasificador automático (URL, DOMAIN, IP, ASN, DORK, PLAIN_TEXT)
│   │   ├── dork/
│   │   │   ├── DorkTypes.ts   # Definición de AST (AND, OR, NOT, FieldExpr, RangeExpr...)
│   │   │   ├── DorkParser.ts  # Parser determinista recursivo descendente
│   │   │   └── QueryPlanner.ts# Generador de planes de consulta por conector
│   │   └── connectors/        # Conectores modulares con capacidades explícitas
│   │       ├── SourceConnector.ts
│   │       ├── DNSConnector.ts
│   │       ├── CertificateConnector.ts
│   │       ├── ASNConnector.ts
│   │       ├── WebConnector.ts
│   │       └── InfrastructureConnector.ts
│   └── db/                    # Capa de persistencia
│       ├── StorageAdapter.ts  # Interfaz abstracta (preparada para futura migración a PostgreSQL)
│       ├── SQLiteAdapter.ts   # Implementación en SQLite (better-sqlite3)
│       └── schema.sql         # Esquema relacional de entidades y observaciones
└── tests/                     # Pruebas unitarias de parser, base de datos y clasificador
```

### Principios Arquitectónicos

1. **Separación de Responsabilidades**: El parser Dork desconoce las fuentes de datos; únicamente produce un AST determinista. El `QueryPlanner` traduce el AST en fuentes requeridas y filtros.
2. **Sin Conexiones Ocultas**: Los conectores no realizan conexiones en sockets no controlados; utilizan el canal de red de Electron Session proporcionado en su contexto.
3. **No Simulación**: Todo estado de verificación (`VERIFIED`, `NOT_VERIFIED`, `NOT_REQUESTED`, `NOT_IMPLEMENTED`, `SOURCE_UNAVAILABLE`) refleja la realidad de la ejecución técnica.
