import * as Lex from "./LexHelpers";

export function markupLexer(i: LexState): ParseData {
  const parse = i.parse;
  const data = i.parse.data;

  // Main loop
  for (i.start = 0; i.start < i.end; i.start += 1) {
    if (/\s/.test(i.chars[i.start]) === true) {
      if (
        data.types[parse.count] === "template_start" &&
        parse.structure[parse.structure.length - 1][0] === "comment"
      ) {
        Lex.content(i);
      } else {
        i.start = parse.spacer({ chars: i.chars, end: i.end, index: i.start });
      }
    } else if (i.chars[i.start] === "<") {
      Lex.tag(i, "");
    } else if (i.chars[i.start] === "[" && i.chars[i.start + 1] === "%") {
      Lex.tag(i, "%]");
    } else if (
      i.chars[i.start] === "{" &&
      (i.chars[i.start + 1] === "{" ||
        i.chars[i.start + 1] === "%" ||
        i.chars[i.start + 1] === "@" ||
        i.chars[i.start + 1] === "#")
    ) {
      Lex.tag(i, "");
    } else if (i.chars[i.start] === "]" && i.sgmlflag > 0) {
      Lex.tag(i, "]>");
    } else {
      Lex.content(i);
    }
  }

  // Final error reporting
  if (
    data.token[parse.count].charAt(0) !== "/" &&
    i.htmlblocks[parse.structure[parse.structure.length - 1][0]] === "block"
  ) {
    Lex.fixHtmlEnd(i, data.token[parse.count], true);
  }
  if (i.count.end !== i.count.start && i.parseerror === "") {
    if (i.count.end > i.count.start) {
      let x: number = i.count.end - i.count.start,
        plural: string = x === 1 ? "" : "s";
      i.parseerror = `${x} more end type${plural} than start types.`;
    } else {
      let x: number = i.count.start - i.count.end,
        plural: string = x === 1 ? "" : "s";
      i.parseerror = `${x} more start type${plural} than end types.`;
    }
  }
  return data;
}
