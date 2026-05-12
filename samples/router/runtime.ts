import { GlyStd } from "@gamely/gly-types";
import type { Pages } from "./allpages";
import { createRouter, createTimer } from "../../src";
import { AcaiRouterPageError, AcaiRouterPageSplash } from "../../src/runtime/router";

const [router, setRouterConfig] = createRouter<typeof Pages>()

const [timer, setTimerConfig] = createTimer()

export const goToPage = router.go

export const sleep = timer.sleep

export const setTimeout = timer.timeout

export const setInterval = timer.interval

export function loadRuntime(std: GlyStd, pages: typeof Pages, errorpage: AcaiRouterPageError, splash: AcaiRouterPageSplash) {
    setTimerConfig({std})
    setRouterConfig({std})
    router.registerAll(pages);
    router.register('@splash', splash);
    router.register('@error', errorpage);
}
