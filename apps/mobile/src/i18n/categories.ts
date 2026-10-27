import { msg, t } from '@yourtime/shared-utils';

/**
 * The category names live in the database in Spanish. Listing them here lets them be
 * translated like any other text; a name that is not listed shows as it came.
 */
const CATEGORY_NAMES = [
  msg('Hogar y reparaciones'),
  msg('Limpieza'),
  msg('Mudanzas y transporte'),
  msg('Jardinería'),
  msg('Tecnología'),
  msg('Clases y tutorías'),
  msg('Mascotas'),
  msg('Mandados'),
  msg('Eventos'),
  msg('Otros'),
] as const;

export const categoryName = (name: string): string =>
  (CATEGORY_NAMES as readonly string[]).includes(name) ? t(name) : name;
