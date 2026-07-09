import type { GlyStd, GlyApp } from "@gamely/gly-types";

export type AcaiRectProperties =
  (
    | { borderColor: number | (() => number); backgroundColor?: number | (() => number) }
    | { borderColor?: number | (() => number); backgroundColor: number | (() => number) }
  )
  & { radius?: number | (() => number) }
  & { id?: string, span?: number, offset?: number, after?: number, style?: string }
  & { click?: Function, hover?: Function, focus?: Function, unfocus?: Function}
  ;

export function Rect(props: AcaiRectProperties, std: GlyStd) {
  const c0 = props.backgroundColor;
  const c1 = props.borderColor;
  const r = props.radius ?? 0;
  const getColor0 = typeof c0 === 'number' ? () => c0 : c0
  const getColor1 = typeof c1 === 'number' ? () => c1 : c1
  const getRadius = typeof r === 'number'? () => r: r

  return (
    <item
      id={props.id}
      style={props.style}
      after={props.after}
      offset={props.offset}
      span={props.span ?? 1}>
      <node
        hover={props.hover}
        click={props.click}
        focus={props.focus}
        unfocus={props.unfocus}
        draw={(self: GlyApp["data"]) => {
          if (getColor0 !== undefined) {
            std.draw.color(getColor0());
            (std.draw.rect2 || std.draw.rect)(0, 0, 0, self.width, self.height, getRadius());
          }
          if (getColor1 !== undefined) {
            std.draw.color(getColor1());
            (std.draw.rect2 || std.draw.rect)(1, 0, 0, self.width, self.height, getRadius());
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
    id?: string;
  }
  & (
    | { width: number; height: number }
    | { width?: never; height?: never }
  )
  & { click?: Function, hover?: Function, focus?: Function, unfocus?: Function}
  ;

const align1 = (_: number, _2: number) => 0
const align2 = (child: number, parent: number) => (parent - child) / 2
const align3 = (child: number, parent: number) => (parent - child)
const funcH = { left: align1, center: align2, right: align3 }
const funcV = { top: align1, middle: align2, bottom: align3 }

export function AcaiMemoizeImage(
  std: GlyStd,
  ah: AlignImage,
  av: AlignImageHorizontal,
  src: string,
  width: number,
  height: number,
) {
  const std_exists = std.image.exists;
  const std_mensure = std.image.mensure;
  const std_draw = std.image.draw;
  const align = funcH[ah];
  const valign = funcV[av];

  let x = 0;
  let y = 0;

  let func: (data: GlyApp["data"]) => void;
  func = (data) => {
    if (src.length === 0) return;
    if (!std_exists(src)) return;

    [width, height] = std_mensure(src);

    if(width == 0 || height == 0) return;

    x = align(width, data.width);
    y = valign(height, data.height);

    func = () => std_draw(src, x, y);
  }

  return (data: GlyApp["data"]) => func(data);
}

export function Image(props: AcaiImageProperties, std: GlyStd) {
  const src = props.src
  const alignName = props.align ?? "center"
  const valignName = props.valign ?? "middle"
  const align = funcH[alignName]
  const valign = funcV[valignName]
  const getSource = typeof src === 'string' ? () => src : src

  let width = props.width ?? 0;
  let height = props.height ?? 0;

  if (typeof src === 'string') {
    return (
      <item
        style={props.style}
        after={props.after}
        offset={props.offset}
        span={props.span ?? 1}>
        <node draw={AcaiMemoizeImage(std, alignName, valignName, src, width, height)} />
      </item>
    );
  }

  return (
    <item
      id={props.id}
      style={props.style}
      after={props.after}
      offset={props.offset}
      span={props.span ?? 1}>
      <node
        hover={props.hover}
        click={props.click}
        focus={props.focus}
        unfocus={props.unfocus}
        draw={(self: GlyApp["data"]) => {
          const source = getSource();

          if (source.length === 0) return;
          if (!std.image.exists(source)) return;

          if(width == 0 || height == 0) {
            [width, height] = std.image.mensure(source);
          }

          if (width !== 0 && height !== 0) {
            const x = align(width, self.width);
            const y = valign(height, self.height);
            std.image.draw(source, x, y);
          }
        }}
      />
    </item>
  );
}
