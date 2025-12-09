import type { GlyStd, GlyApp } from "@gamely/gly-types";

export type AlignText = "left" | "right" | "justify" | "center";
export type AlignTextSimple = "left" | "right" | "center";
export type AlignTextHorizontal = "top" | "middle" | "bottom";

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
  width: number,
  height: number | undefined,
  lh: number,
  ah: "left" | "right" | "justify" | "center",
  av: "top" | "middle" | "bottom"
) {
  const tokens: AcaiTextToken[] = [];
  const words = text.split(" ");
  const spaceSize = std.text.mensure_width(" ");
  let y = 0;

  let lineWords: { word: string; width: number; height: number }[] = [];
  let lineWidth = 0;
  const lines: AcaiTextToken[][] = [];

  function commitLine(isLast: boolean) {
    if (lineWords.length === 0) return;

    const lineTokens: AcaiTextToken[] = [];
    let offsetX = 0;

    if (ah === "center") offsetX = (width - lineWidth) / 2;
    else if (ah === "right") offsetX = width - lineWidth;
    else if (ah === "justify" && lineWords.length > 1 && !(isLast && lineWidth < width * 0.7)) {
      const totalSpaces = lineWords.length - 1;
      const extraSpace = (width - lineWidth) / totalSpaces;
      let x = 0;
      lineWords.forEach((lw, idx) => {
        lineTokens.push({ x, y, word: lw.word, w: lw.width, h: lw.height });
        x += lw.width;
        if (idx < totalSpaces) x += spaceSize + extraSpace;
      });
      lines.push(lineTokens);
      y += lh;
      lineWords = [];
      lineWidth = 0;
      return;
    }

    lineWords.forEach(lw => {
      lineTokens.push({ x: offsetX, y, word: lw.word, w: lw.width, h: lw.height });
      offsetX += lw.width + spaceSize;
    });

    lines.push(lineTokens);
    y += lh;
    lineWords = [];
    lineWidth = 0;
  }

  function replaceLastWordWithEllipsis() {
    const dots = "...";
    const w = std.text.mensure_width(dots);
    const lastLine = lines.at(-1);
    if (!lastLine) return;

    const last = lastLine[lastLine.length - 1];
    const oldWidth = last.w;
    last.word = dots;
    last.w = w;

    if (ah === "right") {
      let newLineWidth = lastLine.reduce((acc, t, idx) => {
        if (idx > 0) acc += spaceSize;
        return acc + t.w;
      }, 0);

      let x = width - newLineWidth;
      lastLine.forEach((t, idx) => {
        t.x = x;
        x += t.w + spaceSize;
      });
    } else if (ah === "center") {
      let newLineWidth = lastLine.reduce((acc, t, idx) => {
        if (idx > 0) acc += spaceSize;
        return acc + t.w;
      }, 0);

      let x = (width - newLineWidth) / 2;
      lastLine.forEach((t, idx) => {
        t.x = x;
        x += t.w + spaceSize;
      });
    }
  }

  for (let i = 0; i < words.length; i++) {
    const w = std.text.mensure_width(words[i]);
    const h = lh;

    const nextLineOverflow = lineWidth > 0 && lineWidth + spaceSize + w > width;

    if (nextLineOverflow) {
      const nextY = y + lh;

      if (height !== undefined && nextY > height) {
        commitLine(true);
        replaceLastWordWithEllipsis();
        return lines.flat();
      }

      commitLine(false);
    }

    lineWords.push({ word: words[i], width: w, height: h });
    lineWidth += (lineWidth > 0 ? spaceSize : 0) + w;
  }

  const nextY = y + lh;

  if (height !== undefined && nextY > height) {
    commitLine(true);
    replaceLastWordWithEllipsis();
    return lines.flat();
  }

  commitLine(true);

  const totalTextHeight = lines.length * lh;
  let offsetY = 0;

  if (height !== undefined) {
    if (av === "middle") offsetY = (height - totalTextHeight) / 2;
    else if (av === "bottom") offsetY = height - totalTextHeight;
  }

  lines.forEach(line => {
    line.forEach(t => {
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

  let cacheText = getContent();
  let cacheFontSize = getFontSize();
  let cacheFontName = getFontName();
  let cacheLH = getLineHeight();
  let cacheAH = getAlignH();
  let cacheAV = getAlignV();
  let cacheWidth = 0;
  let cacheHeight = 0;
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
          const w = self.width
          const h = self.height

          if (text.length <= 0) return;

          const fontSize = getFontSize();
          const fontName = getFontName();
          const LH = getLineHeight();
          const AH = getAlignH();
          const AV = getAlignV();

          if (fontName.length > 0) std.text.font_name(fontName);
          std.text.font_size(fontSize);
          std.draw.color(getColor());

          if (text != cacheText || fontSize != cacheFontSize || fontName != cacheFontName
            || LH != cacheLH || AH != cacheAH || AV != cacheAV || w != cacheWidth || h != cacheHeight) {
            cacheText = text;
            cacheFontSize = fontSize;
            cacheFontName = fontName;
            cacheLH = LH;
            cacheAH = AH;
            cacheAV = AV;
            cacheWidth = w;
            cacheHeight = h;
            tokens = AcaiGenerateTextTokens(std, text, w, h, LH, AH, AV);
          }

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
  const ah = props.align
  const av = props.valign
  const ah_is_function = typeof ah === 'function'
  const av_is_function = typeof av === 'function'
  const ah_value = (!ah_is_function && ah !== undefined? mapH[ah]: 0)
  const av_value = (!av_is_function && av !== undefined? mapV[av]: 0)
  const getColor = typeof color !== 'function' ? () => color : color
  const getContent = typeof content !== 'function' ? () => content : content
  const getFontSize = typeof f_size !== 'function' ? () => f_size : f_size
  const getFontName = typeof f_name !== 'function' ? () => f_name : f_name
  const getAlignH = !ah_is_function? () => ah_value : (() => mapH[ah()])
  const getAlignV = !av_is_function? () => av_value : (() => mapV[av()])

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

          std.text.print_ex(x, y, text, h as 0, v as 0);
        }}
      />
    </item>
  );
}
