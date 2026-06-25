export function isNullEmptyOrWhitespace(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.length === 0 || value.trim().length === 0;
}
