/**
 * Un pedido del formulario de Servicios, validado antes de salir hacia el núcleo.
 *
 * Las mismas reglas que aplica el núcleo, escritas otra vez aquí para contestar
 * al lector en su idioma y en el acto. Si las dos copias se separan manda la del
 * núcleo: lo peor que pasa es un 400 que el formulario muestra como error.
 *
 * Puro, para probarlo con `node --test`.
 */

import type { InquiryPlan } from './plans';

/**
 * Los planes que se pueden pedir. Repetidos aquí y no importados porque las
 * pruebas corren este archivo con `node --test`, que solo borra los imports de
 * tipos; `satisfies` hace que `tsc` se queje si la lista se separa del tipo, y
 * la prueba la compara con `INQUIRY_PLANS`.
 */
export const INQUIRY_PLAN_CODES = [
  'analista',
  'profesional',
  'institucional',
  'a-medida',
] as const satisfies readonly InquiryPlan[];

const isInquiryPlan = (value: string): value is InquiryPlan =>
  (INQUIRY_PLAN_CODES as readonly string[]).includes(value);

export interface InquiryInput {
  requestId: string;
  fullName: string;
  email: string;
  organization: string | null;
  phone: string | null;
  planCode: InquiryPlan;
  message: string;
  sourceRoute: string;
}

export type InquiryCheck =
  | { ok: true; value: InquiryInput }
  | { ok: false; error: string; field?: string };

/** Menos que esto entre abrir el formulario y enviarlo lo hace una máquina, no una persona. */
export const MIN_FILL_MS = 3_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * Lee lo que mandó el navegador.
 *
 * `sitio_web` es la trampa: un campo que una persona no ve y un robot llena.
 * `abierto` es el instante en que se dibujó el formulario. Las dos fallas se
 * contestan con el mismo «gracias» que un envío bueno (`spam: true` le dice a la
 * ruta que no lo guarde), porque decirle a un robot por qué falló es enseñarle.
 */
export function checkInquiry(body: unknown, now: number = Date.now()): InquiryCheck & { spam?: boolean } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'El pedido llegó vacío.' };
  const raw = body as Record<string, unknown>;

  const opened = Number(raw['abierto']);
  if (text(raw['sitio_web']) || !Number.isFinite(opened) || now - opened < MIN_FILL_MS) {
    return { ok: false, error: 'spam', spam: true };
  }

  const requestId = text(raw['requestId']);
  if (!UUID.test(requestId)) return { ok: false, error: 'El formulario está desactualizado. Recargar la página.' };

  const fullName = text(raw['fullName']);
  if (fullName.length < 2 || fullName.length > 120) {
    return { ok: false, error: 'Falta el nombre (de 2 a 120 caracteres).', field: 'fullName' };
  }
  const email = text(raw['email']).toLowerCase();
  if (email.length > 200 || !EMAIL.test(email)) {
    return { ok: false, error: 'El correo no parece válido.', field: 'email' };
  }
  const organization = text(raw['organization']);
  if (organization.length > 160) {
    return { ok: false, error: 'El nombre de la organización puede tener hasta 160 caracteres.', field: 'organization' };
  }
  const phone = text(raw['phone']);
  if (phone.length > 40) return { ok: false, error: 'El teléfono puede tener hasta 40 caracteres.', field: 'phone' };
  const planCode = text(raw['planCode']);
  if (!isInquiryPlan(planCode)) return { ok: false, error: 'Falta elegir un plan.', field: 'planCode' };
  const message = text(raw['message']);
  if (message.length < 10 || message.length > 4_000) {
    return { ok: false, error: 'Falta describir el pedido (de 10 a 4.000 caracteres).', field: 'message' };
  }
  const sourceRoute = text(raw['sourceRoute']).slice(0, 200) || '/servicios';

  return {
    ok: true,
    value: {
      requestId,
      fullName,
      email,
      organization: organization || null,
      phone: phone || null,
      planCode,
      message,
      sourceRoute: sourceRoute.startsWith('/') ? sourceRoute : '/servicios',
    },
  };
}
