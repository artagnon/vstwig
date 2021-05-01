export function markupLexer(lexData: LexerData): data {
  const source = lexData.options.source;
  let a: number = 0,
    sgmlflag: number = 0,
    html: "html" | "xml" | "" = "";
  const parse: parse = lexData.parse,
    data: data = parse.data,
    count: markupCount = {
      end: 0,
      index: -1,
      start: 0,
    },
    options: FormatterOptions = lexData.options,
    b: string[] = source.split(""),
    c: number = b.length,
    htmlblocks: any = {
      body: "block",
      colgroup: "block",
      dd: "block",
      dt: "block",
      head: "block",
      html: "block",
      li: "block",
      option: "block",
      p: "block",
      tbody: "block",
      td: "block",
      tfoot: "block",
      th: "block",
      thead: "block",
      tr: "block",
    },
    attribute_sort_list: string[] = [],
    asl: number = attribute_sort_list.length,
    //pads certain template tag delimiters with a space
    bracketSpace = function lexer_markup_bracketSpace(input: string): string {
      const spaceStart = function lexer_markup_tag_spaceStart(start: string): string {
          return start.replace(/\s*$/, " ");
        },
        spaceEnd = function lexer_markup_tag_spaceStart(end: string): string {
          return end.replace(/^\s*/, " ");
        };
      if (/\{(=|#|\/|(%>)|(%\]))/.test(input) === true || /\}%(>|\])/.test(input) === true) {
        return input;
      }
      input = input.replace(/\{((\{+)|%-?)\s*/g, spaceStart);
      input = input.replace(/\s*((\}\}+)|(-?%\}))/g, spaceEnd);
      return input;
    },
    // pushes a record into the parse table
    recordPush = function lexer_markup_recordPush(
      target: data,
      record: record,
      structure: string
    ): void {
      if (target === data) {
        if (record.types.indexOf("end") > -1) {
          count.end = count.end + 1;
        } else if (record.types.indexOf("start") > -1) {
          count.start = count.start + 1;
        }
      }
      parse.push(target, record, structure);
    },
    // Find the lowercase tag name of the provided token.
    tagName = function lexer_markup_tagName(el: string): string {
      let space: number = 0,
        name: string = "";
      const reg: RegExp = /^((\{|<)((%-?)|\{-?)=?\s*)/;
      if (typeof el !== "string") {
        return "";
      }
      space = el.replace(reg, "%").replace(/\s+/, " ").indexOf(" ");
      name = el.replace(reg, " ");
      name = space < 0 ? name.slice(1, el.length - 1) : name.slice(1, space);
      if (html === "html") {
        name = name.toLowerCase();
      }
      name = name.replace(/(\}\})$/, "");
      if (name.indexOf("(") > 0) {
        name = name.slice(0, name.indexOf("("));
      }
      if (name === "?xml?") {
        return "xml";
      }
      return name;
    },
    // A fix for HTML missing end tags
    fixHtmlEnd = function lexer_markup_fixHtmlEnd(element: string, end: boolean): void {
      const tname: string = tagName(element),
        record: record = {
          begin: parse.structure[parse.structure.length - 1][1],
          ender: -1,
          lines: data.lines[parse.count] > 0 ? 1 : 0,
          stack: parse.structure[parse.structure.length - 1][0],
          token: `</${parse.structure[parse.structure.length - 1][0]}>`,
          types: "end",
        };
      recordPush(data, record, "");
      if (
        htmlblocks[parse.structure[parse.structure.length - 1][0]] === "block" &&
        ((end === true && parse.structure.length > 1) ||
          (end === false && `/${parse.structure[parse.structure.length - 1][0]}` !== tname))
      ) {
        while (
          htmlblocks[parse.structure[parse.structure.length - 1][0]] === "block" &&
          ((end === true && parse.structure.length > 1) ||
            (end === false && `/${parse.structure[parse.structure.length - 1][0]}` !== tname))
        ) {
          record.begin = parse.structure[parse.structure.length - 1][1];
          record.stack = parse.structure[parse.structure.length - 1][0];
          record.token = `</${parse.structure[parse.structure.length - 1][0]}>`;
          recordPush(data, record, "");
        }
      }
    },
    // A fix for Vapor Leaf end structure parsing
    //parses tags, attributes, and template elements
    tag = function lexer_markup_tag(end: string): void {
      // markup is two smaller lexers that work together: tag - evaluates markup and
      // template tags content - evaluates text content and code for external lexers
      //
      //type definitions:
      // * start      end     type
      // * <![CDATA[   ]]>    cdata
      // * <!--       -->     comment
      // * <#--       -->     comment
      // * <%--       --%>    comment
      // * {!         !}      comment
      // * <!--[if    -->     conditional
      // * text       text    content
      // * </         >       end
      // * <pre       </pre>  ignore (html only)
      // * text       text    script
      // * <!         >       sgml
      // * <          />      singleton
      // * <          >       start
      // * text       text    style
      // * <!--#      -->     template
      // * <%         %>      template
      // * {{{        }}}     template
      // * {{         }}      template
      // * {%         %}      template
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
      // * {:else}            template_else
      // * <#else     >       template_else
      // * {@}else{@}         template_else
      // * <%}else{%>         template_else
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
        attstore: attStore = [],
        comm: [string, number] = ["", 0];
      const record: record = {
          begin: parse.structure[parse.structure.length - 1][1],
          ender: -1,
          lines: parse.linesSpace,
          stack: parse.structure[parse.structure.length - 1][0],
          token: "",
          types: "",
        },
        // attribute parser
        attributeRecord = function lexer_markup_tag_attributeRecord(): void {
          let ind: number = 0,
            eq: number = 0,
            dq: number = 0,
            slice: string = "",
            name: string = "",
            store: string[] = [],
            len: number = attstore.length;
          const qc: "none" | "double" | "single" = "none",
            begin: number = parse.count,
            stack: string = tname.replace(/\/$/, ""),
            syntax: string = "<{\"'=/",
            convertQ = function lexer_markup_tag_attributeRecord_convertQ(): void {
              if (
                qc === "none" ||
                record.types !== "attribute" ||
                (qc === "single" && record.token.indexOf('"') < 0) ||
                (qc === "double" && record.token.indexOf("'") < 0)
              ) {
                recordPush(data, record, "");
              } else {
                let ee: number = 0,
                  inner: boolean = false;
                const chars: string[] = record.token.split(""),
                  eq: number = record.token.indexOf("="),
                  len: number = chars.length - 1;
                if (chars[eq + 1] !== '"' && qc === "single" && chars[chars.length - 1] !== '"') {
                  recordPush(data, record, "");
                } else if (
                  chars[eq + 1] !== "'" &&
                  qc === "double" &&
                  chars[chars.length - 1] !== "'"
                ) {
                  recordPush(data, record, "");
                } else {
                  ee = eq + 2;
                  if (qc === "double") {
                    if (record.token.slice(eq + 2, len).indexOf('"') > -1) {
                      inner = true;
                    }
                    chars[eq + 1] = '"';
                    chars[chars.length - 1] = '"';
                  } else {
                    if (record.token.slice(eq + 2, len).indexOf("'") > -1) {
                      inner = true;
                    }
                    chars[eq + 1] = "'";
                    chars[chars.length - 1] = "'";
                  }
                  if (inner === true) {
                    while (ee < len) {
                      if (chars[ee] === "'" && qc === "single") {
                        chars[ee] = '"';
                      } else if (chars[ee] === '"' && qc === "double") {
                        chars[ee] = "'";
                      }
                      ee = ee + 1;
                    }
                  }
                  record.token = chars.join("");
                  recordPush(data, record, "");
                }
              }
            },
            templateAtt = function lexer_markup_tag_attributeRecord_templateAtt(
              sample: string,
              token: string
            ): void {
              if (sample.charAt(0) === "{" && "{%".indexOf(sample.charAt(1)) > -1) {
                record.types = "template_attribute";
              } else {
                record.token = token;
                convertQ();
                return;
              }
              record.token = token;
              convertQ();
              record.types = "attribute";
            };

          if (attstore.length < 1) {
            return;
          }

          // fix for singleton tags, since "/" at the end of the tag is not an attribute
          if (attstore[attstore.length - 1][0] === "/") {
            attstore.pop();
            element = element.replace(/>$/, "/>");
          }

          // reconnects attribute names to their respective values if separated on "="
          eq = attstore.length;
          dq = 1;
          while (dq < eq) {
            name = attstore[dq - 1][0];
            if (name.charAt(name.length - 1) === "=" && attstore[dq][0].indexOf("=") < 0) {
              attstore[dq - 1][0] = name + attstore[dq][0];
              attstore.splice(dq, 1);
              eq = eq - 1;
              dq = dq - 1;
            }
            dq = dq + 1;
          }

          record.begin = begin;
          record.stack = stack;
          record.types = "attribute";
          store = [];

          while (ind < len) {
            if (attstore[ind] === undefined) {
              break;
            }
            attstore[ind][0] = attstore[ind][0].replace(/\s+$/, "");
            record.lines = attstore[ind][1];
            eq = attstore[ind][0].indexOf("=");
            dq = attstore[ind][0].indexOf('"');

            if (eq > -1 && store.length > 0) {
              record.token = store.join(" ");
              convertQ();
              if (
                attstore[ind][0].indexOf("=") > 0 &&
                attstore[ind][0].indexOf("//") < 0 &&
                attstore[ind][0].charAt(0) !== ";"
              ) {
                record.token = attstore[ind][0].replace(/\s$/, "");
              } else {
                record.token = attstore[ind][0];
              }
              convertQ();
              store = [];
            } else if (ltype === "sgml") {
              store.push(attstore[ind][0]);
            } else if (eq < 0) {
              record.token = attstore[ind][0];
              convertQ();
            } else {
              // separates out the attribute name from its value
              slice = attstore[ind][0].slice(eq + 1);
              if (syntax.indexOf(slice.charAt(0)) < 0) {
                slice = '"' + slice + '"';
              }
              name = attstore[ind][0].slice(0, eq);
              name = name + "=" + slice;
              templateAtt(slice.replace(/^("|')/, "").slice(0, 2), name.replace(/(\s+)$/, ""));
            }
            ind = ind + 1;
          }
          if (store.length > 0) {
            record.token = store.join(" ");
            convertQ();
          }
        };

      // this complex series of conditions determines an elements delimiters look to
      // the types being pushed to quickly reason about the logic no type is pushed
      // for start tags or singleton tags just yet some types set the `preserve` flag,
      // which means to preserve internal white space The `nopush` flag is set when
      // parsed tags are to be ignored and forgotten
      (function lexer_markup_tag_types() {
        if (end === "]>") {
          end = ">";
          sgmlflag = sgmlflag - 1;
          ltype = "end";
        } else if (end === "---") {
          ltype = "comment";
          start = "---";
        } else if (b[a] === "<") {
          if (b[a + 1] === "/") {
            if (b[a + 2] === "#") {
              ltype = "template_end";
            } else {
              ltype = "end";
            }
            end = ">";
          } else if (b[a + 1] === "!") {
            if (b[a + 2] === "-" && b[a + 3] === "-") {
              if (b[a + 4] === "#") {
                end = "-->";
                ltype = "template";
              } else {
                end = "-->";
                ltype = "comment";
                start = "<!--";
              }
            } else if (b.slice(a + 2, a + 8).join("") === "[CDATA") {
              end = "]]>";
              ltype = "cdata";
              preserve = true;
            } else {
              end = ">";
              sgmlflag = sgmlflag + 1;
              ltype = "sgml";
            }
          } else if (b[a + 1] === "?") {
            end = "?>";
            if (b[a + 2] === "x" && b[a + 3] === "m" && b[a + 4] === "l") {
              ltype = "xml";
              simple = true;
            } else {
              preserve = true;
              ltype = "template";
            }
          } else if (b[a + 1] === "%") {
            preserve = true;
            if (b[a + 2] === "-" && b[a + 3] === "-") {
              end = "--%>";
              ltype = "comment";
              start = "<%--";
            } else if (b[a + 2] === "#") {
              end = "%>";
              ltype = "comment";
              start = "<%#";
            } else {
              end = "%>";
              ltype = "template";
            }
          } else if (
            b
              .slice(a + 1, a + 4)
              .join("")
              .toLowerCase() === "pre"
          ) {
            end = "</pre>";
            preserve = true;
            ltype = "ignore";
          } else if (
            b
              .slice(a + 1, a + 6)
              .join("")
              .toLowerCase() === "style"
          ) {
            end = "</style>";
            preserve = true;
            ltype = "ignore";
          } else if (
            b
              .slice(a + 1, a + 7)
              .join("")
              .toLowerCase() === "script"
          ) {
            end = "</script>";
            preserve = true;
            ltype = "ignore";
          } else if (
            b
              .slice(a + 1, a + 9)
              .join("")
              .toLowerCase() === "xsl:text"
          ) {
            end = "</xsl:text>";
            preserve = true;
            ltype = "ignore";
          } else if (b[a + 1] === "<") {
            if (b[a + 2] === "<") {
              end = ">>>";
            } else {
              end = ">>";
            }
            ltype = "template";
          } else if (b[a + 1] === "#") {
            if (b[a + 2] === "e" && b[a + 3] === "l" && b[a + 4] === "s" && b[a + 5] === "e") {
              end = ">";
              ltype = "template_else";
            } else if (b[a + 2] === "-" && b[a + 3] === "-") {
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
        } else if (b[a] === "{") {
          preserve = true;
          if (b[a + 1] === "{") {
            if (b[a + 2] === "{") {
              end = "}}}";
              ltype = "template";
            } else if (b[a + 2] === "#") {
              end = "}}";
              ltype = "template_start";
            } else if (b[a + 2] === "/") {
              end = "}}";
              ltype = "template_end";
            } else if (b[a + 2] === "e" && b[a + 3] === "n" && b[a + 4] === "d") {
              end = "}}";
              ltype = "template_end";
            } else if (
              b[a + 2] === "e" &&
              b[a + 3] === "l" &&
              b[a + 4] === "s" &&
              b[a + 5] === "e"
            ) {
              end = "}}";
              ltype = "template_else";
            } else {
              end = "}}";
              ltype = "template";
            }
          } else if (b[a + 1] === "%") {
            end = "%}";
            ltype = "template";
          } else if (b[a + 1] === "#") {
            end = "#}";
            ltype = "comment";
            start = "{#";
          } else {
            end = b[a + 1] + "}";
            ltype = "template";
          }
        } else if (b[a] === "[" && b[a + 1] === "%") {
          end = "%]";
          ltype = "template";
        }
      })();

      // This is the real tag lexer. Everything that follows is attribute handling and
      // edge cases
      lastchar = end.charAt(end.length - 1);
      if (ltype === "comment" && b[a] === "<") {
        comm = parse.wrapCommentBlock({
          chars: b,
          end: c,
          opening: start,
          start: a,
          terminator: end,
        });
        [element, a] = comm;
        record.token = element;
        record.types = "comment";
        recordPush(data, record, "");
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
      const lex: string[] = [],
        // attribute lexer
        attributeLexer = function lexer_markup_tag_attributeLexer(quotes: boolean): void {
          let atty: string = "",
            aa: number = 0,
            bb: number = 0;
          if (quotes === true) {
            atty = attribute.join("");
            quote = "";
          } else {
            atty = attribute.join("");
            atty = atty.replace(/\s+/g, " ");
          }
          atty = atty.replace(/^\u0020/, "").replace(/\u0020$/, "");
          attribute = atty.replace(/\r\n/g, "\n").split("\n");
          bb = attribute.length;
          while (aa < bb) {
            attribute[aa] = attribute[aa].replace(/(\s+)$/, "");
            aa = aa + 1;
          }
          atty = attribute.join(options.lf);
          atty = bracketSpace(atty);
          if (atty === "=") {
            attstore[attstore.length - 1][0] = `${attstore[attstore.length - 1][0]}=`;
          } else if (
            atty.charAt(0) === "=" &&
            attstore.length > 0 &&
            attstore[attstore.length - 1][0].indexOf("=") < 0
          ) {
            //if an attribute starts with a `=` then adjoin it to the last attribute
            attstore[attstore.length - 1][0] = attstore[attstore.length - 1][0] + atty;
          } else if (
            atty.charAt(0) !== "=" &&
            attstore.length > 0 &&
            attstore[attstore.length - 1][0].indexOf("=") ===
              attstore[attstore.length - 1][0].length - 1
          ) {
            // if an attribute follows an attribute ending with `=` then adjoin it to the
            // last attribute
            attstore[attstore.length - 1][0] = attstore[attstore.length - 1][0] + atty;
          } else if (atty !== "" && atty !== " ") {
            attstore.push([atty, lines]);
          }
          if (attstore.length > 0 && attstore[attstore.length - 1][0].indexOf("=\u201c") > 0) {
            lexData.parseerror = `Quote looking character (\u201c, &#x201c) used instead of actual quotes on line number ${parse.lineNumber}`;
          } else if (
            attstore.length > 0 &&
            attstore[attstore.length - 1][0].indexOf("=\u201d") > 0
          ) {
            lexData.parseerror = `Quote looking character (\u201d, &#x201d) used instead of actual quotes on line number ${parse.lineNumber}`;
          }
          attribute = [];
          lines = b[a] === "\n" ? 2 : 1;
        };
      while (a < c) {
        if (b[a] === "\n") {
          lines = lines + 1;
          parse.lineNumber = parse.lineNumber + 1;
        }
        if (preserve === true || (/\s/.test(b[a]) === false && quote !== "}") || quote === "}") {
          lex.push(b[a]);
          if (lex[0] === "<" && lex[1] === ">" && end === ">") {
            record.token = "<>";
            record.types = "start";
            recordPush(data, record, "(empty)");
            return;
          }
          if (lex[0] === "<" && lex[1] === "/" && lex[2] === ">" && end === ">") {
            record.token = "</>";
            record.types = "end";
            recordPush(data, record, "");
            return;
          }
        }
        if (ltype === "cdata" && b[a] === ">" && b[a - 1] === "]" && b[a - 2] !== "]") {
          lexData.parseerror = `CDATA tag ${lex.join("")} is not properly terminated with ]]>`;
          break;
        }
        if (quote === "") {
          if (lex[0] + lex[1] === "<!" && ltype !== "cdata") {
            if (b[a] === "[") {
              if (b[a + 1] === "<") {
                ltype = "start";
                break;
              }
              while (a < c - 1 && /\s/.test(b[a + 1]) === true) {
                a = a + 1;
                if (b[a] === "\n") {
                  lines = lines + 1;
                }
              }
              if (b[a + 1] === "<") {
                ltype = "start";
                break;
              }
            }
            if (b[a] !== ">" && b[a + 1] === "<") {
              lexData.parseerror = `SGML tag ${lex.join(
                ""
              )} is missing termination with '[' or '>'.`;
              break;
            }
          }
          if (data.types[parse.count] === "sgml" && b[a] === "[" && lex.length > 4) {
            data.types[parse.count] = "template_start";
            count.start = count.start + 1;
            break;
          }
          if (
            b[a] === "<" &&
            preserve === false &&
            lex.length > 1 &&
            end !== ">>" &&
            end !== ">>>" &&
            simple === true
          ) {
            lexData.parseerror = `Parse error on line ${parse.lineNumber} on element: ${lex.join(
              ""
            )}`;
          }
          if (stest === true && /\s/.test(b[a]) === false && b[a] !== lastchar) {
            //attribute start
            stest = false;
            quote = jsxquote;
            igcount = 0;
            lex.pop();
            while (a < c) {
              if (b[a] === "\n") {
                parse.lineNumber = parse.lineNumber + 1;
              }
              attribute.push(b[a]);
              if ((b[a] === "<" || b[a] === ">") && (quote === "" || quote === ">")) {
                if (quote === "" && b[a] === "<") {
                  quote = ">";
                  braccount = 1;
                } else if (quote === ">") {
                  if (b[a] === "<") {
                    braccount = braccount + 1;
                  } else if (b[a] === ">") {
                    braccount = braccount - 1;
                    if (braccount === 0) {
                      quote = "";
                      igcount = 0;
                      attributeLexer(false);
                      break;
                    }
                  }
                }
              } else if (quote === "") {
                if (b[a + 1] === lastchar) {
                  //if at end of tag
                  if (
                    attribute[attribute.length - 1] === "/" ||
                    (attribute[attribute.length - 1] === "?" && ltype === "xml")
                  ) {
                    attribute.pop();
                    if (preserve === true) {
                      lex.pop();
                    }
                    a = a - 1;
                  }
                  if (attribute.length > 0) {
                    attributeLexer(false);
                  }
                  break;
                } else if (b[a] === "{" && b[a - 1] === "=") {
                  quote = "}";
                } else if (b[a] === '"' || b[a] === "'") {
                  quote = b[a];
                  if (
                    b[a - 1] === "=" &&
                    (b[a + 1] === "<" ||
                      (b[a + 1] === "{" && b[a + 2] === "%") ||
                      (/\s/.test(b[a + 1]) === true && b[a - 1] !== "="))
                  ) {
                    igcount = a;
                  }
                } else if (b[a] === "(") {
                  quote = ")";
                  parncount = 1;
                } else if (
                  lex[0] !== "{" &&
                  b[a] === "{" &&
                  (b[a + 1] === "{" || b[a + 1] === "%" || b[a + 1] === "@" || b[a + 1] === "#")
                ) {
                  //opening embedded template expression
                  if (b[a + 1] === "{") {
                    if (b[a + 2] === "{") {
                      quote = "}}}";
                    } else {
                      quote = "}}";
                    }
                  } else {
                    quote = b[a + 1] + "}";
                  }
                }
                if (/\s/.test(b[a]) === true && quote === "") {
                  // testing for a run of spaces between an attribute's = and a quoted value.
                  // Unquoted values separated by space are separate attributes
                  if (attribute[attribute.length - 2] === "=") {
                    while (e < c) {
                      if (/\s/.test(b[e]) === false) {
                        if (b[e] === '"' || b[e] === "'") {
                          a = e - 1;
                          quotetest = true;
                          attribute.pop();
                        }
                        break;
                      }
                      e = e + 1;
                    }
                  }
                  if (quotetest === true) {
                    quotetest = false;
                  } else if (jsxcount === 0 || (jsxcount === 1 && attribute[0] === "{")) {
                    //if there is an unquoted space attribute is complete
                    attribute.pop();
                    attributeLexer(false);
                    stest = true;
                    break;
                  }
                }
              } else if (b[a] === "(" && quote === ")") {
                parncount = parncount + 1;
              } else if (b[a] === ")" && quote === ")") {
                parncount = parncount - 1;
                if (parncount === 0) {
                  quote = "";
                  if (b[a + 1] === end.charAt(0)) {
                    attributeLexer(false);
                    break;
                  }
                }
              } else if (
                b[a] === "{" &&
                b[a + 1] === "%" &&
                b[igcount - 1] === "=" &&
                (quote === '"' || quote === "'")
              ) {
                quote = quote + "{%";
                igcount = 0;
              } else if (b[a - 1] === "%" && b[a] === "}" && (quote === '"{%' || quote === "'{%")) {
                quote = quote.charAt(0);
                igcount = 0;
              } else if (
                b[a] === "<" &&
                end === ">" &&
                b[igcount - 1] === "=" &&
                (quote === '"' || quote === "'")
              ) {
                quote = quote + "<";
                igcount = 0;
              } else if (b[a] === ">" && (quote === '"<' || quote === "'<")) {
                quote = quote.charAt(0);
                igcount = 0;
              } else if (
                igcount === 0 &&
                quote !== ">" &&
                (quote.length < 2 || (quote.charAt(0) !== '"' && quote.charAt(0) !== "'"))
              ) {
                //terminate attribute at the conclusion of a quote pair
                f = 0;
                if (lex.length > 1) {
                  tname = lex[1] + lex[2];
                  tname = tname.toLowerCase();
                }
                e = quote.length - 1;
                while (e > -1) {
                  if (b[a - f] !== quote.charAt(e)) {
                    break;
                  }
                  f = f + 1;
                  e = e - 1;
                }
                if (e < 0) {
                  attributeLexer(true);
                  if (b[a + 1] === lastchar) {
                    break;
                  }
                }
              } else if (igcount > 0 && /\s/.test(b[a]) === false) {
                igcount = 0;
              }
              a = a + 1;
            }
          } else if (end !== "%>" && end !== "\n" && (b[a] === '"' || b[a] === "'")) {
            //opening quote
            quote = b[a];
          } else if (
            ltype !== "comment" &&
            end !== "\n" &&
            b[a] === "<" &&
            b[a + 1] === "!" &&
            b[a + 2] === "-" &&
            b[a + 3] === "-" &&
            b[a + 4] !== "#" &&
            data.types[parse.count] !== "conditional"
          ) {
            quote = "-->";
          } else if (
            b[a] === "{" &&
            lex[0] !== "{" &&
            end !== "\n" &&
            end !== "%>" &&
            end !== "%]" &&
            (b[a + 1] === "{" || b[a + 1] === "%" || b[a + 1] === "@" || b[a + 1] === "#")
          ) {
            //opening embedded template expression
            if (b[a + 1] === "{") {
              if (b[a + 2] === "{") {
                quote = "}}}";
              } else {
                quote = "}}";
              }
            } else {
              quote = b[a + 1] + "}";
              if (attribute.length < 1 && (attstore.length < 1 || /\s/.test(b[a - 1]) === true)) {
                lex.pop();
                while (a < c && b[a - 1] + b[a] !== quote) {
                  if (b[a] === "\n") {
                    lines = lines + 1;
                  }
                  attribute.push(b[a]);
                  a = a + 1;
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
            end !== "\n" &&
            /\s/.test(b[a]) === true &&
            b[a - 1] !== "<"
          ) {
            //identify a space in a regular start or singleton tag
            if (ltype === "sgml") {
              lex.push(" ");
            } else {
              stest = true;
            }
          } else if (
            (b[a] === lastchar || (end === "\n" && b[a + 1] === "<")) &&
            (lex.length > end.length + 1 || lex[0] === "]")
          ) {
            if (end === "\n") {
              while (/\s/.test(lex[lex.length - 1]) === true) {
                lex.pop();
                a = a - 1;
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
                f = f - 1;
                if (lex[f] !== end.charAt(e)) {
                  break;
                }
                e = e - 1;
              }
              if (e < 0) {
                break;
              }
            }
          }
        } else if (b[a] === quote.charAt(quote.length - 1) && end !== "}") {
          //find the closing quote or embedded template expression
          f = 0;
          if (lex.length > 1) {
            tname = lex[1] + lex[2];
            tname = tname.toLowerCase();
          }
          e = quote.length - 1;
          while (e > -1) {
            if (b[a - f] !== quote.charAt(e)) {
              break;
            }
            f = f + 1;
            e = e - 1;
          }
          if (e < 0) {
            quote = "";
          }
        }
        a = a + 1;
      }

      if (a < c) {
        //a correction to incomplete template tags that use multiple angle braces
        if (options.correct === true) {
          if (b[a + 1] === ">" && lex[0] === "<" && lex[1] !== "<") {
            while (b[a + 1] === ">") {
              a = a + 1;
            }
          } else if (
            lex[0] === "<" &&
            lex[1] === "<" &&
            b[a + 1] !== ">" &&
            lex[lex.length - 2] !== ">"
          ) {
            while (lex[1] === "<") {
              lex.splice(1, 1);
            }
          }
        }

        igcount = 0;
        element = lex.join("");
        tname = tagName(element);
        element = bracketSpace(element);
        if (tname === "xml") {
          html = "xml";
        } else if (
          html === "" &&
          tname === "!DOCTYPE" &&
          element.toLowerCase().indexOf("xhtml") > 0
        ) {
          html = "xml";
        } else if (html === "" && tname === "html") {
          html = "html";
        }
      }
      record.token = element;
      record.types = ltype;
      tname = tagName(element);

      // Twig language allows {% block %} elements to be singleton or start.  You don't
      // know until you encounter a {% endblock %} tag
      if (tname === "endblock" && element.slice(0, 2) === "{%") {
        const endName: string = element.replace(/\{%\s*endblock\s+/, "").replace(/\s*%\}/, "");
        let aa: number = parse.count,
          bb: number = parse.count,
          startName: string = "";
        while (aa > -1) {
          if (data.types[aa].indexOf("end") > 0) {
            aa = data.begin[aa];
            if (aa < 0) {
              break;
            }
          } else if (/\{%\s*block/.test(data.token[aa]) === true) {
            if (endName === "") {
              break;
            }
            startName = data.token[aa]
              .replace(/\{%\s*block\s+/, "")
              .split(/\s+/)[0]
              .replace(/\s+/, "");
            if (endName === startName) {
              break;
            }
          }
          aa = aa - 1;
        }
        count.start = count.start + 1;
        data.types[aa] = "template_start";
        data.ender[aa] = parse.count + 1;
        record.begin = aa;
        record.stack = "block";
        record.token = element;
        record.types = "template_end";
        if (aa > -1) {
          while (bb > aa) {
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
            bb = bb - 1;
          }
        }
        parse.structure.push(["block", aa]);
        recordPush(data, record, "");
        return;
      }

      if (preserve === false) {
        element = element.replace(/\s+/g, " ");
      }

      //a quick hack to inject records for a type of template comments
      if (tname === "comment" && element.slice(0, 2) === "{%") {
        const lineFindStart = function lexer_markup_tag_lineFindStart(spaces: string): string {
            if (spaces === "") {
              linesStart = 0;
            } else {
              linesStart = spaces.split("\n").length;
            }
            return "";
          },
          lineFindEnd = function lexer_markup_tag_lineFindEnd(spaces: string): string {
            if (spaces === "") {
              linesEnd = 0;
            } else {
              linesEnd = spaces.split("\n").length;
            }
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
          recordPush(data, record, "comment");
          record.begin = parse.count;
          element = element.replace(/^\s*/, lineFindStart);
          element = element.replace(/\s*$/, lineFindEnd);
          record.lines = linesStart;
          record.stack = "comment";
          record.token = element;
          record.types = "comment";
          recordPush(data, record, "");
          record.token = "{%- endcomment -%}";
        } else {
          element = element
            .replace(/^(\s*\{%\s*comment\s*%\})/, "")
            .replace(/(\{%\s*endcomment\s*%\}\s*)$/, "");
          record.token = "{% comment %}";
          recordPush(data, record, "comment");
          record.begin = parse.count;
          element = element.replace(/^\s*/, lineFindStart);
          element = element.replace(/\s*$/, lineFindEnd);
          record.lines = linesStart;
          record.stack = "comment";
          record.token = element;
          record.types = "comment";
          recordPush(data, record, "");
          record.token = "{% endcomment %}";
        }
        record.lines = linesEnd;
        record.types = "template_end";
        recordPush(data, record, "");
        return;
      }

      // a type correction for template tags who have variable start tag names but a
      // consistent ending tag name
      if (element.indexOf("{{") === 0 && element.slice(element.length - 2) === "}}") {
        if (tname === "end") {
          ltype = "template_end";
        } else if (tname === "else") {
          ltype = "template_else";
        }
      } else if (element.slice(0, 2) === "<%" && element.slice(element.length - 2) === "%>") {
        if (/^(<%\s+end\s+-?%>)$/.test(element) === true) {
          ltype = "template_end";
        } else if (
          (/\sdo\s/.test(element) === true && /\s-?%>$/.test(element) === true) ||
          /^(<%(%|-|=)?\s*if)/.test(element) === true
        ) {
          ltype = "template_start";
        }
      }
      record.types = ltype;

      //update a flag for subatomic parsing in SGML tags
      if (
        end !== "]>" &&
        sgmlflag > 0 &&
        element.charAt(element.length - 1) !== "[" &&
        (element.slice(element.length - 2) === "]>" ||
          /^(<!((doctype)|(notation))\s)/i.test(element) === true)
      ) {
        sgmlflag = sgmlflag - 1;
      }

      // cheat identifies HTML singleton elements as singletons even if formatted as
      // start tags, such as <br> (which is really <br/>)
      cheat = (function lexer_markup_tag_cheat(): boolean {
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
          },
          fixsingleton = function lexer_markup_tag_cheat_fixsingleton(): boolean {
            let aa: number = parse.count,
              bb: number = 0;
            const vname: string = tname.slice(1);
            while (aa > -1) {
              if (data.types[aa] === "end") {
                bb = bb + 1;
              } else if (data.types[aa] === "start") {
                bb = bb - 1;
                if (bb < 0) {
                  return false;
                }
              }
              if (bb === 0 && data.token[aa].toLowerCase().indexOf(vname) === 1) {
                data.types[aa] = "start";
                count.start = count.start + 1;
                data.token[aa] = data.token[aa].replace(/(\s*\/>)$/, ">");
                return false;
              }
              aa = aa - 1;
            }
            return false;
          },
          peertest = function lexer_markup_tag_cheat_peertest(name: string, item: string): boolean {
            if (htmlblocks[name] === undefined) {
              return false;
            }
            if (name === item) {
              return true;
            }
            if (name === "dd" && item === "dt") {
              return true;
            }
            if (name === "dt" && item === "dd") {
              return true;
            }
            if (name === "td" && item === "th") {
              return true;
            }
            if (name === "th" && item === "td") {
              return true;
            }
            if (
              name === "colgroup" &&
              (item === "tbody" || item === "tfoot" || item === "thead" || item === "tr")
            ) {
              return true;
            }
            if (name === "tbody" && (item === "colgroup" || item === "tfoot" || item === "thead")) {
              return true;
            }
            if (name === "tfoot" && (item === "colgroup" || item === "tbody" || item === "thead")) {
              return true;
            }
            if (name === "thead" && (item === "colgroup" || item === "tbody" || item === "tfoot")) {
              return true;
            }
            if (name === "tr" && item === "colgroup") {
              return true;
            }
            return false;
          },
          addHtmlEnd = function (count: number): void {
            record.lines = data.lines[parse.count] > 0 ? 1 : 0;
            record.token = `</${parse.structure[parse.structure.length - 1][0]}>`;
            record.types = "end";
            recordPush(data, record, "");
            while (count > 0) {
              record.begin = parse.structure[parse.structure.length - 1][1];
              record.stack = parse.structure[parse.structure.length - 1][0];
              record.token = `</${parse.structure[parse.structure.length - 1][0]}>`;
              recordPush(data, record, "");
              count = count - 1;
            }
            record.begin = parse.structure[parse.structure.length - 1][1];
            record.lines = parse.linesSpace;
            record.stack = parse.structure[parse.structure.length - 1][0];
            record.token = element;
            record.types = "end";
            data.lines[parse.count - 1] = 0;
          };

        //determine if the current end tag is actually part of an HTML singleton
        if (ltype === "end") {
          const lastToken: string = data.token[parse.count];
          if (
            data.types[parse.count - 1] === "singleton" &&
            lastToken.charAt(lastToken.length - 2) !== "/" &&
            "/" + tagName(lastToken) === tname
          ) {
            data.types[parse.count - 1] = "start";
          }
        }

        if (html === "html") {
          // html gets tag names in lowercase, if you want to preserve case sensitivity
          // beautify as XML
          if (
            element.charAt(0) === "<" &&
            element.charAt(1) !== "!" &&
            element.charAt(1) !== "?" &&
            (parse.count < 0 || data.types[parse.count].indexOf("template") < 0)
          ) {
            element = element.toLowerCase();
          }

          if (
            htmlblocks[parse.structure[parse.structure.length - 1][0]] === "block" &&
            peertest(tname.slice(1), parse.structure[parse.structure.length - 2][0]) === true
          ) {
            // looks for HTML tags missing an ending pair when encountering an ending tag for a parent node
            addHtmlEnd(0);
          } else if (
            parse.structure.length > 3 &&
            htmlblocks[parse.structure[parse.structure.length - 1][0]] === "block" &&
            htmlblocks[parse.structure[parse.structure.length - 2][0]] === "block" &&
            htmlblocks[parse.structure[parse.structure.length - 3][0]] === "block" &&
            peertest(tname, parse.structure[parse.structure.length - 4][0]) === true
          ) {
            // looks for consecutive missing end tags
            addHtmlEnd(3);
          } else if (
            parse.structure.length > 2 &&
            htmlblocks[parse.structure[parse.structure.length - 1][0]] === "block" &&
            htmlblocks[parse.structure[parse.structure.length - 2][0]] === "block" &&
            peertest(tname, parse.structure[parse.structure.length - 3][0]) === true
          ) {
            // looks for consecutive missing end tags
            addHtmlEnd(2);
          } else if (
            parse.structure.length > 1 &&
            htmlblocks[parse.structure[parse.structure.length - 1][0]] === "block" &&
            peertest(tname, parse.structure[parse.structure.length - 2][0]) === true
          ) {
            // looks for consecutive missing end tags
            addHtmlEnd(1);
          } else if (peertest(tname, parse.structure[parse.structure.length - 1][0]) === true) {
            // certain tags cannot contain other certain tags if such tags are peers
            addHtmlEnd(0);
          } else if (
            tname.charAt(0) === "/" &&
            htmlblocks[parse.structure[parse.structure.length - 1][0]] === "block" &&
            parse.structure[parse.structure.length - 1][0] !== tname.slice(1)
          ) {
            // looks for consecutive missing end tags if the current element is an end tag
            fixHtmlEnd(element, false);
            record.begin = parse.structure[parse.structure.length - 1][1];
            record.lines = parse.linesSpace;
            record.stack = parse.structure[parse.structure.length - 1][0];
            record.token = element;
            record.types = "end";
            data.lines[parse.count - 1] = 0;
          }

          // generalized corrections for the handling of singleton tags
          if (data.types[parse.count] === "end" && htmlsings[tname.slice(1)] === "singleton") {
            return fixsingleton();
          }

          //inserts a trailing slash into singleton tags if they do not already have it
          if (htmlsings[tname] === "singleton") {
            if (options.correct === true && ender.test(element) === false) {
              element = element.slice(0, element.length - 1) + " />";
            }
            return true;
          }
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

      //am I a singleton or a start type?
      if (simple === true && ltype !== "xml" && ltype !== "sgml") {
        if (cheat === true || element.slice(element.length - 2) === "/>") {
          ltype = "singleton";
        } else {
          ltype = "start";
        }
        record.types = ltype;
      }

      // some template tags can be evaluated as a block start/end based on syntax
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
            "set",
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
            }
            if (names.map((n) => "end" + n).indexOf(tname) > -1) {
              record.types = "template_end";
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
          } else if (tname === "" || tname === "@" || tname === "#" || tname === "%") {
            tname = tname + element.slice(1).replace(tname, "").replace(/^\s+/, "");
            tname = tname.slice(0, tname.indexOf("(")).replace(/\s+/, "");
          }
        }
      }

      recordPush(data, record, tname);
      attributeRecord();
      parse.linesSpace = 0;
    },
    // parses everything other than markup tags
    content = function lexer_markup_content(): void {
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
      while (a < c) {
        if (b[a] === "\n") {
          parse.lineNumber += 1;
        }

        // Artifacts nested within an SGML tag
        if (square === true && b[a] === "]") {
          a = a - 1;
          ltoke = lex.join("");
          liner = 0;
          record.token = ltoke;
          recordPush(data, record, "");
          break;
        }

        // General content processing
        if (
          lex.length > 0 &&
          ((b[a] === "<" && b[a + 1] !== "=" && /\s|\d/.test(b[a + 1]) === false) ||
            (b[a] === "[" && b[a + 1] === "%") ||
            (b[a] === "{" &&
              (b[a + 1] === "{" || b[a + 1] === "%" || b[a + 1] === "@" || b[a + 1] === "#")))
        ) {
          //regular content
          a = a - 1;
          ltoke = lex.join("");
          ltoke = bracketSpace(ltoke);
          liner = 0;
          record.token = ltoke;
          if (options.wrap > 0) {
            let aa: number = options.wrap,
              len: number = ltoke.length,
              startSpace: string = "",
              endSpace: string = "";
            const wrap: number = options.wrap,
              store: string[] = [],
              wrapper = function beautify_markup_apply_content_wrapper(): void {
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
              };
            // HTML anchor lists do not get wrapping unless the content itself exceeds the wrapping limit
            if (
              data.token[data.begin[parse.count]] === "<a>" &&
              data.token[data.begin[data.begin[parse.count]]] === "<li>" &&
              data.lines[data.begin[parse.count]] === 0 &&
              parse.linesSpace === 0 &&
              ltoke.length < options.wrap
            ) {
              recordPush(data, record, "");
              break;
            }
            if (len < wrap) {
              recordPush(data, record, "");
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
            ltoke = store.join(options.lf);
            ltoke = startSpace + ltoke + endSpace;
          }
          liner = 0;
          record.token = ltoke;
          recordPush(data, record, "");
          break;
        }
        lex.push(b[a]);
        a = a + 1;
      }
    };

  // trim the attribute_sort_list values
  while (a < asl) {
    attribute_sort_list[a] = attribute_sort_list[a].replace(/^\s+/, "").replace(/\s+$/, "");
    a = a + 1;
  }
  a = 0;

  // Main loop
  while (a < c) {
    if (/\s/.test(b[a]) === true) {
      if (
        data.types[parse.count] === "template_start" &&
        parse.structure[parse.structure.length - 1][0] === "comment"
      ) {
        content();
      } else {
        a = parse.spacer({ array: b, end: c, index: a });
      }
    } else if (b[a] === "<") {
      tag("");
    } else if (b[a] === "[" && b[a + 1] === "%") {
      tag("%]");
    } else if (
      b[a] === "{" &&
      (b[a + 1] === "{" || b[a + 1] === "%" || b[a + 1] === "@" || b[a + 1] === "#")
    ) {
      tag("");
    } else if (b[a] === "]" && sgmlflag > 0) {
      tag("]>");
    } else {
      content();
    }
    a = a + 1;
  }
  if (
    data.token[parse.count].charAt(0) !== "/" &&
    htmlblocks[parse.structure[parse.structure.length - 1][0]] === "block"
  ) {
    fixHtmlEnd(data.token[parse.count], true);
  }
  if (count.end !== count.start && lexData.parseerror === "") {
    if (count.end > count.start) {
      let x: number = count.end - count.start,
        plural: string = x === 1 ? "" : "s";
      lexData.parseerror = `${x} more end type${plural} than start types.`;
    } else {
      let x: number = count.start - count.end,
        plural: string = x === 1 ? "" : "s";
      lexData.parseerror = `${x} more start type${plural} than end types.`;
    }
  }
  return data;
}
