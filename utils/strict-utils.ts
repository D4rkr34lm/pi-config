export function toPairs<T extends { [key in keyof T]: unknown }>(
  obj: T
): [keyof T, T[keyof T]][] {
  return Object.entries(obj) as [keyof T, T[keyof T]][];
}
