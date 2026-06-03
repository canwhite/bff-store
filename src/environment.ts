/**
 * Environment detection utilities
 */

export function isNode(): boolean {
  return typeof window === 'undefined' && typeof process !== 'undefined';
}

export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}
