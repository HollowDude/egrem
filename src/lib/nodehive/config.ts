/**
 * Configuración de contenido NodeHive.
 *
 * UUIDs de los contenidos en Drupal. Se configuran aquí directamente
 * para distinguir por entorno si es necesario.
 *
 * Para añadir una página nueva: agrega su UUID aquí y crea el fetch
 * en pages.ts.
 */

export const NODEHIVE_CONFIG = {
  fragments: {
    header: '3b4e275f-0dfc-48e1-992e-4cd6e8ba04e8',
    footer: '60f5e816-d6d2-45e3-a08e-709c3f2ab194',
  },
  pages: {
    home: 'f7fa8944-3347-4223-9f2c-1b7feda12bf5',
  },
} as const;
