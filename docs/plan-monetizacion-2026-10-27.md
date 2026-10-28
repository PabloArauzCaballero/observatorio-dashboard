# Plan de monetización: Servicios, cuentas de cliente y API por niveles

Fecha: 27-oct-2026. Estado: **propuesto, sin implementar**.

Datos Bolivia sigue siendo gratuito para leer. Lo que se cobra es el acceso completo a los
datos (descargas sin tope, API, reportería) y el uso intensivo del chat.

## 1. Decisiones tomadas (no volver a derivarlas)

| Tema | Decisión |
|---|---|
| Cobro | QR / transferencia en bolivianos; la cuenta se activa a mano en `/admin`. Sin pasarela (Stripe no acepta comercios bolivianos). |
| Qué se controla | El mapa de lugares **y** el chat, más todas las descargas del tablero. |
| Visitante sin cuenta | Descarga sin registrarse, con tope de **500 filas** por archivo y aviso «completo con un plan». |
| Inicio de sesión del cliente | Correo + contraseña. La cuenta la crea el operador; el cliente fija su contraseña con un enlace de un solo uso. |
| Moneda | Bolivianos. |
| Periodos | Mensual, y anual al precio de 10 meses. |
| Factura | Todavía no se emite. Los precios se presentan sin factura; se guardan razón social y NIT opcionales para cuando exista. |
| Datos de pago | Todos los conjuntos descargables tienen tope sin plan: mapa, aduana, empresas, series, dólar y prensa. Las imágenes (PNG/SVG) de los gráficos siguen libres. |
| Chat sin cuenta | 10 preguntas por día y por IP. |
| Reportería | Las cuatro formas, repartidas por plan: vistas guardadas, informe periódico automático, informes a pedido y volcado completo. |
| Contacto | Formulario guardado en `/admin`, WhatsApp y correo. |
| Correos | Resend (dominio `datosbolivia.com` verificado por DNS). |
| Prueba gratis | 7 días, activada a mano desde `/admin`. |
| Cupo y vencimiento | Aviso al 80 %, corte al 100 %: el cliente vuelve a los topes gratuitos. Al vencer el pago, 5 días de gracia y después pasa a gratis. |
| API | `/api/v1` nueva, versionada y documentada; las rutas internas del tablero no son contrato. |
| Mapa | Equilibrado: ver el mapa sigue libre (hasta 4.000 lugares por vista); «mostrar todos» y la descarga completa solo con plan; límite de pedidos por IP y por hora. |
| Legal | Términos de uso y licencia de datos, que se aceptan al activar la cuenta (redacción a revisar por un abogado). |
| Lanzamiento | Por fases, cada una verificada en `test.datosbolivia.com` antes de pasar a la siguiente. |

## 2. Planes y precios

| | **Gratis** | **Analista** | **Profesional** | **Institucional** |
|---|---|---|---|---|
| Precio mensual | Bs 0 | **Bs 350** | **Bs 1.400** | desde **Bs 5.000** (cotización) |
| Precio anual (10 meses) | — | Bs 3.500 | Bs 14.000 | a convenir |
| Usuarios | — | 1 | 3 | hasta 10 |
| Llaves de API | — | 1 | 3 | 10 |
| Consultas a la API por mes | — | 10.000 | 100.000 | 1.000.000 (o a medida) |
| Consultas por minuto | — | 60 | 300 | 1.000 |
| Descargas desde el tablero | 500 filas por archivo | completas | completas | completas |
| Mapa de lugares | ver hasta 4.000; bajar 500 | bajar hasta 5.000 por descarga | completo, todas las ciudades | completo |
| Histórico | el que muestra el tablero | completo | completo | completo |
| Chat (preguntas por día) | 10 | 100 | 300 | 1.000 |
| Vistas guardadas en `/cuenta` | — | 10 | ilimitadas | ilimitadas |
| Informe periódico automático | — | — | 1 mensual (Excel por correo) | semanales, a medida |
| Informes a pedido | — | — | — | 1 al mes incluido |
| Volcado completo de la base | — | — | — | mensual (CSV) |
| Soporte | — | correo | correo, 2 días hábiles | prioritario, con acuerdo de servicio |

- Universidades y estudiantes: 50 % de descuento sobre Analista o Profesional (lo aplica el operador al activar).
- Bs 350 son unos US$ 50 al tipo oficial: accesible para consultoras, ONG, medios y bancos bolivianos, y muy por debajo de los servicios internacionales de datos económicos.
- Los cupos viven en un único archivo de planes (`src/lib/plans.ts`). Cambiar un precio o un cupo no exige tocar más código.

## 3. Arquitectura

```
Navegador ──► Tablero (Next.js) ──► Núcleo (NestJS) ──► PostgreSQL
                │  · cookie de cliente (HMAC, como /admin, otro secreto)
                │  · /api/v1 con «Authorization: Bearer obs_live_…»
                │  · topes por IP en memoria (visitantes sin cuenta)
                └─ escribe SOLO a través del núcleo (la base del tablero es de solo lectura)
```

- **Las escrituras pasan por el núcleo**, igual que la telemetría de hoy. El tablero llama con una identidad de servicio de un solo rol, `SITE_SUBSCRIPTIONS`. Si se compromete el tablero, ese rol puede verificar llaves y sumar consumo, nada más.
- **Llaves de API**: formato `obs_live_<32 bytes base64url>`. Se guarda solo el SHA-256 y los primeros 8 caracteres para reconocerla. Se muestra una sola vez.
- **Contraseñas**: `scrypt` de `node:crypto` (sin librería nueva), con sal por cuenta.
- **Verificación de cada llamada**: el núcleo verifica la llave y suma el consumo en una sola sentencia, y devuelve plan, cupo y uso. El tablero guarda la verificación 60 s en memoria, así una ráfaga no golpea al núcleo en cada pedido.
- **Topes sin cuenta**: en memoria del proceso, por IP (como el chat de hoy). Se reinician al reiniciar el contenedor; es aceptable porque cada servidor corre un solo proceso.
- **Cada servidor tiene su propia base.** Las cuentas reales viven en la del entorno donde están los clientes (`datosbolivia.com`); test lleva cuentas de prueba.

### Tablas nuevas (migración 0107 del núcleo)

- `subscriber_account`: correo (único), nombre, organización, razón social y NIT opcionales, plan, periodo (mensual/anual), estado (`TRIAL`, `ACTIVE`, `GRACE`, `SUSPENDED`, `CANCELLED`), `paid_until`, hash de contraseña, aceptación de términos (versión y fecha), creación y auditoría.
- `subscriber_member`: usuarios adicionales de una cuenta (Profesional e Institucional).
- `subscriber_api_key`: prefijo, hash, etiqueta, creada, último uso, revocada.
- `subscriber_usage`: cuenta × mes × tipo (`API`, `DOWNLOAD`, `CHAT`, `MAP`) → contador.
- `subscriber_payment`: registro manual de cada pago (monto en Bs, periodo cubierto, comprobante, operador). No se borra nunca: una corrección crea otro registro.
- `subscriber_token`: enlaces de un solo uso (activar contraseña, recuperarla), con vencimiento.
- `service_inquiry`: pedidos del formulario de Servicios (nombre, correo, organización, plan de interés, mensaje, estado `NEW`/`CONTACTED`/`WON`/`LOST`).
- `subscriber_saved_view` (fase 4): vistas guardadas del cliente.
- `subscriber_report_schedule` (fase 4): informes periódicos.

## 4. Fases

### Fase 1: Servicios y topes (sin cuentas todavía)

1. **Botón «Servicios»** al lado de «Donar», con la misma presencia en la cabecera.
2. **Página `/servicios`** (indexable): los cuatro planes, la comparación, preguntas frecuentes y cómo se paga (QR, activación en el día hábil).
3. **Formulario de contacto** → `POST /api/servicios/contacto` → núcleo `service_inquiry`. Lleva protección contra bots: campo trampa, tiempo mínimo de llenado y 5 envíos por IP por hora.
4. **WhatsApp y correo** desde variables (`SERVICIOS_WHATSAPP`, `SERVICIOS_CORREO`). Sin variable, el botón no aparece; nada queda en el código.
5. **Topes sin cuenta**:
   - `/api/export`: 500 filas por archivo, con la marca de «incompleto» que ya existe (`truncated`) y el aviso «completo con un plan».
   - Excel del directorio empresarial y demás descargas de servidor: el mismo tope.
   - `/api/lugares`: `todos=1` queda rechazado sin plan; el mapa sigue en 4.000 por vista; 120 pedidos por IP y por hora.
   - `/api/asistente`: 10 preguntas por IP por día (hoy son 40 por ventana).
   - Descargas que arma el navegador a partir de datos ya cargados: el mismo tope de 500 filas en el cliente (no impide copiar, pero ordena el mensaje).
6. **`/admin/pedidos`**: lista de pedidos del formulario, con cambio de estado.
7. **`/terminos`**: términos de uso y licencia de datos.

Verificación: un pedido real del formulario aparece en `/admin/pedidos` en test; una descarga anónima de lugares devuelve 500 filas con el aviso; la pregunta 11 del chat devuelve 429.

### Fase 2: Cuentas de cliente y la ruta protegida `/cuenta`

1. Migración 0107 y el módulo `subscriptions` del núcleo (repositorios, servicio, controladores, esquemas Zod, roles `SUBSCRIPTION_ADMIN` y `SITE_SUBSCRIPTIONS`, pruebas).
2. **`/admin/clientes`**: crear la cuenta (o convertir un pedido en cuenta), elegir plan y periodo, dar prueba de 7 días, registrar pagos (que extienden `paid_until`), suspender, reenviar el enlace de activación y ver el consumo.
3. **Correos con Resend**: activación de la cuenta, recuperación de contraseña, aviso de consumo al 80 %, aviso de vencimiento 5 días antes y al entrar en gracia.
4. **`/cuenta`**, protegida por el middleware (sin sesión, va a `/cuenta/ingresar`):
   - Resumen: plan, vigencia, consumo del mes por tipo.
   - Llaves: crear, ver el prefijo, revocar.
   - Usuarios de la cuenta (Profesional e Institucional).
   - Datos de facturación (razón social y NIT opcionales).
   - Cambiar contraseña.
5. **El tablero reconoce la sesión del cliente**: con cookie de cliente, las descargas y el chat usan los cupos del plan y descuentan del mes.
6. Aceptación de términos en la activación (se guarda la versión aceptada).

Verificación: en test, una cuenta creada en `/admin` recibe el correo, fija su contraseña, entra a `/cuenta`, baja el mapa completo de una ciudad y ve el consumo sumado.

### Fase 3: `/api/v1` y su documentación

1. Rutas estables, todas con `Authorization: Bearer`:
   - `/api/v1/series`, `/api/v1/series/{codigo}` (macro, BCB, dólar, UFV)
   - `/api/v1/lugares` (ciudad, familia, paginado por cursor)
   - `/api/v1/aduana` (partida, país, departamento, mes)
   - `/api/v1/empresas` (directorio, principales empresas)
   - `/api/v1/prensa`
   - `/api/v1/uso` (consumo y cupo de la propia llave)
2. Formato común: JSON paginado por cursor; `?formato=csv` donde tenga sentido. Las respuestas llevan los encabezados `X-Cupo-Limite`, `X-Cupo-Restante` y `X-Cupo-Reinicio`.
3. Errores: `401` (llave inválida o ausente), `402` (plan vencido), `429` (cupo o ritmo agotado, con `Retry-After`).
4. **`/servicios/api`**: documentación con ejemplos en curl, Python y Excel (Power Query), generada de un OpenAPI propio.

Verificación: un script de prueba recorre cada ruta con una llave de test, agota un cupo artificialmente bajo y comprueba el 429 y los encabezados.

### Fase 4: Reportería

1. **Vistas guardadas** en `/cuenta`: guardar los filtros de una página del tablero (la dirección con sus parámetros) y volver a bajarla.
2. **Informe periódico automático** (Profesional e Institucional): el cliente elige series y frecuencia; un proceso programado arma el Excel y lo envía por Resend; también queda en `/cuenta`.
3. **Informes a pedido** (Institucional): formulario en `/cuenta` que entra como pedido a `/admin`; la entrega (PDF/Excel) se sube y queda en `/cuenta`.
4. **Volcado completo** (Institucional): archivo mensual por conjunto en `/cuenta`, con enlace firmado que vence.

## 5. Lo que necesito de ti

| Qué | Para qué fase |
|---|---|
| Número de WhatsApp de ventas | 1 |
| Correo de ventas | 1 |
| Confirmar los precios y cupos de la sección 2 (o ajustarlos) | 1 |
| El QR real del banco para cobrar (el de Donar sigue siendo de prueba) | 2 |
| Cuenta en Resend y los registros DNS de `datosbolivia.com` | 2 |
| Revisión legal de los términos | antes de cobrar |
| Cargar en Coolify los secretos nuevos (`SUBSCRIBER_SESSION_SECRET`, `RESEND_API_KEY`) | 2 |

## 6. Riesgos y límites conocidos

- **Lo que el navegador ya tiene, se puede copiar.** El mapa muestra 4.000 lugares por vista. Los topes y el límite por IP frenan la copia masiva, no la manual.
- **Los topes por IP viven en memoria**: se reinician con cada despliegue, y varias personas detrás de una misma IP (una oficina, una universidad) comparten el cupo del chat.
- **Cada servidor tiene su base**: una cuenta creada en test no existe en producción.
- **Las cifras no cambian por pagar.** Los planes compran acceso y volumen, no cobertura ni otra versión de los datos; lo dirá la página de Servicios.

## 7. Avisos por correo: la tarea programada

Tres avisos salen solos, cada uno una vez por periodo: **consumo al 80 %** del cupo mensual de la API (una vez por mes UTC), **vencimiento en 5 días** y **periodo de gracia** (una vez por cada fecha de vigencia). La decisión vive en `src/lib/cuenta/avisos-puro.ts` (probada en `tests/unit/avisos.test.mjs`); el núcleo guarda qué aviso ya salió (`POST /notices/claim`), así que correr la tarea de más no repite correos. Solo hay cupo mensual para la API: el asistente se cuenta por día y las descargas por tamaño de archivo.

**Coolify → aplicación del sitio público → Scheduled Tasks**, cada hora (`0 * * * *`):

```sh
curl -fsS -X POST -H "Authorization: Bearer $AVISOS_SECRET" http://localhost:3000/api/servicios/avisos
```

La tarea va en la aplicación del sitio, no en la del portal `/admin`. Responde con cifras por tipo de aviso (`due`, `sent`, `alreadySent`, `mailFailed`, `claimFailed`), sin correos ni identificadores.

| Variable | Para qué |
|---|---|
| `AVISOS_SECRET` | El portador de la tarea; se compara en tiempo constante. Sin ella la ruta responde 503. Generar con `openssl rand -base64 32`. |
| `RESEND_API_KEY` | La llave de Resend. Sin ella (o sin remitente) la ruta responde 503 y no reclama ningún aviso, para que no se pierdan. |
| `SERVICIOS_CORREO_REMITENTE` | El remitente verificado en Resend, p. ej. `DatosBolivia.com <avisos@datosbolivia.com>`. |
| `AVISOS_SITIO_URL` | La dirección pública para los enlaces del correo (`/cuenta`, `/servicios`), p. ej. `https://test.datosbolivia.com`; la tarea llega por `localhost`. Se lee al correr. Sin ella se usa `NEXT_PUBLIC_SITE_URL` (fijada al construir la imagen) y, si tampoco está, `https://datosbolivia.com`: en test hay que fijarla. |

Las mismas `RESEND_API_KEY` y `SERVICIOS_CORREO_REMITENTE` mandan el enlace de activación al crear una cuenta en `/admin/clientes`; sin ellas, el enlace se muestra para copiarlo.

El aviso se reclama antes de mandarlo: dos corridas a la vez nunca duplican un correo, pero si Resend falla después del reclamo ese aviso no se reintenta (cuenta en `mailFailed`).
