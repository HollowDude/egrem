import type { APIRoute } from 'astro';
import { fetchVideosCatalogo } from '@/lib/nodehive/videos';

export const GET: APIRoute = async ({ url }) => {
  const lang = url.searchParams.get('lang') || 'es';
  const artista = url.searchParams.get('artista') || undefined;
  const tipo = url.searchParams.get('tipo') || undefined;
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));

  const result = await fetchVideosCatalogo({ artista, tipo, page }, lang);

  return new Response(
    JSON.stringify({
      videos: result.videos,
      hasMore: result.hasMore,
      total: result.total,
      currentPage: result.currentPage,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
};
