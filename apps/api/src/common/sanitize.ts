import { Transform } from 'class-transformer';

/**
 * Strip HTML tags and dangerous markup from a plain-text user input.
 *
 * This is intended for fields that must never contain HTML (notes, bios,
 * message bodies, reasons). It removes tags entirely rather than escaping
 * them, so the stored value stays human-readable plain text and cannot be
 * used for stored XSS if it is ever rendered as raw HTML.
 */
export function sanitizePlainText(value: string): string {
  return (
    value
      // Drop <script>...</script> and <style>...</style> including content.
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
      // Drop any remaining HTML tags.
      .replace(/<\/?[^>]+>/g, '')
      // Neutralise leftover angle brackets.
      .replace(/[<>]/g, '')
      .trim()
  );
}

/**
 * class-transformer decorator that sanitizes a string property during
 * validation/transformation. Non-string values are passed through unchanged.
 */
export function SanitizeText() {
  return Transform(({ value }) =>
    typeof value === 'string' ? sanitizePlainText(value) : value,
  );
}
