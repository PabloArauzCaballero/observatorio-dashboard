# Criterios visuales

## Decisiones mínimas

| Tema | Pregunta |
|---|---|
| Densidad | ¿La persona lee, compara o procesa muchas filas? |
| Jerarquía | ¿Se reconoce contexto y acción principal? |
| Material | ¿La profundidad explica una capa o solo decora? |
| Tipografía | ¿Los roles conservan legibilidad con zoom y texto largo? |
| Color | ¿Cada color tiene función y alternativa no cromática? |

Roles iniciales: canvas, panel, elevated, primary/secondary text, action, on-action, border, focus y pares foreground/background para estados. Cada componente usa roles, no valores aislados por preferencia.

## Propuesta inicial, ajustable

Espaciado basado en 4/8/12/16/24/32; cuerpo cercano a 1rem; radios por familia de control y superficie; fondo opaco; una familia de acento. Estos valores no son una receta de Apple. Ajustarlos con el producto y medir pares de color.

## Fallos a detectar

Tarjetas dentro de tarjetas sin necesidad; toda acción con el mismo peso; contenido auxiliar ilegible; glass que pierde contraste al desplazarse el fondo; modo oscuro generado por inversión; iconos de familias incompatibles; botones cuyo texto no cabe.

## Entrega verificable

Capturas por viewport y estado, reglas aplicadas y excepciones justificadas. Si el resultado es un mockup, declararlo y dejar comportamiento pendiente.

Referencias: [Apple, diseño y materiales](https://developer.apple.com/videos/play/wwdc2025/219/) y [DTCG, formato publicado](https://www.designtokens.org/tr/2025.10/format/). La implementación web es una adaptación del producto.

## Aprendido en observatorio-dashboard (refactor UX/UI, fase 03-04)

El proyecto ya tenía tokens semánticos coherentes en `src/app/globals.css` (`--ink`, `--ink-soft`, `--ink-faint`, `--paper`, `--official`, `--parallel`, escala `--s1`-`--s5`) sin build de CSS ni DTCG — variables `:root` puras son el formato correcto aquí, no una carencia a resolver. Un token puede parecer bien nombrado y aun así fallar contraste real: `--ink-faint` medía 3.68-3.81:1 en modo claro (bajo AA 4.5:1) pero se usaba en texto de UI (`.tab`, `.dateline`), no solo en decoración. Medir el par color-sobre-fondo con la fórmula WCAG real antes de dar un token por "ya resuelto" solo porque tiene nombre semántico.
