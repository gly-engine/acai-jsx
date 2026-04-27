export function createState<T>(
  value: T extends (...args: any[]) => infer R
    ? R extends (...args: any[]) => any
    ? never
    : T
    : T
): [
    () => T extends (...args: any[]) => infer R ? R : T,
    (
      newValue:
        | (T extends (...args: any[]) => infer R ? R : T)
        | ((prev: T extends (...args: any[]) => infer R ? R : T) => T extends (...args: any[]) => infer R ? R : T)
    ) => void
  ] {
  type V = T extends (...args: any[]) => infer R ? R : T;

  const shared = { value: (typeof value === "function" ? (value as () => any)() : value) as V };

  const get = (): V => shared.value;

  const set = (newValue: V | ((prev: V) => V)) => {
    if (typeof newValue === "function") {
      shared.value = (newValue as (prev: V) => V)(shared.value);
    } else {
      shared.value = newValue;
    }
  };

  return [get, set];
}
