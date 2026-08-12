/**
 * Calendario — lógica pura de la grilla mensual del listado de eventos.
 *
 * Fechas manejadas como strings 'YYYY-MM-DD' (comparables lexicográficamente),
 * el mismo formato que Drupal devuelve en field_fecha (date range).
 */

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function fechaISO(anio: number, mes: number, dia: number): string {
  return `${anio}-${pad2(mes)}-${pad2(dia)}`;
}

export function diasEnMes(anio: number, mes: number): number {
  return new Date(anio, mes, 0).getDate();
}

/** Devuelve el 'YYYY-MM' del mes siguiente/posterior a (anio, mes). */
export function mesSiguiente(anio: number, mes: number): { anio: number; mes: number } {
  return mes === 12 ? { anio: anio + 1, mes: 1 } : { anio, mes: mes + 1 };
}

export function mesAnterior(anio: number, mes: number): { anio: number; mes: number } {
  return mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 };
}

export interface DiaCelda {
  /** Fecha ISO del día (los rellenos de semanas vecinas son días reales del mes adyacente). */
  fecha: string;
  dia: number;
  esDelMes: boolean;
}

/** Grilla de 6 semanas (42 celdas) para el mes indicado, empezando en domingo. */
export function construirGrillaMes(anio: number, mes: number): DiaCelda[] {
  const primerDia = new Date(anio, mes - 1, 1);
  const offset = primerDia.getDay();
  const total = diasEnMes(anio, mes);
  const celdas: DiaCelda[] = [];

  for (let i = 0; i < 42; i++) {
    const dia = i - offset + 1;
    if (dia >= 1 && dia <= total) {
      celdas.push({ fecha: fechaISO(anio, mes, dia), dia, esDelMes: true });
    } else {
      const fecha = new Date(anio, mes - 1, dia);
      celdas.push({
        fecha: fechaISO(fecha.getFullYear(), fecha.getMonth() + 1, fecha.getDate()),
        dia: fecha.getDate(),
        esDelMes: false,
      });
    }
  }
  return celdas;
}

/** ¿El evento (rango de fechas inclusivo) solapa el mes? */
export function solapaConMes(
  inicio: string,
  fin: string,
  anio: number,
  mes: number,
): boolean {
  if (!inicio) return false;
  const finMes = fechaISO(anio, mes, diasEnMes(anio, mes));
  const inicioMes = fechaISO(anio, mes, 1);
  return inicio <= finMes && (fin || inicio) >= inicioMes;
}

/** ¿El evento (rango inclusivo) cubre el día dado? */
export function solapaDia(inicio: string, fin: string, dia: string): boolean {
  if (!inicio) return false;
  return inicio <= dia && (fin || inicio) >= dia;
}

/**
 * Posición de un evento dentro de una semana de 7 días (cada día = 1 columna).
 * Devuelve { columna, span } donde columna es 1-based (1 = domingo).
 */
export function posicionEnSemana(
  inicio: string,
  fin: string,
  anio: number,
  mes: number,
  semana: number,
): { columna: number; span: number } | null {
  const grilla = construirGrillaMes(anio, mes);
  const inicioSemana = semana * 7;
  if (inicioSemana >= grilla.length) return null;

  let columna = 0;
  let span = 0;
  for (let i = inicioSemana; i < inicioSemana + 7; i++) {
    const celda = grilla[i];
    if (solapaDia(inicio, fin, celda.fecha)) {
      if (columna === 0) columna = i - inicioSemana + 1;
      span++;
    }
  }
  return span > 0 ? { columna, span } : null;
}
