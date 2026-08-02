import { describe, it, expect } from 'vitest';
import {
  validateField,
  validateContact,
  hasValidationErrors,
  MAX_MESSAGE_LENGTH,
  MIN_MESSAGE_LENGTH,
  MIN_NAME_LENGTH,
} from '../validation';

describe('validateField: inquiry', () => {
  it('rejects empty inquiry', () => {
    expect(validateField('inquiry', '')).toBe('inquiry_required');
    expect(validateField('inquiry', '   ')).toBe('inquiry_required');
  });

  it('accepts a selected inquiry', () => {
    expect(validateField('inquiry', 'general')).toBeNull();
  });
});

describe('validateField: name', () => {
  it('rejects empty name', () => {
    expect(validateField('name', '')).toBe('name_required');
    expect(validateField('name', '  ')).toBe('name_required');
  });

  it('rejects name shorter than minimum', () => {
    expect(validateField('name', 'a')).toBe('name_required');
  });

  it('accepts name at minimum length', () => {
    expect(validateField('name', 'a'.repeat(MIN_NAME_LENGTH))).toBeNull();
  });
});

describe('validateField: email', () => {
  it('rejects empty email', () => {
    expect(validateField('email', '')).toBe('email_invalid');
  });

  it('rejects invalid emails', () => {
    expect(validateField('email', 'juan')).toBe('email_invalid');
    expect(validateField('email', 'juan@')).toBe('email_invalid');
    expect(validateField('email', 'juan@ejemplo')).toBe('email_invalid');
    expect(validateField('email', '@ejemplo.com')).toBe('email_invalid');
    expect(validateField('email', 'juan @ejemplo.com')).toBe('email_invalid');
  });

  it('accepts valid emails', () => {
    expect(validateField('email', 'juan.perez@ejemplo.com')).toBeNull();
    expect(validateField('email', ' info@egrem.co.cu ')).toBeNull();
  });
});

describe('validateField: message', () => {
  it('rejects empty message', () => {
    expect(validateField('message', '')).toBe('message_required');
    expect(validateField('message', '     ')).toBe('message_required');
  });

  it('rejects message shorter than minimum', () => {
    expect(validateField('message', 'hola')).toBe('message_too_short');
    expect(validateField('message', 'a'.repeat(MIN_MESSAGE_LENGTH - 1))).toBe('message_too_short');
  });

  it('accepts message at minimum length', () => {
    expect(validateField('message', 'a'.repeat(MIN_MESSAGE_LENGTH))).toBeNull();
  });

  it('accepts message within the maximum limit', () => {
    expect(validateField('message', 'a'.repeat(MAX_MESSAGE_LENGTH))).toBeNull();
  });

  it('rejects message exceeding the maximum limit', () => {
    expect(validateField('message', 'a'.repeat(MAX_MESSAGE_LENGTH + 1))).toBe('message_too_long');
  });
});

describe('validateContact', () => {
  it('returns errors only for invalid fields', () => {
    const errors = validateContact({
      inquiry: 'general',
      name: '',
      email: 'correo@ejemplo.com',
      message: 'Mensaje de prueba suficientemente largo',
    });
    expect(errors).toEqual({ name: 'name_required' });
  });

  it('returns all errors when everything is empty', () => {
    const errors = validateContact({ inquiry: '', name: '', email: '', message: '' });
    expect(errors).toEqual({
      inquiry: 'inquiry_required',
      name: 'name_required',
      email: 'email_invalid',
      message: 'message_required',
    });
  });

  it('treats missing values as empty', () => {
    const errors = validateContact({});
    expect(errors).toEqual({
      inquiry: 'inquiry_required',
      name: 'name_required',
      email: 'email_invalid',
      message: 'message_required',
    });
  });

  it('returns no errors for valid values', () => {
    const errors = validateContact({
      inquiry: 'events',
      name: 'Juan Pérez',
      email: 'juan@ejemplo.com',
      message: 'Hola, me interesa contratar a la orquesta.',
    });
    expect(errors).toEqual({});
  });
});

describe('hasValidationErrors', () => {
  it('is true when any field has an error', () => {
    expect(hasValidationErrors({ email: 'email_invalid' })).toBe(true);
  });

  it('is false when empty or all null', () => {
    expect(hasValidationErrors({})).toBe(false);
    expect(hasValidationErrors({ inquiry: null })).toBe(false);
  });
});
