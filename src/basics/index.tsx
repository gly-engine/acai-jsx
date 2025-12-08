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

export type PngProperties = {
  src: string;
  center_x?: boolean;
  img_width?: number;
  center_y?: boolean;
  img_height?: number;
};

export function Png(props: PngProperties, std: GlyStd): JSX.Element {
  return {
    draw: (self: GlyApp["data"]) => {
      let x = 0,
        y = 0;
      if (props.center_x !== undefined && props.img_width !== undefined) {
        x = (self.width - props.img_width) / 2;
      }
      if (props.center_y !== undefined && props.img_height !== undefined) {
        y = (self.height - props.img_height) / 2;
      }
      std.image.draw(props.src, x, y);
    },
  };
}
