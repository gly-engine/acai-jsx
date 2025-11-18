import type { GlyStd, GlyApp } from "@gamely/gly-types";

type rectProperties = { borderColor: number; backgroundColor?: number } | { borderColor?: number; backgroundColor: number };

type PngProperties = { src: string; center_x?: boolean; img_width?: number; center_y?: boolean; img_height?: number };

export function Rect(props: rectProperties, std: GlyStd): JSX.Element {
  return {
    draw: (self: GlyApp['data']) => {
      if (props.backgroundColor !== undefined) {
        std.draw.color(props.backgroundColor);
        std.draw.rect(0, 0, 0, self.width, self.height);
      }
      if (props.borderColor !== undefined) {
        std.draw.color(props.borderColor);
        std.draw.rect(1, 0, 0, self.width, self.height);
      }
    },
  };
}

export function Png(props: PngProperties, std: GlyStd): JSX.Element {
  return {
    draw: (self: GlyApp['data']) => {
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
