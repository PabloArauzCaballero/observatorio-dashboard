/**
 * Las respuestas que no pasan por el modelo.
 *
 * Fijas a propósito: un saludo, un dato personal o un intento de sacar al
 * asistente de su función no necesitan redacción, y contestarlos sin modelo es
 * más rápido, gratis y no puede salir mal.
 */

export const RESPUESTA_SALUDO = `Hola. Soy el asistente de DatosBolivia.com: respondo con los datos que recoge el tablero, siempre con su fecha. Algunas consultas posibles:
- ¿Cómo está el dólar hoy y cuánto es la brecha?
- ¿Cómo le va a la economía de Santa Cruz (o de cualquier departamento)?
- ¿Qué muestran los índices de democracia y la prensa sobre la situación política?
- ¿Cómo están la inflación, las reservas y la deuda?
- ¿Cómo descargo los datos o el informe en PDF?`;

export const RESPUESTA_FUERA =
  'Esa consulta queda fuera del alcance del asistente de DatosBolivia.com, que solo responde sobre la economía de Bolivia y sus departamentos —dólar, inflación, reservas, deuda, empleo, energía, recursos naturales, comercio, empresas, carreteras, instituciones y prensa económica— y sobre el uso de este tablero.';

export const RESPUESTA_SEGURIDAD =
  'El asistente no tiene ni comparte contraseñas, claves, accesos, servidores ni otros detalles técnicos o de seguridad del sistema. Los problemas de seguridad del sitio pueden comunicarse a los responsables de DatosBolivia.com. Para consultas sobre la economía de Bolivia, el asistente sigue disponible.';

export const RESPUESTA_MANIPULACION =
  'El asistente solo responde sobre la situación de Bolivia y sus departamentos, con los datos de DatosBolivia.com, y sobre el uso del tablero; por ejemplo, cómo está el dólar o cómo evoluciona la economía de un departamento.';

export const RESPUESTA_DATO_PERSONAL =
  'Por seguridad, este chat no debe recibir correos, teléfonos, números de tarjeta ni claves: no son necesarios para responder. La consulta puede repetirse sin esos datos.';

export const AVISO_ASESORIA =
  '_Información general basada en datos públicos; no es una recomendación de inversión. Antes de decidir conviene consultar a un asesor financiero habilitado por la Autoridad de Supervisión del Sistema Financiero (ASFI) y considerar la situación propia._';
