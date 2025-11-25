# acai-jsx

A design ecosystem for reusing JSX components in Gly Engine with TypeScript.

```jsx
import { GlyStd } from "@gamely/gly-types";
import { Rect } from "@gamely/acai-jsx/dist/basics";

export function Page(props: never, std: GlyStd): JSX.Element {
  return {
    load() {
      <grid class="4x1">
        <Rect backgroundColor={std.color.green} />
        <Rect backgroundColor={std.color.blue} />
        <Rect backgroundColor={std.color.yellow} />
        <Rect backgroundColor={std.color.red} />
      </grid>;
    },
  };
}
```
