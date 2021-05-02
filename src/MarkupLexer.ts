import * as Lex from "./LexHelpers";

export function markupLexer(i: LexState): data {
  const parse = i.parse;
  const data = i.parse.data;

  // parses everything other than markup tags
  function content(): void {
    let lex: string[] = [],
      ltoke: string = "",
      liner: number = parse.linesSpace;
    const square: boolean =
        data.types[parse.count] === "template_start" &&
        data.token[parse.count].indexOf("<!") === 0 &&
        data.token[parse.count].indexOf("<![") < 0 &&
        data.token[parse.count].charAt(data.token[parse.count].length - 1) === "[",
      record: record = {
        begin: parse.structure[parse.structure.length - 1][1],
        ender: -1,
        lines: liner,
        stack: parse.structure[parse.structure.length - 1][0],
        token: "",
        types: "content",
      };
    while (i.a < i.c) {
      if (i.b[i.a] === "\n") {
        parse.lineNumber += 1;
      }

      // Artifacts nested within an SGML tag
      if (square === true && i.b[i.a] === "]") {
        i.a = i.a - 1;
        ltoke = lex.join("");
        liner = 0;
        record.token = ltoke;
        Lex.recordPush(i, data, record, "");
        break;
      }

      // General content processing
      if (
        lex.length > 0 &&
        ((i.b[i.a] === "<" && i.b[i.a + 1] !== "=" && /\s|\d/.test(i.b[i.a + 1]) === false) ||
          (i.b[i.a] === "[" && i.b[i.a + 1] === "%") ||
          (i.b[i.a] === "{" &&
            (i.b[i.a + 1] === "{" ||
              i.b[i.a + 1] === "%" ||
              i.b[i.a + 1] === "@" ||
              i.b[i.a + 1] === "#")))
      ) {
        // Regular content
        i.a = i.a - 1;
        ltoke = lex.join("");
        ltoke = Lex.bracketSpace(ltoke);
        liner = 0;
        record.token = ltoke;
        if (i.options.wrap > 0) {
          let aa: number = i.options.wrap,
            len: number = ltoke.length,
            startSpace: string = "",
            endSpace: string = "";
          const wrap: number = i.options.wrap,
            store: string[] = [];
          function wrapper(): void {
            if (ltoke.charAt(aa) === " ") {
              store.push(ltoke.slice(0, aa));
              ltoke = ltoke.slice(aa + 1);
              len = ltoke.length;
              aa = wrap;
              return;
            }
            while (aa > 0 && ltoke.charAt(aa) !== " ") {
              aa = aa - 1;
            }
            if (aa > 0) {
              store.push(ltoke.slice(0, aa));
              ltoke = ltoke.slice(aa + 1);
              len = ltoke.length;
              aa = wrap;
            } else {
              aa = wrap;
              while (aa < len && ltoke.charAt(aa) !== " ") {
                aa = aa + 1;
              }
              store.push(ltoke.slice(0, aa));
              ltoke = ltoke.slice(aa + 1);
              len = ltoke.length;
              aa = wrap;
            }
          }
          // HTML anchor lists do not get wrapping unless the content itself exceeds the wrapping limit
          if (
            data.token[data.begin[parse.count]] === "<i.a>" &&
            data.token[data.begin[data.begin[parse.count]]] === "<li>" &&
            data.lines[data.begin[parse.count]] === 0 &&
            parse.linesSpace === 0 &&
            ltoke.length < i.options.wrap
          ) {
            Lex.recordPush(i, data, record, "");
            break;
          }
          if (len < wrap) {
            Lex.recordPush(i, data, record, "");
            break;
          }
          if (parse.linesSpace < 1) {
            let bb = parse.count;
            while (bb > 0 && aa > 0) {
              aa = aa - data.token[bb].length;
              if (data.types[bb].indexOf("attribute") > -1) {
                aa = aa - 1;
              }
              if (data.lines[bb] > 0 && data.types[bb].indexOf("attribute") < 0) {
                break;
              }
              bb = bb - 1;
            }
            if (aa < 1) {
              aa = ltoke.indexOf(" ");
            }
          }
          ltoke = lex.join("");
          ltoke = ltoke.replace(/^\s+/, "").replace(/\s+$/, "").replace(/\s+/g, " ");
          while (aa < len) {
            wrapper();
          }
          if (ltoke !== "" && ltoke !== " ") {
            store.push(ltoke);
          }
          ltoke = store.join(i.options.lf);
          ltoke = startSpace + ltoke + endSpace;
        }
        liner = 0;
        record.token = ltoke;
        Lex.recordPush(i, data, record, "");
        break;
      }
      lex.push(i.b[i.a]);
      i.a = i.a + 1;
    }
  }

  i.a = 0;

  // Main loop
  while (i.a < i.c) {
    if (/\s/.test(i.b[i.a]) === true) {
      if (
        data.types[parse.count] === "template_start" &&
        parse.structure[parse.structure.length - 1][0] === "comment"
      ) {
        content();
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
      content();
    }
    i.a = i.a + 1;
  }
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
