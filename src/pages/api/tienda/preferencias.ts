import type { APIRoute } from 'astro';
import {
  MUNICIPIOS_COOKIE,
  MUNICIPIOS_COOKIE_MAX_AGE,
  type MunicipioSeleccionado,
} from '@/lib/tienda/ubicacion';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  let body: { seleccion?: MunicipioSeleccionado[] };
  try {
    body = (await request.json()) as { seleccion?: MunicipioSeleccionado[] };
  } catch {
    return new Response(null, { status: 400 });
  }
  const seleccion = Array.isArray(body.seleccion) ? body.seleccion : [];
  cookies.set(MUNICIPIOS_COOKIE, JSON.stringify(seleccion), {
    path: '/',
    maxAge: MUNICIPIOS_COOKIE_MAX_AGE,
    httpOnly: false, // el popup y el filtro client-side necesitan leerla sin round-trip
    sameSite: 'lax',
  });
  return new Response(null, { status: 204 });
};
