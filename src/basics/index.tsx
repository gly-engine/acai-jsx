import type { GlyStd, GlyApp } from "@gamely/gly-types";

export type AcaiRectProperties =
  (
    | { borderColor: number | (() => number); backgroundColor?: number | (() => number) }
    | { borderColor?: number | (() => number); backgroundColor: number | (() => number) }
  )
  & { span?: number, offset?: number, after?: number, style?: string }
  ;

export function Rect(props: AcaiRectProperties, std: GlyStd) {
  const c0 = props.backgroundColor;
  const c1 = props.borderColor;
  const getColor0 = typeof c0 === 'number' ? () => c0 : c0
  const getColor1 = typeof c1 === 'number' ? () => c1 : c1

  return (
    <item
      style={props.style}
      after={props.after}
      offset={props.offset}
      span={props.span ?? 1}>
      <node
        draw={(self: GlyApp["data"]) => {
          if (getColor0 !== undefined) {
            std.draw.color(getColor0());
            std.draw.rect(0, 0, 0, self.width, self.height);
          }
          if (getColor1 !== undefined) {
            std.draw.color(getColor1());
            std.draw.rect(1, 0, 0, self.width, self.height);
          }
        }}
      />
    </item>
  );
}

export type AlignImage = "left" | "right" | "center";
export type AlignImageHorizontal = "top" | "middle" | "bottom";

export type AcaiImageProperties =
  {
    src: (string) | (() => string);
    align?: ("left" | "center" | "right");
    valign?: ("top" | "middle" | "bottom");
    span?: number;
    offset?: number;
    after?: number;
    style?: string;
  }
  & (
    | { width: number; height: number }
    | { width?: never; height?: never }
  );

const align1 = (_: number, _2: number) => 0
const align2 = (child: number, parent: number) => (parent - child) / 2
const align3 = (child: number, parent: number) => (parent - child)

export function Image(props: AcaiImageProperties, std: GlyStd) {
  const src = props.src
  const hasFixedSize = props.width !== undefined
  const mapH = { left: align1, center: align2, right: align3 }
  const mapV = { top: align1, middle: align2, bottom: align3 }
  const align = mapH[props.align ?? "left"]
  const valign = mapV[props.valign ?? "top"]
  const getSource = typeof src === 'string' ? () => src : src

  let cache = '';
  let width = props.width ?? 0;
  let height = props.height ?? 0;

  return (
    <item
      style={props.style}
      after={props.after}
      offset={props.offset}
      span={props.span ?? 1}>
      <node
        draw={(self: GlyApp["data"]) => {
          const source = getSource();

          if (source.length === 0) return;

          if (!hasFixedSize && cache !== source) {
            if (!std.image.exists(source)) return;
            height = std.image.mensure_height(source);
            width = std.image.mensure_width(source);
            cache = source;
          }

          if (source && width !== 0 && height !== 0) {
            const x = align(width, self.width);
            const y = valign(height, self.height);
            std.image.draw(source, x, y);
          }
        }}
      />
    </item>
  );
}
