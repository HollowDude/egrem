/**
 * Configuración de contenido NodeHive.
 *
 * Los UUIDs identifican contenido en Drupal. Distintos entornos
 * (dev / staging / prod) usan distintos UUIDs — configúralos vía
 * variables de entorno o edita los defaults aquí.
 *
 * Para añadir una página nueva: agrega su UUID aquí y crea el
 * fetch en pages.ts.
 */

export const NODEHIVE_CONFIG = {
  fragments: {
    header: import.meta.env.NODEHIVE_HEADER_UUID as string | undefined ?? 'd1aa2e61-9d1a-45b7-9433-fcb1d4127190',
    footer: import.meta.env.NODEHIVE_FOOTER_UUID as string | undefined ?? 'b1ba077b-47d7-4968-bbda-56c48d2ecb1e',
  },
  pages: {
    home: import.meta.env.NODEHIVE_HOME_UUID as string | undefined ?? '01c42d09-c898-45d4-9366-98275a2de7fc',
  },
} as const;
