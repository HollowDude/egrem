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
  videos: 'fe9e5209-55f7-460e-8e37-d7634709d8f8',
  about: 'b4cc549e-751d-43a5-8ea1-5496e5736f42',
  contacto: 'b2ca5aa2-b6f3-43f3-beab-648288260d81',
  eventos: 'e431371b-c361-4ace-a879-4a947093a192',
} as const;

const REMOTE = {
  header: '1fd7eda9-acf9-488d-9c2b-c8b9ba3c3eb0',
  footer: 'b86003b8-555c-4d3d-b046-480f68d1e4b9',
  home: 'f6cf9495-ba50-4fa9-8287-539336fed646',
  actualidad: '312253f1-c6c4-4bd0-a3a9-328fa4979c75',
  artistas: 'bcb1d38e-35ef-46dc-856f-e57f19ac427e',
  musica: '6be43ce0-36da-4bf1-bc0f-4a4e4ca30aa4',
  videos: 'c48b47ba-11e6-4ab5-8fca-ea389ddab14b',
  about: 'da7f8d9c-c0f8-49f6-9c0f-053a1eedebf9',
  contacto: 'e4c6766c-5b23-4641-abe3-ce6530c631ab',
  eventos: 'b7c079b9-98f9-4c90-b640-79779c8a08da',
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
    videos: UUID.videos,
    about: UUID.about,
    contacto: UUID.contacto,
    eventos: UUID.eventos,
  },
};
