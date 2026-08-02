export const MAX_MESSAGE_LENGTH = 500;
export const MIN_MESSAGE_LENGTH = 10;
export const MIN_NAME_LENGTH = 2;

export type ContactField = 'inquiry' | 'name' | 'email' | 'message';

export type ContactErrorCode =
  | 'inquiry_required'
  | 'name_required'
  | 'email_invalid'
  | 'message_required'
  | 'message_too_short'
  | 'message_too_long';

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ContactValues = Record<ContactField, string>;

export function validateField(field: ContactField, value: string): ContactErrorCode | null {
  const trimmed = value.trim();
  switch (field) {
    case 'inquiry':
      return trimmed.length > 0 ? null : 'inquiry_required';
    case 'name':
      if (trimmed.length === 0) return 'name_required';
      return trimmed.length >= MIN_NAME_LENGTH ? null : 'name_required';
    case 'email':
      return EMAIL_REGEX.test(trimmed) ? null : 'email_invalid';
    case 'message':
      if (trimmed.length === 0) return 'message_required';
      if (trimmed.length < MIN_MESSAGE_LENGTH) return 'message_too_short';
      if (trimmed.length > MAX_MESSAGE_LENGTH) return 'message_too_long';
      return null;
  }
}

const FIELDS: ContactField[] = ['inquiry', 'name', 'email', 'message'];

export function validateContact(values: Partial<ContactValues>): Partial<Record<ContactField, ContactErrorCode>> {
  const errors: Partial<Record<ContactField, ContactErrorCode>> = {};
  FIELDS.forEach((field) => {
    const code = validateField(field, values[field] ?? '');
    if (code) errors[field] = code;
  });
  return errors;
}

export function hasValidationErrors(errors: Partial<Record<ContactField, ContactErrorCode>>): boolean {
  return Object.values(errors).some((code) => code !== null && code !== undefined);
}
