import { msg, t } from '@yourtime/shared-utils';

/**
 * Copy for API errors. The API sends a stable `code` (see docs/API.md); the app owns
 * the wording, so the server can stay language-neutral. The texts are marked with
 * `msg` and translated when shown, so they follow the language chosen at that moment.
 */

const BY_CODE: Record<string, string> = {
  // accounts
  invalid_credentials: msg('Correo o contraseña incorrectos.'),
  email_taken: msg('Ese correo ya tiene una cuenta. Prueba iniciar sesión.'),
  account_inactive: msg('Tu cuenta no está activa. Contacta a soporte.'),
  user_not_found: msg('No encontramos esa cuenta.'),
  invalid_email: msg('Escribe un correo válido.'),
  registration_closed: msg('Este servidor no está aceptando cuentas nuevas.'),
  invalid_password: msg('La contraseña debe tener entre 8 y 72 caracteres.'),
  invalid_phone: msg('Escribe el teléfono con código de país, por ejemplo +573001234567.'),
  invalid_currency: msg('Esa moneda no está disponible.'),
  invalid_language: msg('Ese idioma no está disponible.'),
  invalid_range: msg('La fecha de inicio debe ser anterior a la de fin.'),
  invalid_coordinates: msg('La ubicación no es válida.'),
  invalid_radius: msg('El radio debe estar entre 1 y 20000 km.'),
  invalid_name: msg('Escribe tu nombre (máximo 150 caracteres).'),
  invalid_city: msg('El nombre de la ciudad es demasiado largo.'),
  // tasks
  task_not_found: msg('Esta tarea ya no existe.'),
  category_not_found: msg('Elige una categoría válida.'),
  invalid_title: msg('El título es obligatorio (máximo 200 caracteres).'),
  invalid_description: msg('La descripción es obligatoria (máximo 5000 caracteres).'),
  invalid_budget: msg(
    'Revisa el presupuesto: los montos deben ser positivos y el máximo no puede ser menor al mínimo.'
  ),
  invalid_location: msg('Indica dónde será la tarea o márcala como remota.'),
  past_schedule: msg('La fecha no puede estar en el pasado.'),
  not_owner: msg('Solo quien publicó la tarea puede hacer esto.'),
  invalid_transition: msg('Esa acción no está disponible con el estado actual de la tarea.'),
  // applications
  application_not_found: msg('Esa postulación ya no existe.'),
  not_applicant: msg('Solo quien se postuló puede hacer esto.'),
  own_task: msg('No puedes postularte a tu propia tarea.'),
  task_not_open: msg('Esta tarea ya no recibe postulaciones.'),
  already_applied: msg('Ya te postulaste a esta tarea.'),
  application_not_open: msg('Esta postulación ya fue resuelta.'),
  invalid_price: msg('El precio debe ser mayor a cero.'),
  invalid_message: msg('El mensaje es demasiado largo (máximo 2000 caracteres).'),
  // live service
  not_assigned_worker: msg('Solo la persona que hace el servicio puede hacer esto.'),
  client_busy: msg('Ya tienes un servicio en curso. Finalízalo antes de contratar otro.'),
  worker_busy: msg(
    'Esta persona está haciendo otro servicio ahora. Elige a otra o espera a que termine.'
  ),
  route_not_started: msg('Primero inicia la ruta.'),
  // wallet
  insufficient_balance: msg('Tu saldo no alcanza para cubrir la comisión. Recarga tu billetera.'),
  applicant_insufficient_balance: msg(
    'Esta persona ya no tiene saldo suficiente para que la elijas. Elige a otra.'
  ),
  invalid_amount: msg('El monto debe ser mayor a cero.'),
  amount_too_large: msg('Ese monto es más grande de lo permitido.'),
  test_topups_disabled: msg('Las recargas de prueba están desactivadas.'),
  promo_code_not_found: msg('Ese código no existe.'),
  promo_code_unavailable: msg('Ese código venció, se agotó o ya no está activo.'),
  promo_already_redeemed: msg('Ya canjeaste ese código.'),
  promo_code_taken: msg('Ya hay otra promoción con ese código.'),
  promotion_not_found: msg('Esa promoción ya no existe.'),
  invalid_promotion: msg('Revisa la promoción: faltan datos o no son válidos.'),
  invalid_settings: msg('Revisa la configuración: hay valores fuera de rango.'),
  not_admin: msg('Solo quien administra la app puede hacer esto.'),
  currency_locked: msg('Tu moneda quedó fija porque ya tienes una billetera.'),
  currency_changed: msg('Tu moneda cambió mientras tanto. Inténtalo de nuevo.'),
  rates_unavailable: msg('No hay tipos de cambio ahora mismo. Inténtalo en un momento.'),
  // reviews
  review_not_found: msg('Esa reseña ya no existe.'),
  not_task_participant: msg('Solo quien publicó la tarea y la persona elegida pueden calificar.'),
  not_reviewee: msg('Solo la persona calificada puede responder.'),
  task_not_completed: msg('Podrás calificar cuando la tarea esté finalizada.'),
  already_reviewed: msg('Ya calificaste esta tarea.'),
  already_replied: msg('Esta reseña ya tiene una respuesta.'),
  invalid_rating: msg('Elige de 1 a 5 estrellas.'),
  invalid_comment: msg('El comentario es demasiado largo (máximo 1000 caracteres).'),
  invalid_reply: msg('Escribe tu respuesta (máximo 1000 caracteres).'),
};

const BY_STATUS: Record<number, string> = {
  400: msg('Revisa los datos e inténtalo de nuevo.'),
  401: msg('Tu sesión expiró. Ingresa de nuevo.'),
  403: msg('No tienes permiso para hacer esto.'),
  404: msg('No encontramos lo que buscas.'),
  409: msg('Esta acción ya no es posible. Actualiza e inténtalo de nuevo.'),
  413: msg('Lo que enviaste es demasiado grande.'),
  429: msg('Demasiados intentos. Espera un momento e inténtalo otra vez.'),
};

export function messageFor(status: number, code?: string): string {
  if (code && BY_CODE[code]) return t(BY_CODE[code]);
  if (status >= 500)
    return t('Tuvimos un problema de nuestro lado. Inténtalo de nuevo en un momento.');
  return t(BY_STATUS[status] ?? msg('Algo salió mal. Inténtalo de nuevo.'));
}

/** Short text for a failed validation rule on one field. */
const BY_RULE: Record<string, string> = {
  required: msg('Este campo es obligatorio.'),
  min: msg('Es demasiado corto.'),
  max: msg('Es demasiado largo.'),
  email: msg('Escribe un correo válido.'),
  url: msg('Escribe un enlace válido.'),
  gt: msg('Debe ser mayor a cero.'),
  len: msg('Longitud no válida.'),
  oneof: msg('Opción no válida.'),
};

export function messageForRule(rule: string): string {
  return t(BY_RULE[rule] ?? msg('Revisa este campo.'));
}
