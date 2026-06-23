type AcaiTopic<TArgs extends any[] = []> = (...args: TArgs) => void;

export declare function createBus<TArgs extends any[] = []>(): LuaMultiReturn<[
    emit: (...args: TArgs) => void,
    on: (cb: AcaiTopic<TArgs>) => void,
    off: (cb: AcaiTopic<TArgs>) => void,
    offAll: () => void
]>;
