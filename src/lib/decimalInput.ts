/**
 * Utilities for handling decimal input with Brazilian format (comma as decimal separator)
 */

/**
 * Normalizes a decimal input value by replacing comma with dot for calculations
 * Allows: digits, comma, dot, and minus sign
 */
export const normalizeDecimalInput = (value: string): string => {
  // Replace comma with dot for internal storage
  return value.replace(',', '.');
};

/**
 * Formats a decimal value for display (replaces dot with comma for BR format)
 */
export const formatDecimalForDisplay = (value: string | number): string => {
  if (value === '' || value === null || value === undefined) return '';
  const str = typeof value === 'number' ? value.toString() : value;
  return str.replace('.', ',');
};

/**
 * Validates and sanitizes decimal input
 * Allows: digits, one decimal separator (comma or dot), optional leading minus
 */
export const sanitizeDecimalInput = (value: string): string => {
  // Allow only digits, comma, dot, and minus
  let sanitized = value.replace(/[^\d,.\-]/g, '');
  
  // Replace comma with dot for consistency
  sanitized = sanitized.replace(',', '.');
  
  // Ensure only one decimal point
  const parts = sanitized.split('.');
  if (parts.length > 2) {
    sanitized = parts[0] + '.' + parts.slice(1).join('');
  }
  
  // Ensure minus is only at the start
  if (sanitized.includes('-')) {
    const hasLeadingMinus = sanitized.startsWith('-');
    sanitized = sanitized.replace(/-/g, '');
    if (hasLeadingMinus) {
      sanitized = '-' + sanitized;
    }
  }
  
  return sanitized;
};

/**
 * Parses a decimal string (with comma or dot) to a number
 */
export const parseDecimal = (value: string): number => {
  if (!value || value === '-') return NaN;
  const normalized = normalizeDecimalInput(value);
  return parseFloat(normalized);
};

/**
 * Handler for decimal input change events
 * Returns the sanitized value ready for state storage
 */
export const handleDecimalInputChange = (
  value: string,
  onChange: (value: string) => void
): void => {
  const sanitized = sanitizeDecimalInput(value);
  onChange(sanitized);
};
