export const PROVINCE_CODES: Record<string, string> = {
  '01': 'Pinar del Río',
  '02': 'Artemisa',
  '03': 'La Habana',
  '04': 'Mayabeque',
  '05': 'Matanzas',
  '06': 'Cienfuegos',
  '07': 'Villa Clara',
  '08': 'Sancti Spíritus',
  '09': 'Ciego de Ávila',
  '10': 'Camagüey',
  '11': 'Las Tunas',
  '12': 'Holguín',
  '13': 'Granma',
  '14': 'Santiago de Cuba',
  '15': 'Guantánamo',
  '16': 'Isla de la Juventud',
};

export function getProvinceName(code: string): string {
  return PROVINCE_CODES[code] ?? code;
}
