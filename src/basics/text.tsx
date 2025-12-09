import type { GlyStd, GlyApp } from "@gamely/gly-types";

export type AcaiTextBlockProperties =
  (
    | { content: string | (() => string); children?: never }
    | { content?: never; children: string | (() => string) }
  ) & {
    color?: number | (() => number);
    font_size?: number | (() => number);
    font_name?: string | (() => string);
    line_height?: number | (() => number);
    align?: ("left" | "right" | "justify" | "center") | (() => "left" | "right" | "justify" | "center");
    valign?: ("top" | "middle" | "bottom") | (() => "top" | "middle" | "bottom");
  } & {
    span?: number;
    offset?: number;
    after?: number;
    style?: string;
  };

export type AcaiTextToken = {
  x: number;
  y: number;
  w: number;
  h: number;
  word: string;
};

export function AcaiGenerateTextTokens(
  std: GlyStd,
  text: string,
  size: number,
  lh: number,
  ah: "left" | "right" | "justify" | "center",
  av: "top" | "middle" | "bottom"
) {
  const tokens: Array<AcaiTextToken> = [];

  const words = text.split(" ");

  const spaceSize = std.text.mensure_width(" ");
  const lineHeight = lh;

  let y = 0;
  let lineWords: { word: string; width: number; height: number }[] = [];
  let lineWidth = 0;

  const allLines: {
    x: number;
    y: number;
    word: string;
    w: number;
    h: number;
  }[][] = [];

  function commitLine(isLast: boolean) {
    if (lineWords.length === 0) return;

    const lineTokens: {
      x: number;
      y: number;
      word: string;
      w: number;
      h: number;
    }[] = [];

    let offsetX = 0;

    if (ah === "center") {
      offsetX = (size - lineWidth) / 2;
    } else if (ah === "right") {
      offsetX = size - lineWidth;
    } else if (ah === "justify" && lineWords.length > 1) {
      if (isLast && lineWidth < size * 0.7) {
        let x = 0;
        lineWords.forEach((lw) => {
          lineTokens.push({
            x,
            y,
            word: lw.word,
            w: lw.width,
            h: lw.height
          });
          x += lw.width + spaceSize;
        });

        allLines.push(lineTokens);
        y += lineHeight;
        lineWords = [];
        lineWidth = 0;
        return;
      }

      const totalSpaces = lineWords.length - 1;
      const extraSpace = (size - lineWidth) / totalSpaces;

      let x = 0;
      lineWords.forEach((lw, idx) => {
        lineTokens.push({
          x,
          y,
          word: lw.word,
          w: lw.width,
          h: lw.height
        });

        x += lw.width;
        if (idx < totalSpaces) x += spaceSize + extraSpace;
      });

      allLines.push(lineTokens);
      y += lineHeight;
      lineWords = [];
      lineWidth = 0;
      return;
    }

    lineWords.forEach((lw) => {
      lineTokens.push({
        x: offsetX,
        y,
        word: lw.word,
        w: lw.width,
        h: lw.height
      });
      offsetX += lw.width + spaceSize;
    });

    allLines.push(lineTokens);
    y += lineHeight;
    lineWords = [];
    lineWidth = 0;
  }

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const width = std.text.mensure_width(word);
    const height = std.text.mensure_width(word);

    const isLastWord = i === words.length - 1;

    if (lineWidth > 0 && lineWidth + spaceSize + width > size) {
      commitLine(false);
    }

    lineWords.push({ word, width, height });
    lineWidth += (lineWidth > 0 ? spaceSize : 0) + width;

    if (isLastWord) commitLine(true);
  }

  const totalTextHeight = allLines.length * lineHeight;
  let offsetY = 0;

  if (av === "middle") offsetY = (size - totalTextHeight) / 2;
  else if (av === "bottom") offsetY = size - totalTextHeight;

  allLines.forEach((line) => {
    line.forEach((t) => {
      tokens.push({
        x: t.x,
        y: t.y + offsetY,
        word: t.word,
        w: t.w,
        h: t.h
      });
    });
  });

  return tokens;
}

export function TextBlock(props: AcaiTextBlockProperties, std: GlyStd) {
  const color = props.color ?? std.color.white;
  const content = props.children ?? props.content;
  const f_size = props.font_size ?? 12;
  const f_name = props.font_name ?? "";
  const lh = props.line_height ?? f_size;
  const ah = props.align ?? "center";
  const av = props.valign ?? "middle";
  const getColor = typeof color !== 'function' ? () => color : color;
  const getContent = typeof content !== 'function' ? () => content : content;
  const getFontSize = typeof f_size !== 'function' ? () => f_size : f_size;
  const getFontName = typeof f_name !== 'function' ? () => f_name : f_name;
  const getLineHeight = typeof lh !== 'function' ? () => lh : lh;
  const getAlignH = typeof ah !== 'function' ? () => ah : ah;
  const getAlignV = typeof av !== 'function' ? () => av : av;

  let cacheText = '';
  let cacheFontSize = getFontSize();
  let cacheFontName = getFontName();
  let cacheLH = getLineHeight();
  let cacheAH = getAlignH();
  let cacheAV = getAlignV();
  let tokens: Array<AcaiTextToken>;

  return (
    <item
      style={props.style}
      after={props.after}
      offset={props.offset}
      span={props.span ?? 1}>
      <node
        draw={(self: GlyApp["data"]) => {
          const text = getContent();

          if (text.length <= 0) return;

          const fontSize = getFontSize();
          const fontName = getFontName();
          const lineHeight = getLineHeight();
          const alignH = getAlignH();
          const AlignV = getAlignV();

          if (text != cacheText || fontSize != cacheFontSize || fontName != cacheFontName
            || lineHeight != cacheLH || alignH != cacheAH || AlignV != cacheAV) {
            cacheText = text;
            cacheFontSize = fontSize;
            cacheFontName = fontName;
            cacheLH = lineHeight;
            cacheAH = alignH;
            cacheAV = AlignV;
            tokens = AcaiGenerateTextTokens(std, text, fontSize, lineHeight, alignH, AlignV);
          }

          if (fontName.length > 0) std.text.font_name(fontName);

          std.text.font_size(fontSize);
          std.draw.color(getColor());

          tokens.forEach((token) =>
            std.text.print(token.x, token.y, token.word),
          );
        }}
      />
    </item>
  );
}

export type AcaiTextProperties =
  (
    | { content: string | (() => string); children?: never }
    | { content?: never; children: string | (() => string) }
  ) & {
    color?: number | (() => number);
    font_size?: number | (() => number);
    font_name?: string | (() => string);
    align?: ("left" | "right" | "center") | (() => "left" | "right" | "center");
    valign?: ("top" | "middle" | "bottom") | (() => "top" | "middle" | "bottom");
  } & {
    span?: number;
    offset?: number;
    after?: number;
    style?: string;
  };


export function Text(props: AcaiTextProperties, std: GlyStd) {
  const mapH = { left: -1, center: 0, right: 1 }
  const mapV = { top: -1, middle: 0, bottom: 1 }
  const color = props.color ?? std.color.white
  const content = props.children ?? props.content
  const f_size = props.font_size ?? 12
  const f_name = props.font_name ?? ""
  const ah = props.align ?? mapH["center"]
  const av = props.valign ?? mapV["middle"]
  const getColor = typeof color !== 'function' ? () => color : color
  const getContent = typeof content !== 'function' ? () => content : content
  const getFontSize = typeof f_size !== 'function' ? () => f_size : f_size
  const getFontName = typeof f_name !== 'function' ? () => f_name : f_name
  const getAlignH = (typeof ah !== 'function' ? () => ah : (() => mapH[ah()])) as (() => -1 | 0 | 1)
  const getAlignV = (typeof av !== 'function' ? () => av : (() => mapV[av()])) as (() => -1 | 0 | 1)

  return (
    <item
      style={props.style}
      after={props.after}
      offset={props.offset}
      span={props.span ?? 1}>
      <node
        draw={(self: GlyApp["data"]) => {
          const text = getContent();
          const font = getFontName();

          if (text.length < 0) return;
          if (font.length > 0) std.text.font_name(font);

          let x = 0, y = 0, h = getAlignH(), v = getAlignV();

          if (h === 0) x = self.width / 2;
          if (h === 1) x = self.width;
          if (v === 0) y = self.height / 2;
          if (v === 1) y = self.height;

          std.text.font_size(getFontSize());
          std.draw.color(getColor());

          std.text.print_ex(x, y, text, h, v);
        }}
      />
    </item>
  );
}
