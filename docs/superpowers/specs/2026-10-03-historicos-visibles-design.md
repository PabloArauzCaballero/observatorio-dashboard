# Históricos visibles: diseño aprobado

## Objetivo

Hacer que los históricos de empresarios, pasajes y fletes sean visibles al abrir sus páginas, sin depender de controles ocultos ni inventar comparaciones entre magnitudes incompatibles.

## Empresarios

- Mostrar los 14 nombres disponibles en un selector visible.
- Seleccionar inicialmente al empresario con la mayor estimación del último año.
- Mostrar su ficha histórica inmediatamente después del resumen: trayectoria anual, mejor puesto, años en podio, máximo, hitos y empresas principales.
- Mantener el podio histórico completo debajo; tocar cualquier nombre cambia la ficha y lleva el foco visual hasta ella.

## Pasajes

- Separar `Pasajes` como página principal de Transporte; `Automotor y pasajes` pasa a llamarse `Automotor`.
- Mostrar directamente las 60 bandas oficiales disponibles: 30 rutas del tarifario ATT 178/2013 y 30 de ATT 32/2025.
- Conservar buscador, selector histórico, clases normal/semicama/cama, fechas, fuente y descarga completa.
- No presentar una tarifa como vigente fuera del intervalo que declara la resolución.

## Fletes

- Al abrir Fletes, seleccionar `FREIGHT_BO` / `BOLIVIA_CUSTOMS` como vista inicial.
- La primera lectura será el flete implícito total de importaciones de Bolivia, con historia mensual 2010–2026.
- Colocar las referencias nacionales de transporte pesado antes de los índices mundiales.
- Mantener separadas las referencias de ruta con unidades diferentes; son evidencia cronológica, no una serie comparable.

## Entrega

- Pruebas unitarias en rojo antes de cada cambio de producción.
- Typecheck, suite unitaria, build y comprobación con navegador real.
- Commit y push de la rama, integración en `test`, despliegue en Contabo y verificación pública del contenedor nuevo.
