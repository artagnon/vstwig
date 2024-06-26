/* Pads certain template tag delimiters with start space */
export function bracketSpace(input: string): string {
  let spaceStart = (start: string) => start.replace(/\s*$/, " ");
  let spaceEnd = (end: string): string => end.replace(/^\s*/, " ");
  if (
    /\{(=|#|\/|(%>)|(%\]))/.test(input) === true ||
    /\}%(>|\])/.test(input) === true
  )
    return input;
  input = input.replace(/\{((\{+)|%-?)\s*/g, spaceStart);
  input = input.replace(/\s*((\}\}+)|(-?%\}))/g, spaceEnd);
  return input;
}

// pushes start record into the parse table
export function recordPush(
  i: LexState,
  target: ParseData,
  record: DataRecord,
  structure: string
): void {
  if (target === i.parse.data) {
    if (record.types.indexOf("end") > -1) i.count.end = i.count.end + 1;
    else if (record.types.indexOf("start") > -1)
      i.count.start = i.count.start + 1;
  }
  i.parse.push(target, record, structure);
}

// Find the lowercase tag name of the provided token.
export function tagName(i: LexState, el: string): string {
  let space: number = 0,
    name: string = "";
  const reg: RegExp = /^((\{|<)((%-?)|\{-?)=?\s*)/;
  if (typeof el !== "string") return "";
  space = el.replace(reg, "%").replace(/\s+/, " ").indexOf(" ");
  name = el.replace(reg, " ");
  name = space < 0 ? name.slice(1, el.length - 1) : name.slice(1, space);
  if (i.html === "html") name = name.toLowerCase();
  name = name.replace(/(\}\})$/, "");
  if (name.indexOf("(") > 0) name = name.slice(0, name.indexOf("("));
  if (name === "?xml?") return "xml";
  return name;
}

// A fix for HTML missing end tags
export function fixHtmlEnd(i: LexState, element: string, end: boolean): void {
  const parse = i.parse;
  const data = parse.data;
  const tname: string = tagName(i, element),
    record: DataRecord = {
      begin: parse.structure[parse.structure.length - 1][1],
      ender: -1,
      lines: data.lines[parse.count] > 0 ? 1 : 0,
      stack: parse.structure[parse.structure.length - 1][0],
      token: `</${parse.structure[parse.structure.length - 1][0]}>`,
      types: "end",
    };
  recordPush(i, data, record, "");
  while (
    i.htmlblocks[parse.structure[parse.structure.length - 1][0]] === "block" &&
    ((end === true && parse.structure.length > 1) ||
      (end === false &&
        `/${parse.structure[parse.structure.length - 1][0]}` !== tname))
  ) {
    record.begin = parse.structure[parse.structure.length - 1][1];
    record.stack = parse.structure[parse.structure.length - 1][0];
    record.token = `</${parse.structure[parse.structure.length - 1][0]}>`;
    recordPush(i, data, record, "");
  }
}

function templateAtt(
  i: LexState,
  record: DataRecord,
  sample: string,
  token: string
): DataRecord {
  const data: ParseData = i.parse.data;

  if (sample.charAt(0) === "{" && "{%".indexOf(sample.charAt(1)) > -1)
    record.types = "template_attribute";
  else {
    record.token = token;
    recordPush(i, data, record, "");
    return record;
  }
  record.token = token;
  recordPush(i, data, record, "");
  record.types = "attribute";
  return record;
}

// attribute parser
function attributeRecord(
  i: LexState,
  element: string,
  attstore: AttStore,
  tname: string,
  ltype: string,
  record: DataRecord
): void {
  let ind: number = 0,
    eq: number = 0,
    dq: number = 0,
    slice: string = "",
    name: string = "",
    store: string[] = [],
    len: number = attstore.length;
  const parse: Parse = i.parse,
    begin: number = parse.count,
    stack: string = tname.replace(/\/$/, ""),
    syntax: string = "<{\"'=/",
    data: ParseData = parse.data;

  if (attstore.length < 1) return;

  // fix for singleton tags, since "/" at the end of the tag is not an attribute
  if (attstore[attstore.length - 1][0] === "/") {
    attstore.pop();
    element = element.replace(/>$/, "/>");
  }

  // reconnects attribute names to their respective values if separated on "="
  eq = attstore.length;
  for (dq = 1; dq < eq; ++dq) {
    name = attstore[dq - 1][0];
    if (
      name.charAt(name.length - 1) === "=" &&
      attstore[dq][0].indexOf("=") < 0
    ) {
      attstore[dq - 1][0] = name + attstore[dq][0];
      attstore.splice(dq, 1);
      --eq;
      --dq;
    }
  }

  record.begin = begin;
  record.stack = stack;
  record.types = "attribute";
  store = [];

  for (; ind < len; ++ind) {
    if (attstore[ind] === undefined) break;

    attstore[ind][0] = attstore[ind][0].replace(/\s+$/, "");
    record.lines = attstore[ind][1];
    eq = attstore[ind][0].indexOf("=");

    if (eq > -1 && store.length > 0) {
      record.token = store.join(" ");
      recordPush(i, data, record, "");
      if (
        attstore[ind][0].indexOf("=") > 0 &&
        attstore[ind][0].indexOf("//") < 0 &&
        attstore[ind][0].charAt(0) !== ";"
      )
        record.token = attstore[ind][0].replace(/\s$/, "");
      else record.token = attstore[ind][0];
      recordPush(i, data, record, "");
      store = [];
    } else if (ltype === "sgml") store.push(attstore[ind][0]);
    else if (eq < 0) {
      record.token = attstore[ind][0];
      recordPush(i, data, record, "");
    } else {
      // separates out the attribute name from its value
      slice = attstore[ind][0].slice(eq + 1);
      if (syntax.indexOf(slice.charAt(0)) < 0) slice = '"' + slice + '"';
      name = attstore[ind][0].slice(0, eq);
      name = name + "=" + slice;
      record = templateAtt(
        i,
        record,
        slice.replace(/^("|')/, "").slice(0, 2),
        name.replace(/(\s+)$/, "")
      );
    }
  }
  if (store.length > 0) {
    record.token = store.join(" ");
    recordPush(i, data, record, "");
  }
}

function attributeLexer(
  i: LexState,
  attribute: string[],
  attstore: AttStore,
  lines: number,
  quotes: boolean
): string[] {
  let atty: string = attribute.join("");
  if (!quotes) atty = atty.replace(/\s+/g, " ");
  atty = atty.replace(/^\u0020/, "").replace(/\u0020$/, "");
  attribute = atty.split(i.options.lf);

  for (let aa = 0; aa < attribute.length; ++aa)
    attribute[aa] = attribute[aa].replace(/(\s+)$/, "");

  atty = attribute.join(i.options.lf);
  atty = bracketSpace(atty);

  if (atty === "=")
    attstore[attstore.length - 1][0] = `${attstore[attstore.length - 1][0]}=`;
  else if (
    atty.charAt(0) === "=" &&
    attstore.length > 0 &&
    attstore[attstore.length - 1][0].indexOf("=") < 0
  )
    //if an attribute starts with start `=` then adjoin it to the last attribute
    attstore[attstore.length - 1][0] = attstore[attstore.length - 1][0] + atty;
  else if (
    atty.charAt(0) !== "=" &&
    attstore.length > 0 &&
    attstore[attstore.length - 1][0].indexOf("=") ===
      attstore[attstore.length - 1][0].length - 1
  )
    // if an attribute follows an attribute ending with `=` then adjoin it to the
    // last attribute
    attstore[attstore.length - 1][0] = attstore[attstore.length - 1][0] + atty;
  else if (atty !== "" && atty !== " ") attstore.push([atty, lines]);

  if (attstore.length === 0) return [];

  if (attstore[attstore.length - 1][0].indexOf("=\u201c") > 0)
    i.parseerror = `Quote looking character (\u201c, &#x201c) used instead of actual quotes on line number ${i.parse.lineNumber}`;
  else if (attstore[attstore.length - 1][0].indexOf("=\u201d") > 0)
    i.parseerror = `Quote looking character (\u201d, &#x201d) used instead of actual quotes on line number ${i.parse.lineNumber}`;

  return [];
}

function peertest(i: LexState, name: string, item: string): boolean {
  if (i.htmlblocks[name] === undefined) return false;
  if (name === item) return true;
  if (name === "dd" && item === "dt") return true;
  if (name === "dt" && item === "dd") return true;
  if (name === "td" && item === "th") return true;
  if (name === "th" && item === "td") return true;
  if (
    name === "colgroup" &&
    (item === "tbody" || item === "tfoot" || item === "thead" || item === "tr")
  )
    return true;
  if (
    name === "tbody" &&
    (item === "colgroup" || item === "tfoot" || item === "thead")
  )
    return true;
  if (
    name === "tfoot" &&
    (item === "colgroup" || item === "tbody" || item === "thead")
  )
    return true;
  if (
    name === "thead" &&
    (item === "colgroup" || item === "tbody" || item === "tfoot")
  )
    return true;
  if (name === "tr" && item === "colgroup") return true;
  return false;
}

function fixsingleton(i: LexState, tname: string): boolean {
  const vname: string = tname.slice(1);
  for (let aa = i.parse.count; aa > -1; --aa) {
    let bb: number = 0;
    if (i.parse.data.types[aa] === "end") {
      ++bb;
    } else if (i.parse.data.types[aa] === "start") {
      --bb;
      if (bb < 0) return false;
    }
    if (bb === 0 && i.parse.data.token[aa].toLowerCase().indexOf(vname) === 1) {
      i.parse.data.types[aa] = "start";
      i.count.start = i.count.start + 1;
      i.parse.data.token[aa] = i.parse.data.token[aa].replace(/(\s*\/>)$/, ">");
      return false;
    }
  }
  return false;
}

// Parses tags, attributes, and template elements
export function tag(i: LexState, end: string): void {
  const parse = i.parse;
  const data = parse.data;

  // markup is two smaller lexers that work together: tag - evaluates markup and
  // template tags content - evaluates text content and code for external lexers
  //
  // type definitions:
  // * start      end     type
  // * <![CDATA[   ]]>    cdata
  // * <!--       -->     comment
  // * <#--       -->     comment
  // * <%--       --%>    comment
  // * {!         !}      comment
  // * <!--[if    -->        conditional
  // * text       text       content
  // * </         >          end
  // * <pre       </pre>     ignore
  // * <script    </script>  ignore
  // * <style     </style>   ignore
  // * <!         >       sgml
  // * <          />      singleton
  // * <          >       start
  // * <!--#      -->     template
  // * {{         }}      template
  // * [%         %]      template
  // * {@         @}      template
  // * {#         #}      template
  // * {#         /}      template
  // * {?         /}      template
  // * {^         /}      template
  // * {@         /}      template
  // * {<         /}      template
  // * {+         /}      template
  // * {~         }       template
  // * <?         ?>      template
  // * {%         %}      template or template_start
  // * {{         }}      template_end
  // * <%\s*}     %>      template_end
  // * [%\s*}     %]      template_end
  // * {@\s*}     @}      template_end
  // * {          }       template_end
  // * {{#        }}      template_start
  // * <%         {\s*%>  template_start
  // * [%         {\s*%]  template_start
  // * {@         {\s*@}  template_start
  // * {#         }       template_start
  // * {?         }       template_start
  // * {^         }       template_start
  // * {@         }       template_start
  // * {<         }       template_start
  // * {+         }       template_start
  // * <?xml      ?>      xml

  let igcount: number = 0,
    element: string = "",
    lastchar: string = "",
    ltype: string = "",
    tname: string = "",
    start: string = "",
    cheat: boolean = false,
    preserve: boolean = false,
    simple: boolean = false,
    attstore: AttStore = [],
    comm: [string, number];
  const record: DataRecord = {
    begin: parse.structure[parse.structure.length - 1][1],
    ender: -1,
    lines: parse.linesSpace,
    stack: parse.structure[parse.structure.length - 1][0],
    token: "",
    types: "",
  };

  // this complex series of conditions determines an elements delimiters look to
  // the types being pushed to quickly reason about the logic no type is pushed
  // for start tags or singleton tags just yet some types set the `preserve` flag,
  // which means to preserve internal white space The `nopush` flag is set when
  // parsed tags are to be ignored and forgotten
  if (end === "]>") {
    end = ">";
    i.sgmlflag = i.sgmlflag - 1;
    ltype = "end";
  } else if (end === "---") {
    ltype = "comment";
    start = "---";
  } else if (i.chars[i.start] === "<") {
    if (i.chars[i.start + 1] === "/") {
      if (i.chars[i.start + 2] === "#") {
        ltype = "template_end";
      } else {
        ltype = "end";
      }
      end = ">";
    } else if (i.chars[i.start + 1] === "!") {
      if (i.chars[i.start + 2] === "-" && i.chars[i.start + 3] === "-") {
        if (i.chars[i.start + 4] === "#") {
          end = "-->";
          ltype = "template";
        } else {
          end = "-->";
          ltype = "comment";
          start = "<!--";
        }
      } else if (
        i.chars.slice(i.start + 2, i.start + 8).join("") === "[CDATA"
      ) {
        end = "]]>";
        ltype = "cdata";
        preserve = true;
      } else {
        end = ">";
        i.sgmlflag = i.sgmlflag + 1;
        ltype = "sgml";
      }
    } else if (i.chars[i.start + 1] === "?") {
      end = "?>";
      if (
        i.chars[i.start + 2] === "x" &&
        i.chars[i.start + 3] === "m" &&
        i.chars[i.start + 4] === "l"
      ) {
        ltype = "xml";
        simple = true;
      } else {
        preserve = true;
        ltype = "template";
      }
    } else if (i.chars[i.start + 1] === "%") {
      preserve = true;
      if (i.chars[i.start + 2] === "-" && i.chars[i.start + 3] === "-") {
        end = "--%>";
        ltype = "comment";
        start = "<%--";
      } else if (i.chars[i.start + 2] === "#") {
        end = "%>";
        ltype = "comment";
        start = "<%#";
      } else {
        end = "%>";
        ltype = "template";
      }
    } else if (
      i.chars
        .slice(i.start + 1, i.start + 4)
        .join("")
        .toLowerCase() === "pre"
    ) {
      end = "</pre>";
      preserve = true;
      ltype = "ignore";
    } else if (
      i.chars
        .slice(i.start + 1, i.start + 6)
        .join("")
        .toLowerCase() === "style"
    ) {
      end = "</style>";
      preserve = true;
      ltype = "ignore";
    } else if (
      i.chars
        .slice(i.start + 1, i.start + 7)
        .join("")
        .toLowerCase() === "script"
    ) {
      end = "</script>";
      preserve = true;
      ltype = "ignore";
    } else if (
      i.chars
        .slice(i.start + 1, i.start + 9)
        .join("")
        .toLowerCase() === "xsl:text"
    ) {
      end = "</xsl:text>";
      preserve = true;
      ltype = "ignore";
    } else if (i.chars[i.start + 1] === "<") {
      if (i.chars[i.start + 2] === "<") {
        end = ">>>";
      } else {
        end = ">>";
      }
      ltype = "template";
    } else if (i.chars[i.start + 1] === "#") {
      if (
        i.chars[i.start + 2] === "e" &&
        i.chars[i.start + 3] === "l" &&
        i.chars[i.start + 4] === "s" &&
        i.chars[i.start + 5] === "e"
      ) {
        end = ">";
        ltype = "template_else";
      } else if (i.chars[i.start + 2] === "-" && i.chars[i.start + 3] === "-") {
        end = "-->";
        ltype = "comment";
        start = "<#--";
      } else {
        end = ">";
        ltype = "template_start";
      }
    } else {
      simple = true;
      end = ">";
    }
  } else if (i.chars[i.start] === "{") {
    preserve = true;
    if (i.chars[i.start + 1] === "{") {
      if (i.chars[i.start + 2] === "{") {
        end = "}}}";
        ltype = "template";
      } else if (i.chars[i.start + 2] === "#") {
        end = "}}";
        ltype = "template_start";
      } else if (i.chars[i.start + 2] === "/") {
        end = "}}";
        ltype = "template_end";
      } else if (
        i.chars[i.start + 2] === "e" &&
        i.chars[i.start + 3] === "n" &&
        i.chars[i.start + 4] === "d"
      ) {
        end = "}}";
        ltype = "template_end";
      } else if (
        i.chars[i.start + 2] === "e" &&
        i.chars[i.start + 3] === "l" &&
        i.chars[i.start + 4] === "s" &&
        i.chars[i.start + 5] === "e"
      ) {
        end = "}}";
        ltype = "template_else";
      } else {
        end = "}}";
        ltype = "template";
      }
    } else if (i.chars[i.start + 1] === "%") {
      end = "%}";
      ltype = "template";
    } else if (i.chars[i.start + 1] === "#") {
      end = "#}";
      ltype = "comment";
      start = "{#";
    } else {
      end = i.chars[i.start + 1] + "}";
      ltype = "template";
    }
  } else if (i.chars[i.start] === "[" && i.chars[i.start + 1] === "%") {
    end = "%]";
    ltype = "template";
  }

  // This is the real tag lexer. Everything that follows is attribute handling and
  // edge cases
  lastchar = end.charAt(end.length - 1);
  if (ltype === "comment") {
    comm = parse.wrapCommentBlock({
      chars: i.chars,
      end: i.end,
      opening: start,
      start: i.start,
      terminator: end,
    });
    [element, i.start] = comm;
    record.token = element;
    record.types = "comment";
    recordPush(i, data, record, "");
    return;
  }
  let braccount: number = 0,
    jsxcount: number = 0,
    e: number = 0,
    f: number = 0,
    parncount: number = 0,
    lines: number = 1,
    quote: string = "",
    jsxquote: string = "",
    stest: boolean = false,
    quotetest: boolean = false,
    attribute: string[] = [];
  const lex: string[] = [];

  for (; i.start < i.end; i.start += 1) {
    if (i.chars[i.start] === i.options.lf) {
      lines = lines + 1;
      parse.lineNumber = parse.lineNumber + 1;
    }
    if (
      preserve === true ||
      (/\s/.test(i.chars[i.start]) === false && quote !== "}") ||
      quote === "}"
    ) {
      lex.push(i.chars[i.start]);
      if (lex[0] === "<" && lex[1] === ">" && end === ">") {
        record.token = "<>";
        record.types = "start";
        recordPush(i, data, record, "(empty)");
        return;
      }
      if (lex[0] === "<" && lex[1] === "/" && lex[2] === ">" && end === ">") {
        record.token = "</>";
        record.types = "end";
        recordPush(i, data, record, "");
        return;
      }
    }
    if (
      ltype === "cdata" &&
      i.chars[i.start] === ">" &&
      i.chars[i.start - 1] === "]" &&
      i.chars[i.start - 2] !== "]"
    ) {
      i.parseerror = `CDATA tag ${lex.join(
        ""
      )} is not properly terminated with ]]>`;
      break;
    }
    if (quote === "") {
      if (lex[0] + lex[1] === "<!" && ltype !== "cdata") {
        if (i.chars[i.start] === "[") {
          if (i.chars[i.start + 1] === "<") {
            ltype = "start";
            break;
          }
          while (
            i.start < i.end - 1 &&
            /\s/.test(i.chars[i.start + 1]) === true
          ) {
            i.start += 1;
            if (i.chars[i.start] === i.options.lf) {
              lines = lines + 1;
            }
          }
          if (i.chars[i.start + 1] === "<") {
            ltype = "start";
            break;
          }
        }
        if (i.chars[i.start] !== ">" && i.chars[i.start + 1] === "<") {
          i.parseerror = `SGML tag ${lex.join(
            ""
          )} is missing termination with '[' or '>'.`;
          break;
        }
      }
      if (
        data.types[parse.count] === "sgml" &&
        i.chars[i.start] === "[" &&
        lex.length > 4
      ) {
        data.types[parse.count] = "template_start";
        i.count.start = i.count.start + 1;
        break;
      }
      if (
        i.chars[i.start] === "<" &&
        preserve === false &&
        lex.length > 1 &&
        end !== ">>" &&
        end !== ">>>" &&
        simple === true
      ) {
        i.parseerror = `Parse error on line ${
          parse.lineNumber
        } on element: ${lex.join("")}`;
      }
      if (
        stest === true &&
        /\s/.test(i.chars[i.start]) === false &&
        i.chars[i.start] !== lastchar
      ) {
        //attribute start
        stest = false;
        quote = jsxquote;
        igcount = 0;
        lex.pop();
        for (; i.start < i.end; i.start += 1) {
          if (i.chars[i.start] === i.options.lf)
            parse.lineNumber = parse.lineNumber + 1;
          attribute.push(i.chars[i.start]);
          if (
            (i.chars[i.start] === "<" || i.chars[i.start] === ">") &&
            (quote === "" || quote === ">")
          ) {
            if (quote === "" && i.chars[i.start] === "<") {
              quote = ">";
              braccount = 1;
            } else if (quote === ">") {
              if (i.chars[i.start] === "<") {
                braccount = braccount + 1;
              } else if (i.chars[i.start] === ">") {
                braccount = braccount - 1;
                if (braccount === 0) {
                  quote = "";
                  igcount = 0;
                  attribute = attributeLexer(
                    i,
                    attribute,
                    attstore,
                    lines,
                    false
                  );
                  lines = i.chars[i.start] === i.options.lf ? 2 : 1;
                  break;
                }
              }
            }
          } else if (quote === "") {
            if (i.chars[i.start + 1] === lastchar) {
              //if at end of tag
              if (
                attribute[attribute.length - 1] === "/" ||
                (attribute[attribute.length - 1] === "?" && ltype === "xml")
              ) {
                attribute.pop();
                if (preserve === true) {
                  lex.pop();
                }
                --i.start;
              }
              if (attribute.length > 0)
                attribute = attributeLexer(
                  i,
                  attribute,
                  attstore,
                  lines,
                  false
                );
              lines = i.chars[i.start] === i.options.lf ? 2 : 1;
              break;
            } else if (i.chars[i.start] === "{" && i.chars[i.start - 1] === "=")
              quote = "}";
            else if (i.chars[i.start] === '"' || i.chars[i.start] === "'") {
              quote = i.chars[i.start];
              if (
                i.chars[i.start - 1] === "=" &&
                (i.chars[i.start + 1] === "<" ||
                  (i.chars[i.start + 1] === "{" &&
                    i.chars[i.start + 2] === "%") ||
                  (/\s/.test(i.chars[i.start + 1]) === true &&
                    i.chars[i.start - 1] !== "="))
              )
                igcount = i.start;
            } else if (i.chars[i.start] === "(") {
              quote = ")";
              parncount = 1;
            } else if (
              lex[0] !== "{" &&
              i.chars[i.start] === "{" &&
              (i.chars[i.start + 1] === "{" ||
                i.chars[i.start + 1] === "%" ||
                i.chars[i.start + 1] === "@" ||
                i.chars[i.start + 1] === "#")
            ) {
              //opening embedded template expression
              if (i.chars[i.start + 1] === "{")
                quote = i.chars[i.start + 2] === "{" ? "}}}" : "}}";
              else quote = i.chars[i.start + 1] + "}";
            }
            if (/\s/.test(i.chars[i.start]) === true && quote === "") {
              // testing for i.start run of spaces between an attribute's = and i.start quoted value.
              // Unquoted values separated by space are separate attributes
              if (attribute[attribute.length - 2] === "=") {
                while (e < i.end) {
                  if (/\s/.test(i.chars[e]) === false) {
                    if (i.chars[e] === '"' || i.chars[e] === "'") {
                      i.start = e - 1;
                      quotetest = true;
                      attribute.pop();
                    }
                    break;
                  }
                  ++e;
                }
              }
              if (quotetest === true) {
                quotetest = false;
              } else if (
                jsxcount === 0 ||
                (jsxcount === 1 && attribute[0] === "{")
              ) {
                //if there is an unquoted space attribute is complete
                attribute.pop();
                attribute = attributeLexer(
                  i,
                  attribute,
                  attstore,
                  lines,
                  false
                );
                lines = i.chars[i.start] === i.options.lf ? 2 : 1;
                stest = true;
                break;
              }
            }
          } else if (i.chars[i.start] === "(" && quote === ")") {
            parncount = parncount + 1;
          } else if (i.chars[i.start] === ")" && quote === ")") {
            parncount = parncount - 1;
            if (parncount === 0) {
              quote = "";
              if (i.chars[i.start + 1] === end.charAt(0)) {
                attribute = attributeLexer(
                  i,
                  attribute,
                  attstore,
                  lines,
                  false
                );
                lines = i.chars[i.start] === i.options.lf ? 2 : 1;
                break;
              }
            }
          } else if (
            i.chars[i.start] === "{" &&
            i.chars[i.start + 1] === "%" &&
            i.chars[igcount - 1] === "=" &&
            (quote === '"' || quote === "'")
          ) {
            quote = quote + "{%";
            igcount = 0;
          } else if (
            i.chars[i.start - 1] === "%" &&
            i.chars[i.start] === "}" &&
            (quote === '"{%' || quote === "'{%")
          ) {
            quote = quote.charAt(0);
            igcount = 0;
          } else if (
            i.chars[i.start] === "<" &&
            end === ">" &&
            i.chars[igcount - 1] === "=" &&
            (quote === '"' || quote === "'")
          ) {
            quote = quote + "<";
            igcount = 0;
          } else if (
            i.chars[i.start] === ">" &&
            (quote === '"<' || quote === "'<")
          ) {
            quote = quote.charAt(0);
            igcount = 0;
          } else if (
            igcount === 0 &&
            quote !== ">" &&
            (quote.length < 2 ||
              (quote.charAt(0) !== '"' && quote.charAt(0) !== "'"))
          ) {
            //terminate attribute at the conclusion of i.start quote pair
            f = 0;
            if (lex.length > 1) {
              tname = lex[1] + lex[2];
              tname = tname.toLowerCase();
            }
            for (e = quote.length - 1; e > -1; --e) {
              if (i.chars[i.start - f] !== quote.charAt(e)) break;
              ++f;
            }
            if (e < 0) {
              attribute = attributeLexer(i, attribute, attstore, lines, true);
              lines = i.chars[i.start] === i.options.lf ? 2 : 1;
              quote = "";
              if (i.chars[i.start + 1] === lastchar) break;
            }
          } else if (igcount > 0 && /\s/.test(i.chars[i.start]) === false) {
            igcount = 0;
          }
        }
      } else if (
        end !== "%>" &&
        end !== i.options.lf &&
        (i.chars[i.start] === '"' || i.chars[i.start] === "'")
      )
        //opening quote
        quote = i.chars[i.start];
      else if (
        ltype !== "comment" &&
        end !== i.options.lf &&
        i.chars[i.start] === "<" &&
        i.chars[i.start + 1] === "!" &&
        i.chars[i.start + 2] === "-" &&
        i.chars[i.start + 3] === "-" &&
        i.chars[i.start + 4] !== "#" &&
        data.types[parse.count] !== "conditional"
      )
        quote = "-->";
      else if (
        i.chars[i.start] === "{" &&
        lex[0] !== "{" &&
        end !== i.options.lf &&
        end !== "%>" &&
        end !== "%]" &&
        (i.chars[i.start + 1] === "{" ||
          i.chars[i.start + 1] === "%" ||
          i.chars[i.start + 1] === "@" ||
          i.chars[i.start + 1] === "#")
      ) {
        //opening embedded template expression
        if (i.chars[i.start + 1] === "{")
          quote = i.chars[i.start + 2] === "{" ? "}}}" : "}}";
        else {
          quote = i.chars[i.start + 1] + "}";
          if (
            attribute.length < 1 &&
            (attstore.length < 1 || /\s/.test(i.chars[i.start - 1]) === true)
          ) {
            lex.pop();
            while (
              i.start < i.end &&
              i.chars[i.start - 1] + i.chars[i.start] !== quote
            ) {
              if (i.chars[i.start] === i.options.lf) ++lines;
              attribute.push(i.chars[i.start]);
              i.start = i.start + 1;
            }
            attribute.push("}");
            attstore.push([attribute.join(""), lines]);
            attribute = [];
            lines = 1;
            quote = "";
          }
        }
        if (quote === end) {
          quote = "";
        }
      } else if (
        (simple === true || ltype === "sgml") &&
        end !== i.options.lf &&
        /\s/.test(i.chars[i.start]) === true &&
        i.chars[i.start - 1] !== "<"
      ) {
        //identify i.start space in i.start regular start or singleton tag
        if (ltype === "sgml") lex.push(" ");
        else stest = true;
      } else if (
        (i.chars[i.start] === lastchar ||
          (end === i.options.lf && i.chars[i.start + 1] === "<")) &&
        (lex.length > end.length + 1 || lex[0] === "]")
      ) {
        if (end === i.options.lf) {
          while (/\s/.test(lex[lex.length - 1]) === true) {
            lex.pop();
            i.start = i.start - 1;
          }
          break;
        }
        if (
          lex[0] === "{" &&
          lex[1] === "%" &&
          lex.join("").replace(/\s+/g, "") === "{%comment%}"
        ) {
          end = "endcomment";
          lastchar = "t";
          preserve = true;
          ltype = "comment";
        } else if (
          lex[0] === "{" &&
          lex[1] === "%" &&
          lex[2] === "-" &&
          lex.join("").replace(/\s+/g, "") === "{%-comment-%}"
        ) {
          end = "endcomment";
          lastchar = "t";
          preserve = true;
          ltype = "comment";
        } else {
          //if current character matches the last character of the tag ending sequence
          f = lex.length;
          e = end.length - 1;
          while (e > -1) {
            --f;
            if (lex[f] !== end.charAt(e)) break;
            --e;
          }
          if (e < 0) {
            break;
          }
        }
      }
    } else if (
      i.chars[i.start] === quote.charAt(quote.length - 1) &&
      end !== "}"
    ) {
      //find the closing quote or embedded template expression
      f = 0;
      if (lex.length > 1) {
        tname = lex[1] + lex[2];
        tname = tname.toLowerCase();
      }
      for (e = quote.length - 1; e > -1; --e) {
        if (i.chars[i.start - f] !== quote.charAt(e)) {
          break;
        }
        ++f;
      }
      if (e < 0) quote = "";
    }
  }

  if (i.start < i.end) {
    element = lex.join("");
    tname = tagName(i, element);
    element = bracketSpace(element);
    if (tname === "xml") i.html = "xml";
    else if (
      i.html === "" &&
      tname === "!DOCTYPE" &&
      element.toLowerCase().indexOf("xhtml") > 0
    )
      i.html = "xml";
    else if (i.html === "" && tname === "html") i.html = "html";
  }
  record.token = element;
  record.types = ltype;
  tname = tagName(i, element);

  // Twig language allows {% block %} elements to be singleton or start.  You don't
  // know until you encounter i.start {% endblock %} tag
  if (tname === "endblock" && element.slice(0, 2) === "{%") {
    const endName: string = element
      .replace(/\{%\s*endblock\s+/, "")
      .replace(/\s*%\}/, "");
    let aa: number = parse.count,
      bb: number = parse.count,
      startName: string = "";
    for (; aa > -1; --aa) {
      if (data.types[aa].indexOf("end") > 0) {
        aa = data.begin[aa];
        if (aa < 0) break;
      } else if (/\{%\s*block/.test(data.token[aa]) === true) {
        if (endName === "") {
          break;
        }
        startName = data.token[aa]
          .replace(/\{%\s*block\s+/, "")
          .split(/\s+/)[0]
          .replace(/\s+/, "");
        if (endName === startName) break;
      }
    }
    ++i.count.start;
    data.types[aa] = "template_start";
    data.ender[aa] = parse.count + 1;
    record.begin = aa;
    record.stack = "block";
    record.token = element;
    record.types = "template_end";
    if (aa > -1) {
      for (; bb > aa; --bb) {
        if (data.types[bb].indexOf("end") > 0) {
          bb = data.begin[bb];
          data.begin[bb] = aa;
          data.stack[bb] = "block";
        } else if (data.begin[bb] < aa) {
          data.begin[bb] = aa;
          if (data.types[bb].indexOf("start") < 0) {
            data.ender[bb] = parse.count + 1;
          }
          data.stack[bb] = "block";
        }
      }
    }
    parse.structure.push(["block", aa]);
    recordPush(i, data, record, "");
    return;
  }

  if (!preserve) element = element.replace(/\s+/g, " ");

  //i.start quick hack to inject records for i.start type of template comments
  if (tname === "comment" && element.slice(0, 2) === "{%") {
    let lineFindStart = (spaces: string): string => {
      linesStart = spaces === "" ? 0 : spaces.split(i.options.lf).length;
      return "";
    };
    let lineFindEnd = (spaces: string): string => {
      linesEnd = spaces === "" ? 0 : spaces.split(i.options.lf).length;
      return "";
    };
    let linesStart: number = 0,
      linesEnd: number = 0;
    record.begin = parse.structure[parse.structure.length - 1][1];
    record.ender = parse.count + 3;
    record.stack = parse.structure[parse.structure.length - 1][0];
    record.types = "template_start";
    if (element.charAt(2) === "-") {
      element = element
        .replace(/^(\s*\{%-\s*comment\s*-%\})/, "")
        .replace(/(\{%-\s*endcomment\s*-%\}\s*)$/, "");
      record.token = "{%- comment -%}";
      recordPush(i, data, record, "comment");
      record.begin = parse.count;
      element = element.replace(/^\s*/, lineFindStart);
      element = element.replace(/\s*$/, lineFindEnd);
      record.lines = linesStart;
      record.stack = "comment";
      record.token = element;
      record.types = "comment";
      recordPush(i, data, record, "");
      record.token = "{%- endcomment -%}";
    } else {
      element = element
        .replace(/^(\s*\{%\s*comment\s*%\})/, "")
        .replace(/(\{%\s*endcomment\s*%\}\s*)$/, "");
      record.token = "{% comment %}";
      recordPush(i, data, record, "comment");
      record.begin = parse.count;
      element = element.replace(/^\s*/, lineFindStart);
      element = element.replace(/\s*$/, lineFindEnd);
      record.lines = linesStart;
      record.stack = "comment";
      record.token = element;
      record.types = "comment";
      recordPush(i, data, record, "");
      record.token = "{% endcomment %}";
    }
    record.lines = linesEnd;
    record.types = "template_end";
    recordPush(i, data, record, "");
    return;
  }

  // A type correction for template tags who have variable start tag names but start
  // consistent ending tag name
  if (
    element.indexOf("{{") === 0 &&
    element.slice(element.length - 2) === "}}"
  ) {
    if (tname === "end") {
      ltype = "template_end";
    } else if (tname === "else") {
      ltype = "template_else";
    }
  } else if (
    element.slice(0, 2) === "<%" &&
    element.slice(element.length - 2) === "%>"
  ) {
    if (/^(<%\s+end\s+-?%>)$/.test(element) === true) ltype = "template_end";
    else if (
      (/\sdo\s/.test(element) === true && /\s-?%>$/.test(element) === true) ||
      /^(<%(%|-|=)?\s*if)/.test(element) === true
    )
      ltype = "template_start";
  }
  record.types = ltype;

  // Update start flag for subatomic parsing in SGML tags
  if (
    end !== "]>" &&
    i.sgmlflag > 0 &&
    element.charAt(element.length - 1) !== "[" &&
    (element.slice(element.length - 2) === "]>" ||
      /^(<!((doctype)|(notation))\s)/i.test(element) === true)
  ) {
    --i.sgmlflag;
  }

  // cheat identifies HTML singleton elements as singletons even if formatted as
  // start tags, such as <br> (which is really <br/>)
  cheat = (() => {
    const ender: RegExp = /(\/>)$/,
      htmlsings: any = {
        area: "singleton",
        base: "singleton",
        basefont: "singleton",
        br: "singleton",
        col: "singleton",
        embed: "singleton",
        eventsource: "singleton",
        frame: "singleton",
        hr: "singleton",
        image: "singleton",
        img: "singleton",
        input: "singleton",
        isindex: "singleton",
        keygen: "singleton",
        link: "singleton",
        meta: "singleton",
        param: "singleton",
        progress: "singleton",
        source: "singleton",
        wbr: "singleton",
      };

    let addHtmlEnd = (count: number) => {
      record.lines = data.lines[parse.count] > 0 ? 1 : 0;
      record.token = `</${parse.structure[parse.structure.length - 1][0]}>`;
      record.types = "end";
      recordPush(i, data, record, "");
      for (; count > 0; --count) {
        record.begin = parse.structure[parse.structure.length - 1][1];
        record.stack = parse.structure[parse.structure.length - 1][0];
        record.token = `</${parse.structure[parse.structure.length - 1][0]}>`;
        recordPush(i, data, record, "");
      }
      record.begin = parse.structure[parse.structure.length - 1][1];
      record.lines = parse.linesSpace;
      record.stack = parse.structure[parse.structure.length - 1][0];
      record.token = element;
      record.types = "end";
      data.lines[parse.count - 1] = 0;
    };

    // Determine if the current end tag is actually part of an HTML singleton
    if (ltype === "end") {
      const lastToken: string = data.token[parse.count];
      if (
        data.types[parse.count - 1] === "singleton" &&
        lastToken.charAt(lastToken.length - 2) !== "/" &&
        "/" + tagName(i, lastToken) === tname
      ) {
        data.types[parse.count - 1] = "start";
      }
    }

    if (i.html === "html") {
      // html gets tag names in lowercase
      if (
        element.charAt(0) === "<" &&
        element.charAt(1) !== "!" &&
        element.charAt(1) !== "?" &&
        (parse.count < 0 || data.types[parse.count].indexOf("template") < 0)
      )
        element = element.toLowerCase();

      if (
        i.htmlblocks[parse.structure[parse.structure.length - 1][0]] ===
          "block" &&
        peertest(
          i,
          tname.slice(1),
          parse.structure[parse.structure.length - 2][0]
        )
      )
        // Looks for HTML tags missing an ending pair when encountering an ending tag for i.start parent node
        addHtmlEnd(0);
      else if (
        parse.structure.length > 3 &&
        i.htmlblocks[parse.structure[parse.structure.length - 1][0]] ===
          "block" &&
        i.htmlblocks[parse.structure[parse.structure.length - 2][0]] ===
          "block" &&
        i.htmlblocks[parse.structure[parse.structure.length - 3][0]] ===
          "block" &&
        peertest(i, tname, parse.structure[parse.structure.length - 4][0])
      )
        // Looks for consecutive missing end tags
        addHtmlEnd(3);
      else if (
        parse.structure.length > 2 &&
        i.htmlblocks[parse.structure[parse.structure.length - 1][0]] ===
          "block" &&
        i.htmlblocks[parse.structure[parse.structure.length - 2][0]] ===
          "block" &&
        peertest(i, tname, parse.structure[parse.structure.length - 3][0])
      )
        // Looks for consecutive missing end tags
        addHtmlEnd(2);
      else if (
        parse.structure.length > 1 &&
        i.htmlblocks[parse.structure[parse.structure.length - 1][0]] ===
          "block" &&
        peertest(i, tname, parse.structure[parse.structure.length - 2][0])
      )
        // Looks for consecutive missing end tags
        addHtmlEnd(1);
      else if (
        peertest(i, tname, parse.structure[parse.structure.length - 1][0])
      )
        // Certain tags cannot contain other certain tags if such tags are peers
        addHtmlEnd(0);
      else if (
        tname.charAt(0) === "/" &&
        i.htmlblocks[parse.structure[parse.structure.length - 1][0]] ===
          "block" &&
        parse.structure[parse.structure.length - 1][0] !== tname.slice(1)
      ) {
        // Looks for consecutive missing end tags if the current element is an end tag
        fixHtmlEnd(i, element, false);
        record.begin = parse.structure[parse.structure.length - 1][1];
        record.lines = parse.linesSpace;
        record.stack = parse.structure[parse.structure.length - 1][0];
        record.token = element;
        record.types = "end";
        data.lines[parse.count - 1] = 0;
      }

      // Generalized corrections for the handling of singleton tags
      if (
        data.types[parse.count] === "end" &&
        htmlsings[tname.slice(1)] === "singleton"
      )
        return fixsingleton(i, tname);

      // Inserts start trailing slash into singleton tags if they do not already have it
      if (htmlsings[tname] === "singleton") return true;
    }

    return false;
  })();

  //tags with the following names are singletons
  if (
    tname.charAt(0) === "#" &&
    data.types[parse.count] === "start" &&
    (tname === "#assign" ||
      tname === "#break" ||
      tname === "#case" ||
      tname === "#default" ||
      tname === "#fallback" ||
      tname === "#flush" ||
      tname === "#ftl" ||
      tname === "#global" ||
      tname === "#import" ||
      tname === "#include" ||
      tname === "#local" ||
      tname === "#t" ||
      tname === "#lt" ||
      tname === "#rt" ||
      tname === "#nested" ||
      tname === "#nt" ||
      tname === "#recover" ||
      tname === "#recurse" ||
      tname === "#return" ||
      tname === "#sep" ||
      tname === "#setting" ||
      tname === "#stop" ||
      tname === "#visit")
  ) {
    simple = true;
  }

  // Am I start singleton or start start type?
  if (simple === true && ltype !== "xml" && ltype !== "sgml") {
    if (cheat === true || element.slice(element.length - 2) === "/>") {
      ltype = "singleton";
    } else {
      ltype = "start";
    }
    record.types = ltype;
  }

  // some template tags can be evaluated as start block start/end based on syntax
  // alone
  if (record.types.indexOf("template") > -1) {
    if (element.slice(0, 2) === "{%") {
      let names: string[] = [
        "autoescape",
        "case",
        "capture",
        "comment",
        "embed",
        "filter",
        "for",
        "form",
        "if",
        "macro",
        "paginate",
        "raw",
        "sandbox",
        "spaceless",
        "switch",
        "tablerow",
        "unless",
        "verbatim",
      ];
      if (
        (tname === "case" || tname === "default") &&
        (parse.structure[parse.structure.length - 1][0] === "switch" ||
          parse.structure[parse.structure.length - 1][0] === "case")
      ) {
        record.types = "template_else";
      } else if (
        tname === "else" ||
        tname === "elseif" ||
        tname === "when" ||
        tname === "elif" ||
        tname === "elsif"
      ) {
        record.types = "template_else";
      } else {
        if (names.indexOf(tname) > -1) {
          record.types = "template_start";
        } else if (names.map((n) => "end" + n).indexOf(tname) > -1) {
          record.types = "template_end";
        } else {
          record.types = "template";
        }
      }
    } else if (element.slice(0, 2) === "{{" && element.charAt(3) !== "{") {
      if (/^(\{\{\s*-?\s*end\s*-?\s*\}\})$/.test(element) === true) {
        record.types = "template_end";
      } else if (
        tname === "define" ||
        tname === "form" ||
        tname === "if" ||
        tname === "range" ||
        tname === "with"
      ) {
        record.types = "template_start";
      }
    } else if (record.types === "template") {
      if (element.indexOf("else") > 2) {
        record.types = "template_else";
      } else if (
        /^(<%\s*\})/.test(element) === true ||
        /^(\[%\s*\})/.test(element) === true ||
        /^(\{@\s*\})/.test(element) === true
      ) {
        record.types = "template_end";
      } else if (
        /(\{\s*%>)$/.test(element) === true ||
        /(\{\s*%\])$/.test(element) === true ||
        /(\{\s*@\})$/.test(element) === true
      ) {
        record.types = "template_start";
      } else if (/\{\s*\?>$/.test(element) === true) {
        record.types = "template_start";
      } else if (/^<\?(=|(php))\s*\}/.test(element) === true) {
        record.types = "template_end";
      }
    }
    if (record.types === "template_start" || record.types === "template_else") {
      if (/^<\?(=|(php))\s*/.test(element) === true) {
        tname = element;
      } else if (
        tname === "" ||
        tname === "@" ||
        tname === "#" ||
        tname === "%"
      ) {
        tname = tname + element.slice(1).replace(tname, "").replace(/^\s+/, "");
        tname = tname.slice(0, tname.indexOf("(")).replace(/\s+/, "");
      }
    }
  }

  recordPush(i, data, record, tname);
  attributeRecord(i, element, attstore, tname, ltype, record);
  parse.linesSpace = 0;
}

// parses everything other than markup tags
export function content(i: LexState): void {
  const parse = i.parse;
  const data = i.parse.data;

  let lex: string[] = [],
    ltoke: string = "",
    liner: number = parse.linesSpace;
  const square: boolean =
      data.types[parse.count] === "template_start" &&
      data.token[parse.count].indexOf("<!") === 0 &&
      data.token[parse.count].indexOf("<![") < 0 &&
      data.token[parse.count].charAt(data.token[parse.count].length - 1) ===
        "[",
    record: DataRecord = {
      begin: parse.structure[parse.structure.length - 1][1],
      ender: -1,
      lines: liner,
      stack: parse.structure[parse.structure.length - 1][0],
      token: "",
      types: "content",
    };
  for (; i.start < i.end; i.start += 1) {
    if (i.chars[i.start] === i.options.lf) {
      parse.lineNumber += 1;
    }

    // Artifacts nested within an SGML tag
    if (square === true && i.chars[i.start] === "]") {
      i.start -= 1;
      ltoke = lex.join("");
      liner = 0;
      record.token = ltoke;
      recordPush(i, data, record, "");
      break;
    }

    // General content processing
    if (
      lex.length > 0 &&
      ((i.chars[i.start] === "<" &&
        i.chars[i.start + 1] !== "=" &&
        /\s|\d/.test(i.chars[i.start + 1]) === false) ||
        (i.chars[i.start] === "[" && i.chars[i.start + 1] === "%") ||
        (i.chars[i.start] === "{" &&
          (i.chars[i.start + 1] === "{" ||
            i.chars[i.start + 1] === "%" ||
            i.chars[i.start + 1] === "@" ||
            i.chars[i.start + 1] === "#")))
    ) {
      // Regular content
      i.start -= 1;
      ltoke = lex.join("").trim();
      ltoke = bracketSpace(ltoke);
      liner = 0;
      record.token = ltoke;
      recordPush(i, data, record, "");
      break;
    }
    lex.push(i.chars[i.start]);
  }
}
