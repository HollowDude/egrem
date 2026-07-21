/**
 * Configuración de contenido NodeHive.
 *
 * UUIDs de los contenidos en Drupal.
 * Local → UUIDs de desarrollo local.
 * Remoto (lombaoestudios.com) → UUIDs del servidor remoto.
 *
 * TODO: migrar a import.meta.env.NODEHIVE_*_UUID con fallback a local.
 */

const LOCAL = {
  header: '3b4e275f-0dfc-48e1-992e-4cd6e8ba04e8',
  footer: '60f5e816-d6d2-45e3-a08e-709c3f2ab194',
  home: 'f7fa8944-3347-4223-9f2c-1b7feda12bf5',
  actualidad: '447c24f6-6bc7-4bda-af5a-21824bc5c020',
  artistas: 'fe119ad9-68bb-45e3-b6ab-1e84a9400f42',
  musica: '30fbf03c-5539-42c6-886c-ea40a776c52c',
} as const;

const REMOTE = {
  header: '1fd7eda9-acf9-488d-9c2b-c8b9ba3c3eb0',
  footer: 'b86003b8-555c-4d3d-b046-480f68d1e4b9',
  home: '6e8fc6ae-b1e3-4b8c-8fbb-c4425042b018',
  actualidad: '',
  artistas: '',
  musica: '',
} as const;

function getEnv(): 'local' | 'remote' {
  const baseUrl = import.meta.env.NODEHIVE_BASE_URL ?? '';
  return baseUrl.includes('lombaoestudios.com') ? 'remote' : 'local';
}

const env = getEnv();
const UUID = env === 'remote' ? REMOTE : LOCAL;

export const NODEHIVE_CONFIG = {
  fragments: {
    header: UUID.header,
    footer: UUID.footer,
  },
  pages: {
    home: UUID.home,
    actualidad: UUID.actualidad,
    artistas: UUID.artistas,
    musica: UUID.musica,
  },
};
