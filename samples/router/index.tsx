import type { GlyStd } from "@gamely/gly-types";
import { goToPage, loadRuntime } from "./runtime"
import { Pages } from "./allpages";
import { ErrorPage, PageLoading } from "./pages";

export const meta = {
    title: 'a',
    version: '0.0.1',
    description: 'b.'
}

export const config = {
    require: 'http'
}

export const callbacks = {
    load: (_: never, std: GlyStd) => {
        loadRuntime(std, Pages, ErrorPage, PageLoading);
        goToPage('/a', {})
    },
    key: (_: never, std: GlyStd) => {
        if (std.key.press.a) goToPage('/a', {})
        if (std.key.press.b) goToPage('/b', {})
        if (std.key.press.c) goToPage('/c', {})
        if (std.key.press.d) goToPage('/d', {})
        if (std.key.press.up) goToPage('/e', {})
    }
}
