/**
 * @todo revisar
 */
import type { GlyStd } from "@gamely/gly-types";

export type AcaiTimerHandle = number;

export type AcaiTimerCallback = (this: void) => void;

export type AcaiTimer = {
    sleep: (this: void, ms: number) => Promise<void>;
    timeout: (this: void, fn: AcaiTimerCallback, ms: number) => AcaiTimerHandle;
    interval: (this: void, fn: AcaiTimerCallback, ms: number) => AcaiTimerHandle;
    clear: (this: void, id: AcaiTimerHandle) => void;
};

export type AcaiTimerConfig = {
    std: GlyStd;
};

export type AcaiSetTimerConfig = (config: AcaiTimerConfig) => void;

export type AcaiTimerWithSetConfig = LuaMultiReturn<[AcaiTimer, AcaiSetTimerConfig]>;

type Entry = {
    id: AcaiTimerHandle;
    target: number;
    period?: number;
    fn: AcaiTimerCallback;
};

type State = {
    std?: GlyStd;
    entries: Entry[];
    nextId: number;
    attached: boolean;
};


function tick(s: State): void {
    if (!s.std) return;
    const now = s.std.milis;
    const snapshot = s.entries.slice();
    for (const entry of snapshot) {
        if (now < entry.target) continue;
        const i = s.entries.indexOf(entry);
        if (i < 0) continue;
        if (entry.period !== undefined) {
            entry.target = now + entry.period;
            entry.fn();
        } else {
            s.entries.splice(i, 1);
            entry.fn();
        }
    }
}

function clear(s: State, id: AcaiTimerHandle): void {
    const i = s.entries.findIndex(e => e.id === id);
    if (i >= 0) s.entries.splice(i, 1);
}

function attach(s: State): void {
    if (s.attached || !s.std) return;
    s.attached = true;
    s.std.bus.listen('loop', () => {
        tick(s)
    });


}function schedule(s: State, fn: AcaiTimerCallback, ms: number, period?: number): AcaiTimerHandle {
    if (!s.std) throw new Error("Missing std in Acai Timer!");
    const id = ++s.nextId;
    const target = s.std.milis + ms;
    s.entries.push({ id, target, period, fn });
    return id;
}

export function createTimer(): AcaiTimerWithSetConfig {
    const s: State = {
        entries: [],
        nextId: 0,
        attached: false,
    };

    const timer: AcaiTimer = {
        sleep: (ms) => new Promise<void>((resolve) => {
            schedule(s, () => resolve(), ms);
        }),
        timeout: (fn, ms) => schedule(s, fn, ms),
        interval: (fn, ms) => schedule(s, fn, ms, ms),
        clear: (id) => clear(s, id),
    };

    const setConfig: AcaiSetTimerConfig = (config) => {
        s.std = config.std;
        attach(s);
    };

    return $multi(timer, setConfig);
}
