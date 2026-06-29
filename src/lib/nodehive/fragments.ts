import { jsonApiFetch } from './client';
import { findIncluded, findAllIncluded, resolveRelIds } from './helpers';
import { parseButton, parseMediaImage } from './parsers';
import type { NhLink, NhButton, NhMediaImage, NhBase } from './parsers';
import type { JsonApiResource } from './client';
import { NODEHIVE_CONFIG } from './config';

export interface NhRed {
  id: string;
  link: NhLink;
}

export interface NhContacto {
  id: string;
  direccion: string;
  correo: string;
  telefono: string;
  boton: NhButton | null;
}

export interface NhHeaderFragment extends NhBase {
  title: string;
  logo: NhMediaImage | null;
}

export interface NhFooterFragment extends NhBase {
  title: string;
  derechos: string;
  logo: NhMediaImage | null;
  redes: NhRed[];
  contacto: NhContacto | null;
}

export async function fetchHeaderFragment(lang = 'es'): Promise<NhHeaderFragment> {
  const HEADER_UUID = NODEHIVE_CONFIG.fragments.header;

  const res = await jsonApiFetch(
    `nodehive_fragment/header/${HEADER_UUID}?include=field_logo,field_logo.field_media_image`,
    lang,
  );

  const data = res.data as JsonApiResource;
  const included = res.included;
  const attrs = data.attributes as Record<string, unknown>;

  let logo: NhMediaImage | null = null;
  const logoRefs = resolveRelIds(data.relationships?.field_logo);
  if (logoRefs.length) {
    const mediaRes = findIncluded(included, 'media--image', logoRefs[0].id);
    if (mediaRes) logo = parseMediaImage(mediaRes, included);
  }

  return {
    id: data.id,
    title: (attrs.title as string) ?? '',
    logo,
  };
}

export async function fetchFooterFragment(lang = 'es'): Promise<NhFooterFragment> {
  const FOOTER_UUID = NODEHIVE_CONFIG.fragments.footer;

  const [resBase, resRedes, resContacto] = await Promise.all([
    jsonApiFetch(
      `nodehive_fragment/footer/${FOOTER_UUID}?include=field_logo,field_logo.field_media_image`,
      lang,
    ),
    jsonApiFetch(
      `nodehive_fragment/footer/${FOOTER_UUID}?include=field_redes`,
      lang,
    ),
    jsonApiFetch(
      `nodehive_fragment/footer/${FOOTER_UUID}?include=field_contacto,field_contacto.field_button`,
      lang,
    ),
  ]);

  const data = resBase.data as JsonApiResource;
  const attrs = data.attributes as Record<string, unknown>;

  let logo: NhMediaImage | null = null;
  const logoRefs = resolveRelIds(data.relationships?.field_logo);
  if (logoRefs.length) {
    const mediaRes = findIncluded(resBase.included, 'media--image', logoRefs[0].id);
    if (mediaRes) logo = parseMediaImage(mediaRes, resBase.included);
  }

  const redes: NhRed[] = [];
  const redItems = findAllIncluded(resRedes.included, 'paragraph--red');
  for (const red of redItems) {
    const ra = red.attributes as Record<string, unknown>;
    const link = ra.field_link as { uri: string; title: string } | null;
    if (link) {
      redes.push({ id: red.id, link: { uri: link.uri, title: link.title ?? '' } });
    }
  }

  let contacto: NhContacto | null = null;
  const contactoItems = findAllIncluded(resContacto.included, 'paragraph--_component_footer_contacto');
  if (contactoItems.length) {
    const ca = contactoItems[0].attributes as Record<string, unknown>;
    const botonItems = findAllIncluded(resContacto.included, 'paragraph--button');
    contacto = {
      id: contactoItems[0].id,
      direccion: (ca.field_direccion as string) ?? '',
      correo: (ca.field_correo_contacto as string) ?? '',
      telefono: (ca.field_telefono as string) ?? '',
      boton: botonItems.length ? parseButton(botonItems[0]) : null,
    };
  }

  return {
    id: data.id,
    title: (attrs.title as string) ?? '',
    derechos: (attrs.field_derechos as string) ?? '',
    logo,
    redes,
    contacto,
  };
}
