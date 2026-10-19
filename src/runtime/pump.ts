import type { GlyStd } from "@gamely/gly-types";

export function scheduleEnginePump(_std?: GlyStd): void {
    const g = globalThis as Record<string, unknown>;
    const pump = g.__gly_schedule_pump ?? g.scheduleLuaPump;
    if (typeof pump !== "function") return;
    try {
        (pump as () => void)();
    } catch {
    }
}
