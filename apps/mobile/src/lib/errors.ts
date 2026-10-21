/**
 * Spanish copy for API errors. The API sends a stable `code` (see docs/API.md);
 * the app owns the wording, so the server can stay language-neutral.
 */

const BY_CODE: Record<string, string> = {
  // accounts
  invalid_credentials: 'Correo o contraseña incorrectos.',
  email_taken: 'Ese correo ya tiene una cuenta. Prueba iniciar sesión.',
  account_inactive: 'Tu cuenta no está activa. Contacta a soporte.',
  user_not_found: 'No encontramos esa cuenta.',
  invalid_email: 'Escribe un correo válido.',
  invalid_password: 'La contraseña debe tener entre 8 y 72 caracteres.',
  invalid_phone: 'Escribe el teléfono con código de país, por ejemplo +573001234567.',
  invalid_currency: 'Esa moneda no está disponible.',
  invalid_range: 'La fecha de inicio debe ser anterior a la de fin.',
  invalid_coordinates: 'La ubicación no es válida.',
  invalid_radius: 'El radio debe estar entre 1 y 20000 km.',
  invalid_name: 'Escribe tu nombre (máximo 150 caracteres).',
  invalid_city: 'El nombre de la ciudad es demasiado largo.',
  // tasks
  task_not_found: 'Esta tarea ya no existe.',
  category_not_found: 'Elige una categoría válida.',
  invalid_title: 'El título es obligatorio (máximo 200 caracteres).',
  invalid_description: 'La descripción es obligatoria (máximo 5000 caracteres).',
  invalid_budget:
    'Revisa el presupuesto: los montos deben ser positivos y el máximo no puede ser menor al mínimo.',
  invalid_location: 'Indica dónde será la tarea o márcala como remota.',
  past_schedule: 'La fecha no puede estar en el pasado.',
  not_owner: 'Solo quien publicó la tarea puede hacer esto.',
  invalid_transition: 'Esa acción no está disponible con el estado actual de la tarea.',
  // applications
  application_not_found: 'Esa postulación ya no existe.',
  not_applicant: 'Solo quien se postuló puede hacer esto.',
  own_task: 'No puedes postularte a tu propia tarea.',
  task_not_open: 'Esta tarea ya no recibe postulaciones.',
  already_applied: 'Ya te postulaste a esta tarea.',
  application_not_open: 'Esta postulación ya fue resuelta.',
  invalid_price: 'El precio debe ser mayor a cero.',
  invalid_message: 'El mensaje es demasiado largo (máximo 2000 caracteres).',
  // live service
  not_assigned_worker: 'Solo la persona que hace el servicio puede hacer esto.',
  client_busy: 'Ya tienes un servicio en curso. Finalízalo antes de contratar otro.',
  worker_busy:
    'Esta persona está haciendo otro servicio ahora. Elige a otra o espera a que termine.',
  route_not_started: 'Primero inicia la ruta.',
  // reviews
  review_not_found: 'Esa reseña ya no existe.',
  not_task_participant: 'Solo quien publicó la tarea y la persona elegida pueden calificar.',
  not_reviewee: 'Solo la persona calificada puede responder.',
  task_not_completed: 'Podrás calificar cuando la tarea esté finalizada.',
  already_reviewed: 'Ya calificaste esta tarea.',
  already_replied: 'Esta reseña ya tiene una respuesta.',
  invalid_rating: 'Elige de 1 a 5 estrellas.',
  invalid_comment: 'El comentario es demasiado largo (máximo 1000 caracteres).',
  invalid_reply: 'Escribe tu respuesta (máximo 1000 caracteres).',
};

const BY_STATUS: Record<number, string> = {
  400: 'Revisa los datos e inténtalo de nuevo.',
  401: 'Tu sesión expiró. Ingresa de nuevo.',
  403: 'No tienes permiso para hacer esto.',
  404: 'No encontramos lo que buscas.',
  409: 'Esta acción ya no es posible. Actualiza e inténtalo de nuevo.',
  413: 'Lo que enviaste es demasiado grande.',
  429: 'Demasiados intentos. Espera un momento e inténtalo otra vez.',
};

export function messageFor(status: number, code?: string): string {
  if (code && BY_CODE[code]) return BY_CODE[code];
  if (status >= 500)
    return 'Tuvimos un problema de nuestro lado. Inténtalo de nuevo en un momento.';
  return BY_STATUS[status] ?? 'Algo salió mal. Inténtalo de nuevo.';
}

/** Short Spanish text for a failed validation rule on one field. */
const BY_RULE: Record<string, string> = {
  required: 'Este campo es obligatorio.',
  min: 'Es demasiado corto.',
  max: 'Es demasiado largo.',
  email: 'Escribe un correo válido.',
  url: 'Escribe un enlace válido.',
  gt: 'Debe ser mayor a cero.',
  len: 'Longitud no válida.',
  oneof: 'Opción no válida.',
};

export function messageForRule(rule: string): string {
  return BY_RULE[rule] ?? 'Revisa este campo.';
}
