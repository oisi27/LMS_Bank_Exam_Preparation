/**
 * Bangladeshi Mobile Number Validation and Normalization Utilities
 *
 * Valid formats for Bangladesh mobile numbers:
 * - Local 11 digits: 013XXXXXXXX, 014XXXXXXXX, 015XXXXXXXX, 016XXXXXXXX, 017XXXXXXXX, 018XXXXXXXX, 019XXXXXXXX
 * - International without +: 8801XXXXXXXXX (13 digits)
 * - International with +: +8801XXXXXXXXX (14 characters)
 * - May contain spaces, dashes, or parentheses from user input which should be stripped
 *
 * Normalizes all valid numbers to international E.164 format:
 * +8801XXXXXXXXX (14 characters total)
 */

export function normalizeBangladeshPhone(input: string): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  // Strip all whitespace, hyphens, parentheses, and dots
  const cleaned = input.replace(/[\s\-\(\)\.]/g, '').trim();

  // Pattern breakdown for valid Bangladeshi mobile numbers:
  // Starts optionally with (+88|88)? followed by 01[3-9]\d{8}
  // Operators:
  // 013, 017: Grameenphone
  // 014, 019: Banglalink
  // 015: Teletalk
  // 016, 018: Robi / Airtel

  const bdRegex = /^(?:\+?88)?(01[3-9]\d{8})$/;
  const match = cleaned.match(bdRegex);

  if (!match) {
    return null;
  }

  const localPart = match[1]; // 01XXXXXXXXX (11 digits)
  return `+88${localPart}`;   // +8801XXXXXXXXX (E.164)
}

export function isValidBangladeshPhone(input: string): boolean {
  return normalizeBangladeshPhone(input) !== null;
}
