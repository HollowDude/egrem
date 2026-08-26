import { useTranslations } from '@/i18n/translations';
import type { Lang } from '@/i18n';
import type { JSX } from 'react';
import type { ProductoVariacion, TipoArticulo } from '@/types/producto';

export interface Props {
  vRef: ProductoVariacion | null;
  tipo: TipoArticulo;
  lang?: Lang;
}

type Fila = { label: string; value: JSX.Element | string };

export default function ProductoFichaTecnica({ vRef, tipo, lang = 'es' }: Props) {
  const t = useTranslations(lang);
  if (!vRef) return null;

  const filas: Fila[] = [];

  if (tipo === 'libro') {
    if (vRef.editorial) filas.push({ label: t('tienda.ficha.editorial'), value: vRef.editorial });
    if (vRef.autor) filas.push({ label: t('tienda.ficha.autor'), value: vRef.autor });
    if (vRef.edicion) filas.push({ label: t('tienda.product.edicion'), value: vRef.edicion });
    if (vRef.paginas != null) filas.push({ label: t('tienda.ficha.paginas'), value: String(vRef.paginas) });
    if (vRef.isbn) filas.push({ label: t('tienda.ficha.isbn'), value: vRef.isbn });
  } else if (tipo === 'instrumento') {
    if (vRef.materiales) filas.push({ label: t('tienda.ficha.materiales'), value: vRef.materiales });
    if (vRef.garantia) filas.push({ label: t('tienda.ficha.garantia'), value: vRef.garantia });
    if (vRef.accesoriosIncluidos)
      filas.push({ label: t('tienda.ficha.accesorios'), value: vRef.accesoriosIncluidos });
  } else if (tipo === 'disco') {
    if (vRef.artista?.nombre) filas.push({ label: t('tienda.ficha.artista'), value: vRef.artista.nombre });
    if (vRef.formato) filas.push({ label: t('tienda.product.formato'), value: vRef.formato });
    const album = vRef.lanzamientoRelacionado;
    if (album?.titulo) {
      filas.push({
        label: t('tienda.ficha.ver_lanzamiento'),
        value: album.href ? (
          <a
            href={album.href}
            className="text-egrem-gold hover:text-egrem-red transition-colors underline-offset-2 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            {album.titulo}
          </a>
        ) : (
          album.titulo
        ),
      });
    }
    if (album?.sello?.nombre) filas.push({ label: t('tienda.ficha.sello'), value: album.sello.nombre });
  } else {
    return null;
  }

  if (filas.length === 0) return null;

  return (
    <dl className="mt-6 border-t border-form-border pt-4 grid grid-cols-1 gap-2">
      {filas.map((f, i) => (
        <div key={i} className="flex justify-between gap-4 text-small items-baseline">
          <dt className="font-display uppercase text-text-secondary tracking-wider whitespace-nowrap">
            {f.label}
          </dt>
          <dd className="font-display text-egrem-black text-right">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}
