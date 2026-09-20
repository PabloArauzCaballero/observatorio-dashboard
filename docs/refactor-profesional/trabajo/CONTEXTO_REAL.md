# Contexto real — observatorio-dashboard

> Fase 00 · F00.1. Cada dato se marca [observado], [documentado], [supuesto] o [desconocido].

## Propósito del producto

Tablero público de seguimiento del **tipo de cambio oficial**, el **dólar paralelo** y la **brecha
cambiaria** de Bolivia, más contexto macroeconómico anual (inflación, PIB, reservas, cuenta
corriente, deuda externa, desempleo, tasa activa). [documentado — README.md]

El tablero **lee** series ya publicadas por un núcleo (`read_models`) que corre en otro repositorio;
no recalcula ni deriva más que el punto medio del paralelo y la variación del periodo. [documentado
— README.md, confirmado por el propio código de acceso a datos en `src/lib/db.ts`, que solo abre una
conexión de solo lectura]

## Zonas del producto

1. **Público** (`src/app/page.tsx` y sus explorers): informativo, sin autenticación, una sola ruta
   raíz con secciones internas (cifras del día, evolución del tipo de cambio, brecha, dispersión
   entre plazas, serie en crudo + descarga CSV, fuentes, contexto macro, notas). [observado]
2. **Admin** (`src/app/admin/**`): zona privada con login, panel de auditoría, descargas, salud,
   ingesta, metadatos, calidad de datos, semillas (seeds) y tráfico. De trabajo recurrente para un
   operador interno, no para el público. [observado]

## Usuarios y roles

- **Visitante público**: sin cuenta, acceso de solo lectura a la portada y a `/api/*` públicas
  (`series.csv`, lugares, mundo, prensa, analytics, readers, version). [observado]
- **Operador/administrador**: cuenta con sesión (`src/lib/admin/session.ts`), cookie firmada
  `HttpOnly`/`SameSite=Lax` + token CSRF, expiración a los 60 minutos. El layout privado
  (`src/app/admin/(private)/layout.tsx`) redirige a `/admin/login` sin sesión. [observado]
- Roles finos (qué puede ver/hacer cada operador) los aplica el **núcleo** sobre el token que esta
  app le pide, no este repositorio. [documentado — comentario en `layout.tsx` y `src/lib/admin/`]
  No se determinó en esta fase el catálogo completo de roles del núcleo. [desconocido]

## Datos sensibles

- Cadena de conexión a Postgres (`DASHBOARD_DATABASE_URL`) — nunca se comitea, vive en la
  plataforma de despliegue (Coolify). [documentado — `.env.example`, `.env.local` presente y
  git-ignorado]
- Secreto de firma de sesión admin (`ADMIN_SESSION_SECRET`, ≥32 caracteres). [observado —
  `src/lib/admin/session.ts`]
- Credenciales/token de Coolify y Tailscale para despliegue (`PABLO_H310_TAILSCALE_AUTHKEY`,
  `PABLO_H310_COOLIFY_WEBHOOK`, `PABLO_H310_COOLIFY_TOKEN`). [documentado — README.md]
- La base solo se lee con permisos de solo lectura (`read_models`); no se escribe desde este
  repositorio. [documentado — README.md]

## Tipo de producto

Mixto: **informativo** en la zona pública (consulta y descarga, sin transacciones) y **de trabajo
recurrente** en la zona admin (operación diaria: ingesta, calidad, semillas, auditoría). [observado]

## Limitaciones del encargo en esta fase

- No hay acceso a la base de datos real desde este entorno: la conexión configurada en
  `.env.local` agotó su cuota de transferencia de datos (Neon), así que toda evidencia de datos en
  vivo viene del estado de error documentado por la propia app, no de cifras reales. [observado]
- No se ejecutaron pruebas Playwright (requieren navegador y, varias, base de datos con datos) en
  esta fase. [no ejecutado]
- No se inspeccionó el repositorio del núcleo (`read_models`, ingestión, autenticación real) porque
  no está en este checkout. [desconocido — fuera de alcance de este repo]
