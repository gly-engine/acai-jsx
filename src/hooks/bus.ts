type AcaiTopic<TArgs extends any[] = []> = (...args: TArgs) => void;

export function createBus<TArgs extends any[] = []>(): LuaMultiReturn<[
  emit: (...args: TArgs) => void,
  on: (cb: AcaiTopic<TArgs>) => void,
  off: (cb: AcaiTopic<TArgs>) => void,
  offAll: () => void
]> {
  let listeners = new LuaSet<AcaiTopic<TArgs>>();

  const emit = (...args: TArgs) => {
    for (const cb of listeners) {
      cb(...args);
    }
  };

  const on = (cb: AcaiTopic<TArgs>) => {
    listeners.add(cb);
  };

  const off = (cb: AcaiTopic<TArgs>) => {
    listeners.delete(cb);
  };

  const offAll = () => {
    listeners = new LuaSet();
  };

  return $multi(emit, on, off, offAll);
}
