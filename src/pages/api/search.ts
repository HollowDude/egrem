export const prerender = false;

import type { APIRoute } from 'astro';
import { searchContent } from '@/lib/nodehive/search';

export const GET: APIRoute = async ({ url, locals }) => {
  const q = (url.searchParams.get('q') ?? '').trim();
  if (q.length < 2) {
    return new Response(JSON.stringify({ query: q, total: 0, results: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const lang = locals.lang ?? 'es';
  const results = await searchContent(q, lang);
  return new Response(JSON.stringify(results), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
