import { GlyStd } from "@gamely/gly-types";
import { Rect, request, Text } from "../../src";
import { sleep } from "./runtime";

export function ErrorPage(props: { getMessage: () => string }, std: GlyStd) {
    return <node>
        <Rect backgroundColor={std.color.red} />
        <Text>{props.getMessage}</Text>
    </node>
}
export function PageLoading(props: {}, std: GlyStd) {
    return <node>
        <Rect backgroundColor={std.color.black} />
        <Text>Loading...</Text>
    </node>
}

export function PageA(props: {}, std: GlyStd) {
    return <node>
        <Rect backgroundColor={std.color.blue} />
        <Text>Page: A</Text>
    </node>

}

export function PageB(props: {}, std: GlyStd) {
    return <node>
        <Rect backgroundColor={std.color.green} />
        <Text>Page: B</Text>
    </node>
}

export async function PageC(props: {}, std: GlyStd) {
    await sleep(1000);

    return <node>
        <Rect backgroundColor={std.color.green} />
        <Text>Page: C</Text>
    </node>
}

export function* PageD(props: {}, std: GlyStd) {
    yield <node>
        <Rect backgroundColor={std.color.yellow} />
        <Text>Page: D (1)</Text>
    </node>

    yield async () => await sleep(500);

    yield <node>
        <Rect backgroundColor={std.color.orange} />
        <Text>Page: D (2)</Text>
    </node>

    yield async () => await sleep(500);

    return <node>
        <Rect backgroundColor={std.color.red} />
        <Text>Page: D (3)</Text>
    </node>
}
