import type { GlyStd } from "@gamely/gly-types";

/** Resume HTML5/Fengari frame loop after async I/O or Promise continuation. */
export function scheduleEnginePump(_std?: GlyStd): void {
    const g = globalThis as Record<string, unknown>;
    const pump = g.__gly_schedule_pump ?? g.scheduleLuaPump;
    if (typeof pump !== "function") return;
    try {
        (pump as () => void)();
    } catch {
        /* host may not expose pump */
    }
}
