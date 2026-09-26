/**
 * Las respuestas que no pasan por el modelo.
 *
 * Fijas a propósito: un saludo, un dato personal o un intento de sacar al
 * asistente de su función no necesitan redacción, y contestarlos sin modelo es
 * más rápido, gratis y no puede salir mal.
 */

export const RESPUESTA_SALUDO = `¡Hola! Soy el asistente del Observatorio Económico de Bolivia. Contesto con los datos que el tablero recoge, siempre con su fecha. Podés preguntarme, por ejemplo:
- ¿Cómo está el dólar hoy y cuánto es la brecha?
- ¿Cómo le va a la economía de Santa Cruz (o de cualquier departamento)?
- ¿Qué muestran los índices de democracia y la prensa sobre la situación política?
- ¿Cómo están la inflación, las reservas y la deuda?
- ¿Cómo descargo los datos o el informe en PDF?`;

export const RESPUESTA_FUERA =
  'Eso queda fuera de lo que puedo responder. Contesto sobre la situación de Bolivia y sus departamentos —dólar, inflación, reservas, deuda, empleo, energía, recursos naturales, comercio, empresas, carreteras, instituciones y prensa— y sobre cómo usar este tablero. ¿Querés preguntarme algo de eso?';

export const RESPUESTA_MANIPULACION =
  'Solo puedo ayudarte con la situación de Bolivia y sus departamentos usando los datos del Observatorio, y con el uso del tablero. Preguntame, por ejemplo, cómo está el dólar o cómo le va a un departamento.';

export const RESPUESTA_DATO_PERSONAL =
  'Por tu seguridad, no escribas correos, teléfonos, números de tarjeta ni claves en este chat: no los necesito para responder. Volvé a hacer la pregunta sin esos datos.';

export const AVISO_ASESORIA =
  '_Esto es información general con datos públicos, no una recomendación de inversión. Antes de decidir, consultá con un asesor financiero habilitado por ASFI y considerá tu propia situación._';
