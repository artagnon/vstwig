import * as Lex from "./LexHelpers";

export function markupLexer(i: LexState): data {
  const parse = i.parse;
  const data = i.parse.data;

  // Main loop
  for (i.a = 0; i.a < i.c; i.a += 1) {
    if (/\s/.test(i.b[i.a]) === true) {
      if (
        data.types[parse.count] === "template_start" &&
        parse.structure[parse.structure.length - 1][0] === "comment"
      ) {
        Lex.content(i);
      } else {
        i.a = parse.spacer({ array: i.b, end: i.c, index: i.a });
      }
    } else if (i.b[i.a] === "<") {
      Lex.tag(i, "");
    } else if (i.b[i.a] === "[" && i.b[i.a + 1] === "%") {
      Lex.tag(i, "%]");
    } else if (
      i.b[i.a] === "{" &&
      (i.b[i.a + 1] === "{" || i.b[i.a + 1] === "%" || i.b[i.a + 1] === "@" || i.b[i.a + 1] === "#")
    ) {
      Lex.tag(i, "");
    } else if (i.b[i.a] === "]" && i.sgmlflag > 0) {
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
