import type { GlyStd, GlyHandlerArgs } from "@gamely/gly-types";

type textProperties = {
  label?: string;
  color?: number;
  font_size?: number;
  font_name?: string;
  align?: "left" | "right" | "justify" | "center";
  valign?: "top" | "middle" | "bottom";
  line_height?: number;
  listen_label?: string;
  listen_color?: string;
  listen_align?: string;
  listen_font?: string;
};

type textToken = {
  x: number;
  y: number;
  word: string;
};

type textRequiredFields = {
  flag: boolean;
  width: number;
  height: number;
  label: NonNullable<textProperties["label"]>;
  color: NonNullable<textProperties["color"]>;
  align: NonNullable<textProperties["align"]>;
  valign: NonNullable<textProperties["valign"]>;
  line_size: NonNullable<textProperties["line_height"]>;
  font_size: NonNullable<textProperties["font_size"]>;
  font_name: textProperties["font_name"];
  tokens: Array<textToken>;
};

export function Text(props: textProperties, std: GlyStd): JSX.Element {
  function recalculateText(self: textRequiredFields) {
    self.tokens = [];

    const spaceSize = std.text.mensure(" ") as unknown as number;
    const lineHeight = self.line_size;

    const words = self.label.split(" ");

    let y = 0;
    let lineWords: { word: string; width: number }[] = [];
    let lineWidth = 0;

    const allLines: textToken[][] = [];

    function commitLine(isLast: boolean) {
      if (lineWords.length === 0) return;

      if (y + lineHeight > self.height) {
        lineWords = [];
        return;
      }

      const lineTokens: textToken[] = [];
      let offsetX = 0;

      if (self.align === "center") {
        offsetX = (self.width - lineWidth) / 2;
      } else if (self.align === "right") {
        offsetX = self.width - lineWidth;
      } else if (self.align === "justify" && lineWords.length > 1) {
        if (isLast && lineWidth < self.width * 0.7) {
          offsetX = 0;
          lineWords.forEach((lw) => {
            lineTokens.push({ x: offsetX, y, word: lw.word });
            offsetX += lw.width + spaceSize;
          });
          allLines.push(lineTokens);
          y += lineHeight;
          lineWords = [];
          lineWidth = 0;
          return;
        }

        const totalSpaces = lineWords.length - 1;
        const extraSpace = (self.width - lineWidth) / totalSpaces;
        let curX = 0;
        lineWords.forEach((lw, idx) => {
          lineTokens.push({ x: curX, y, word: lw.word });
          curX += lw.width;
          if (idx < totalSpaces) curX += spaceSize + extraSpace;
        });
        allLines.push(lineTokens);
        y += lineHeight;
        lineWords = [];
        lineWidth = 0;
        return;
      }

      lineWords.forEach((lw) => {
        lineTokens.push({ x: offsetX, y, word: lw.word });
        offsetX += lw.width + spaceSize;
      });

      allLines.push(lineTokens);
      y += lineHeight;
      lineWords = [];
      lineWidth = 0;
    }

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const width = std.text.mensure(word) as unknown as number;
      const isLastWord = i === words.length - 1;

      if (lineWidth > 0 && lineWidth + spaceSize + width > self.width) {
        commitLine(false);
        if (y + lineHeight > self.height) break;
      }

      lineWords.push({ word, width });
      lineWidth += (lineWidth > 0 ? spaceSize : 0) + width;

      if (isLastWord) {
        commitLine(true);
      }
    }

    const totalTextHeight = allLines.length * lineHeight;
    let offsetY = 0;
    if (self.valign === "middle") {
      offsetY = (self.height - totalTextHeight) / 2;
    } else if (self.valign === "bottom") {
      offsetY = self.height - totalTextHeight;
    }

    allLines.forEach((line) => {
      line.forEach((token) => {
        self.tokens.push({
          x: token.x,
          y: token.y + offsetY,
          word: token.word,
        });
      });
    });
  }

  return {
    load: (self: textRequiredFields) => {
      std.bus.listen(props.listen_color!, ((value: number) => {
        self.color = value;
      }) as GlyHandlerArgs);
      std.bus.listen(props.listen_label!, ((value: string) => {
        self.label = value;
        self.flag = true;
      }) as GlyHandlerArgs);
      std.bus.listen(props.listen_align!, ((
        value: NonNullable<textProperties["align"]>,
      ) => {
        self.align = value;
        self.flag = true;
      }) as GlyHandlerArgs);
      std.bus.listen(props.listen_font!, ((
        size?: number,
        name?: string,
        line_height?: number,
      ) => {
        self.font_size = size ?? self.font_size;
        self.line_size = line_height ?? props.line_height ?? self.font_size;
        self.font_name = name ?? self.font_name;
        self.flag = true;
      }) as GlyHandlerArgs);

      self.font_size = props.font_size!;
      self.line_size = props.line_height ?? self.font_size;
      self.font_name = props.font_name;
      self.color = props.color ?? std.color.white;
      self.align = props.align ?? "left";
      self.valign = props.valign ?? "top";
      self.label = props.label!;
      self.tokens = [];
      self.flag = true;
    },
    draw: (self: textRequiredFields) => {
      if (!self.label || (!self.font_size && !self.color)) return;

      if (self.font_name !== undefined) {
        std.text.font_name(self.font_name);
      }

      std.text.font_size(self.font_size);
      std.draw.color(self.color);

      if (self.flag) {
        recalculateText(self);
        self.flag = false;
      }

      self.tokens.forEach((token) =>
        std.text.print(token.x, token.y, token.word),
      );
    },
  };
}
