# EGREM — Empresa de Grabaciones y Ediciones Musicales

Sitio web oficial de EGREM, la disquera más importante de Cuba. Catálogo de música, artistas, eventos, producciones y contenidos audiovisuales.

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | [Astro](https://astro.build) v6 (SSR, `@astrojs/node` standalone) |
| UI runtime | React 19 (islotes interactivos) |
| Estilos | Tailwind CSS v4 + CSS nativo |
| Backend | Drupal (NodeHive JSON:API) |
| Lenguaje | TypeScript (strict mode) |

## Requisitos

- Node.js >= 22.12.0

## Comandos

```bash
npm run dev       # Servidor de desarrollo (SSR, puerto 4321)
npm run build     # Build de producción
npm run preview   # Preview del build de producción
npm run check     # TypeScript + Astro diagnostics
```

## Variables de entorno

Copia `.env.example` a `.env` y completa los valores:

```
NODEHIVE_BASE_URL=https://tu-drupal.com
NODEHIVE_API_KEY=
NODEHIVE_EDITOR_DEV_MODE=true   # opcional: activa editor UI sin Drupal
```

## Arquitectura

Ver [`CLAUDE.md`](./CLAUDE.md) para documentación detallada de arquitectura, sistema de estilos, integración NodeHive y convenciones del proyecto.
