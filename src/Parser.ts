import { markupLexer } from "./MarkupLexer";

export function initParser(options: FormatterOptions) {
  const parse: parse = {
    // stores the final index location of the data arrays
    count: -1,
    // stores the various data arrays of the parse table
    data: {
      begin: [],
      ender: [],
      lines: [],
      stack: [],
      token: [],
      types: [],
    },
    // stores the current line number from the input string for logging parse errors
    lineNumber: 1,
    // stores the 'lines' value before the next token
    linesSpace: 0,
    // stores the declared variable names for the script lexer.  This must be stored outside the script lexer since some languages recursive use of the script lexer
    references: [[]],
    // stores the stack and begin values by stacking depth
    structure: [["global", -1]],
    // an extension of Array.prototype.concat to work across the data structure.  This is an expensive operation.
    concat: function parse_concat(data: data, array: data): void {
      Object.entries(data).forEach(([k, v]) => {
        const matchingArrayEntry = Object.entries(array).filter(([k2, _]) => k2 === k)[0][1];
        v = v.concat(matchingArrayEntry);
      });
      if (data === parse.data) {
        parse.count = data.token.length - 1;
      }
    },
    // the function that sorts object properties
    object_sort: function parse_objectSort(data: data): void {
      let cc: number = parse.count,
        global: boolean = false,
        dd: number = parse.structure[parse.structure.length - 1][1],
        ee: number = 0,
        ff: number = 0,
        gg: number = 0,
        behind: number = 0,
        commaTest: boolean = true,
        front: number = 0,
        keyend: number = 0,
        keylen: number = 0;
      const keys: Array<[number, number]> = [],
        length: number = parse.count,
        begin: number = dd,
        stack: string = parse.structure[parse.structure.length - 1][0],
        style: boolean = false,
        delim: [string, string] = [",", "separator"],
        lines: number = parse.linesSpace,
        sort = function parse_objectSort_sort(x: [number, number], y: [number, number]): number {
          let xx = x[0],
            yy = y[0];
          if (data.types[xx] === "comment") {
            do {
              xx = xx + 1;
            } while (xx < length && data.types[xx] === "comment");
            if (data.token[xx] === undefined) {
              return 1;
            }
          }
          if (data.types[yy] === "comment") {
            do {
              yy = yy + 1;
            } while (yy < length && data.types[yy] === "comment");
            if (data.token[yy] === undefined) {
              return 1;
            }
          }
          if (data.token[xx].toLowerCase() > data.token[yy].toLowerCase()) {
            return 1;
          }
          return -1;
        },
        store: data = {
          begin: [],
          ender: [],
          lines: [],
          stack: [],
          token: [],
          types: [],
        };
      behind = cc;
      do {
        if (data.begin[cc] === dd) {
          if (data.types[cc].indexOf("template") > -1) {
            return;
          }
          if (data.token[cc] === delim[0]) {
            commaTest = true;
            front = cc + 1;
          }
          if (front === 0 && data.types[0] === "comment") {
            // keep top comments at the top
            do {
              front = front + 1;
            } while (data.types[front] === "comment");
          } else if (data.types[front] === "comment" && data.lines[front] < 2) {
            // if a comment follows code on the same line then keep the comment next to the code it follows
            front = front + 1;
          }
          if (commaTest === true && data.token[cc] === delim[0] && front <= behind) {
            if (data.token[behind] !== ",") {
              behind = behind + 1;
            }
            keys.push([front, behind]);
            behind = front - 1;
          }
        }
        cc = cc - 1;
      } while (cc > dd);
      if (keys.length > 0 && keys[keys.length - 1][0] > cc + 1) {
        ee = keys[keys.length - 1][0] - 1;
        if (data.types[ee] === "comment" && data.lines[ee] > 1) {
          do {
            ee = ee - 1;
          } while (ee > 0 && data.types[ee] === "comment");
          keys[keys.length - 1][0] = ee + 1;
        }
        if (data.types[cc + 1] === "comment" && cc === -1) {
          do {
            cc = cc + 1;
          } while (data.types[cc + 1] === "comment");
        }
        keys.push([cc + 1, ee]);
      }
      if (keys.length > 1) {
        if (
          data.token[cc - 1] === "=" ||
          data.token[cc - 1] === ":" ||
          data.token[cc - 1] === "(" ||
          data.token[cc - 1] === "[" ||
          data.token[cc - 1] === "," ||
          data.types[cc - 1] === "word" ||
          cc === 0
        ) {
          keys.sort(sort);
          keylen = keys.length;
          commaTest = false;
          dd = 0;
          do {
            keyend = keys[dd][1];
            ee = keys[dd][0];
            if (ee < keyend) {
              do {
                if (
                  style === false &&
                  dd === keylen - 1 &&
                  ee === keyend - 2 &&
                  data.token[ee] === "," &&
                  data.types[ee + 1] === "comment"
                ) {
                  // do not include terminal commas that are followed by a comment
                  ff = ff + 1;
                } else {
                  parse.push(
                    store,
                    {
                      begin: data.begin[ee],
                      ender: data.begin[ee],
                      lines: data.lines[ee],
                      stack: data.stack[ee],
                      token: data.token[ee],
                      types: data.types[ee],
                    },
                    ""
                  );
                  ff = ff + 1;
                }

                //remove extra commas
                if (data.token[ee] === delim[0] && data.begin[ee] === data.begin[keys[dd][0]]) {
                  commaTest = true;
                } else if (data.token[ee] !== delim[0] && data.types[ee] !== "comment") {
                  commaTest = false;
                }
                ee = ee + 1;
              } while (ee < keyend);
            }

            // injecting the list delimiter
            if (
              commaTest === false &&
              store.token[store.token.length - 1] !== "x;" &&
              dd < keylen - 1
            ) {
              ee = store.types.length - 1;
              if (store.types[ee] === "comment") {
                do {
                  ee = ee - 1;
                } while (ee > 0 && store.types[ee] === "comment");
              }
              ee = ee + 1;
              parse.splice({
                data: store,
                howmany: 0,
                index: ee,
                record: {
                  begin: begin,
                  ender: parse.count,
                  lines: 0,
                  stack: stack,
                  token: delim[0],
                  types: delim[1],
                },
              });
              ff = ff + 1;
            }
            dd = dd + 1;
          } while (dd < keylen);
          parse.splice({
            data: data,
            howmany: ff,
            index: cc + 1,
          });
          parse.linesSpace = lines;
          parse.concat(data, store);
          return;
        }
      }
      return;
    },
    // an extension of Array.prototype.pop to work across the data structure
    pop: function parse_pop(data: data): record {
      const output: record = {
        begin: data.begin.pop() ?? 0,
        ender: data.ender.pop() ?? 0,
        lines: data.lines.pop() ?? 0,
        stack: data.stack.pop() ?? "",
        token: data.token.pop() ?? "",
        types: data.types.pop() ?? "",
      };
      if (data === parse.data) {
        parse.count = parse.count - 1;
      }
      return output;
    },
    // an extension of Array.prototype.push to work across the data structure
    push: function parse_push(data: data, record: record, structure: string): void {
      const ender = function parse_push_ender(): void {
        return;
      };
      Object.entries(data).forEach(([k, v]) => {
        const matchingArrayEntry = Object.entries(record).filter(([k2, _]) => k2 === k)[0][1];
        v = v.concat(matchingArrayEntry);
      });
      if (data === parse.data) {
        parse.count = parse.count + 1;
        parse.linesSpace = 0;
        if (structure.replace(/(\{|\}|@|<|>|%|#|)/g, "") === "") {
          if (record.types === "else") {
            structure = "else";
          } else {
            structure = record.token;
          }
        } else if (/^<\?(=|(php))/.test(structure) === false) {
          structure = structure.replace(/(\{|\}|@|<|>|%|#|)\s*/g, "");
        }
        if (record.types === "start" || record.types.indexOf("_start") > 0) {
          parse.structure.push([structure, parse.count]);
        } else if (record.types === "end" || record.types.indexOf("_end") > 0) {
          // this big condition fixes language specific else blocks that are children of start/end blocks not associated with the if/else chain
          let case_ender: number = 0;
          if (
            parse.structure.length > 2 &&
            (data.types[parse.structure[parse.structure.length - 1][1]] === "else" ||
              data.types[parse.structure[parse.structure.length - 1][1]].indexOf("_else") > 0) &&
            (data.types[parse.structure[parse.structure.length - 2][1]] === "start" ||
              data.types[parse.structure[parse.structure.length - 2][1]].indexOf("_start") > 0) &&
            (data.types[parse.structure[parse.structure.length - 2][1] + 1] === "else" ||
              data.types[parse.structure[parse.structure.length - 2][1] + 1].indexOf("_else") > 0)
          ) {
            parse.structure.pop();
            data.begin[parse.count] = parse.structure[parse.structure.length - 1][1];
            data.stack[parse.count] = parse.structure[parse.structure.length - 1][0];
            data.ender[parse.count - 1] = parse.count;
            case_ender = data.ender[data.begin[parse.count] + 1];
          }
          ender();
          if (case_ender > 0) {
            data.ender[data.begin[parse.count] + 1] = case_ender;
          }
          parse.structure.pop();
        } else if (record.types === "else" || record.types.indexOf("_else") > 0) {
          if (structure === "") {
            structure = "else";
          }
          if (
            parse.count > 0 &&
            (data.types[parse.count - 1] === "start" ||
              data.types[parse.count - 1].indexOf("_start") > 0)
          ) {
            parse.structure.push([structure, parse.count]);
          } else {
            ender();
            if (structure === "") {
              parse.structure[parse.structure.length - 1] = ["else", parse.count];
            } else {
              parse.structure[parse.structure.length - 1] = [structure, parse.count];
            }
          }
        }
      }
    },
    // a custom sort tool that is a bit more intelligent and multidimensional than Array.prototype.sort
    safeSort: function parse_safeSort(
      array: any[],
      operation: "ascend" | "descend" | "normal",
      recursive: boolean
    ): any[] {
      let extref = function parse_safeSort_extref(item: any): any {
        //worthless function for backwards compatibility with older versions of V8 node.
        return item;
      };
      const arTest = function parse_safeSort_arTest(item: any): boolean {
          if (Array.isArray(item) === true) {
            return true;
          }
          return false;
        },
        normal = function parse_safeSort_normal(item: any[]): any[] {
          let storeb: any = item;
          const done: any = [item[0]],
            child = function safeSort_normal_child(): void {
              let a: number = 0;
              const len: number = storeb.length;
              if (a < len) {
                do {
                  if (arTest(storeb[a]) === true) {
                    storeb[a] = parse_safeSort_normal(storeb[a]);
                  }
                  a = a + 1;
                } while (a < len);
              }
            },
            recurse = function parse_safeSort_normal_recurse(x: any) {
              let a: number = 0;
              const storea: any[] = [],
                len: number = storeb.length;
              if (a < len) {
                do {
                  if (storeb[a] !== x) {
                    storea.push(storeb[a]);
                  }
                  a = a + 1;
                } while (a < len);
              }
              storeb = storea;
              if (storea.length > 0) {
                done.push(storea[0]);
                extref(storea[0]);
              } else {
                if (recursive === true) {
                  child();
                }
                item = storeb;
              }
            };
          extref = recurse;
          recurse(array[0]);
          return item;
        },
        descend = function parse_safeSort_descend(item: any[]): any[] {
          let c: number = 0;
          const len: number = item.length,
            storeb: any[] = item,
            child = function parse_safeSort_descend_child(): void {
              let a: number = 0;
              const lenc: number = storeb.length;
              if (a < lenc) {
                do {
                  if (arTest(storeb[a]) === true) {
                    storeb[a] = parse_safeSort_descend(storeb[a]);
                  }
                  a = a + 1;
                } while (a < lenc);
              }
            },
            recurse = function parse_safeSort_descend_recurse(value: string): string {
              let a: number = c,
                b: number = 0,
                d: number = 0,
                e: number = 0,
                ind: any[] = [],
                key: any = storeb[c],
                tstore: string = "";
              const tkey: string = typeof key;
              if (a < len) {
                do {
                  tstore = typeof storeb[a];
                  if (storeb[a] > key || tstore > tkey) {
                    key = storeb[a];
                    ind = [a];
                  } else if (storeb[a] === key) {
                    ind.push(a);
                  }
                  a = a + 1;
                } while (a < len);
              }
              d = ind.length;
              a = c;
              b = d + c;
              if (a < b) {
                do {
                  storeb[ind[e]] = storeb[a];
                  storeb[a] = key;
                  e = e + 1;
                  a = a + 1;
                } while (a < b);
              }
              c = c + d;
              if (c < len) {
                extref("");
              } else {
                if (recursive === true) {
                  child();
                }
                item = storeb;
              }
              return value;
            };
          extref = recurse;
          recurse("");
          return item;
        },
        ascend = function parse_safeSort_ascend(item: any[]): any[] {
          let c: number = 0;
          const len: number = item.length,
            storeb: any[] = item,
            child = function parse_safeSort_ascend_child(): void {
              let a: number = 0;
              const lenc: number = storeb.length;
              if (a < lenc) {
                do {
                  if (arTest(storeb[a]) === true) {
                    storeb[a] = parse_safeSort_ascend(storeb[a]);
                  }
                  a = a + 1;
                } while (a < lenc);
              }
            },
            recurse = function parse_safeSort_ascend_recurse(value: string): string {
              let a: number = c,
                b: number = 0,
                d: number = 0,
                e: number = 0,
                ind: any[] = [],
                key: any = storeb[c],
                tstore: string = "";
              const tkey: string = typeof key;
              if (a < len) {
                do {
                  tstore = typeof storeb[a];
                  if (storeb[a] < key || tstore < tkey) {
                    key = storeb[a];
                    ind = [a];
                  } else if (storeb[a] === key) {
                    ind.push(a);
                  }
                  a = a + 1;
                } while (a < len);
              }
              d = ind.length;
              a = c;
              b = d + c;
              if (a < b) {
                do {
                  storeb[ind[e]] = storeb[a];
                  storeb[a] = key;
                  e = e + 1;
                  a = a + 1;
                } while (a < b);
              }
              c = c + d;
              if (c < len) {
                extref("");
              } else {
                if (recursive === true) {
                  child();
                }
                item = storeb;
              }
              return value;
            };
          extref = recurse;
          recurse("");
          return item;
        };
      if (arTest(array) === false) {
        return array;
      }
      if (operation === "normal") {
        return normal(array);
      }
      if (operation === "descend") {
        return descend(array);
      }
      return ascend(array);
    },
    // a simple tool to take note of whitespace between tokens
    spacer: function parse_spacer(args: spacer): number {
      // * array - the characters to scan
      // * index - the index to start scanning from
      // * end   - the length of the array, to break the loop
      parse.linesSpace = 1;
      do {
        if (args.array[args.index] === "\n") {
          parse.linesSpace = parse.linesSpace + 1;
          parse.lineNumber = parse.lineNumber + 1;
        }
        if (/\s/.test(args.array[args.index + 1]) === false) {
          break;
        }
        args.index = args.index + 1;
      } while (args.index < args.end);
      return args.index;
    },
    // an extension of Array.prototype.splice to work across the data structure
    splice: function parse_splice(spliceData: splice): void {
      const finalItem: [number, string] = [
        parse.data.begin[parse.count],
        parse.data.token[parse.count],
      ];
      // * data    - The data object to alter
      // * howmany - How many indexes to remove
      // * index   - The index where to start
      // * record  - A new record to insert
      if (spliceData.record && spliceData.record.token !== "") {
        Object.entries(spliceData.data).forEach(([k, v]) => {
          const matchingArrayEntry = Object.entries(spliceData.record ?? {}).filter(
            ([k2, _]) => k2 === k
          )[0][1];
          v.splice(spliceData.index, spliceData.howmany, matchingArrayEntry);
        });
        if (spliceData.data === parse.data) {
          parse.count = parse.count - spliceData.howmany + 1;
          if (
            finalItem[0] !== parse.data.begin[parse.count] ||
            finalItem[1] !== parse.data.token[parse.count]
          ) {
            parse.linesSpace = 0;
          }
        }
        return;
      }
      Object.entries(spliceData.data).forEach(([_, v]) => {
        v.splice(spliceData.index, spliceData.howmany);
      });
      if (spliceData.data === parse.data) {
        parse.count = parse.count - spliceData.howmany;
        parse.linesSpace = 0;
      }
    },
    // parsing block comments and simultaneously applying word wrap
    wrapCommentBlock: function parse_wrapCommentBlock(config: wrapConfig): [string, number] {
      let a: number = config.start,
        b: number = 0,
        c: number = 0,
        d: number = 0,
        len: number = 0,
        lines: string[] = [],
        space: string = "",
        bline: string = "",
        spaceLine: RegExp,
        emptyLine: boolean = false,
        bulletLine: boolean = false,
        numberLine: boolean = false,
        bigLine: boolean = false,
        output: string = "",
        terml: number = config.terminator.length - 1,
        term: string = config.terminator.charAt(terml),
        twrap: number = 0;
      const build: string[] = [],
        second: string[] = [],
        sanitize = function parse_wrapCommentBlock_sanitize(input: string) {
          return `\\${input}`;
        },
        regEsc: RegExp = /(\/|\\|\||\*|\[|\]|\{|\})/g,
        regEnd: RegExp = new RegExp(`\\s*${config.terminator.replace(regEsc, sanitize)}$`),
        regIgnore: RegExp = new RegExp(
          `^(${config.opening.replace(regEsc, sanitize)}\\s*parse-ignore-start)`
        ),
        regStart: RegExp = new RegExp(`(${config.opening.replace(regEsc, sanitize)}\\s*)`),
        wrap: number = options.wrap,
        emptyLines = function parse_wrapCommentBlock_emptyLines() {
          if (/^\s+$/.test(lines[b + 1]) === true || lines[b + 1] === "") {
            do {
              b = b + 1;
            } while (b < len && (/^\s+$/.test(lines[b + 1]) === true || lines[b + 1] === ""));
          }
          if (b < len - 1) {
            second.push("");
          }
        };
      do {
        build.push(config.chars[a]);
        if (config.chars[a] === "\n") {
          parse.lineNumber = parse.lineNumber + 1;
        }
        if (
          config.chars[a] === term &&
          config.chars.slice(a - terml, a + 1).join("") === config.terminator
        ) {
          break;
        }
        a = a + 1;
      } while (a < config.end);
      output = build.join("");
      if (regIgnore.test(output) === true) {
        let termination: string = "\n";
        a = a + 1;
        do {
          build.push(config.chars[a]);
          a = a + 1;
        } while (
          a < config.end &&
          (config.chars[a - 1] !== "d" ||
            (config.chars[a - 1] === "d" &&
              build.slice(build.length - 16).join("") !== "parse-ignore-end"))
        );
        b = a;
        terml = config.opening.length - 1;
        term = config.opening.charAt(terml);
        do {
          if (
            config.opening === "/*" &&
            config.chars[b - 1] === "/" &&
            (config.chars[b] === "*" || config.chars[b] === "/")
          ) {
            break; // for script
          }
          if (
            config.opening !== "/*" &&
            config.chars[b] === term &&
            config.chars.slice(b - terml, b + 1).join("") === config.opening
          ) {
            break; // for markup
          }
          b = b - 1;
        } while (b > config.start);
        if (config.opening === "/*" && config.chars[b] === "*") {
          termination = "\u002a/";
        } else if (config.opening !== "/*") {
          termination = config.terminator;
        }
        terml = termination.length - 1;
        term = termination.charAt(terml);
        if (termination !== "\n" || config.chars[a] !== "\n") {
          do {
            build.push(config.chars[a]);
            if (termination === "\n" && config.chars[a + 1] === "\n") {
              break;
            }
            if (
              config.chars[a] === term &&
              config.chars.slice(a - terml, a + 1).join("") === termination
            ) {
              break;
            }
            a = a + 1;
          } while (a < config.end);
        }
        if (config.chars[a] === "\n") {
          a = a - 1;
        }
        output = build.join("").replace(/\s+$/, "");
        return [output, a];
      }
      if (
        a === config.end ||
        wrap < 1 ||
        (output.length <= wrap && output.indexOf("\n") < 0) ||
        options.preserve_comment === true ||
        (config.opening === "/*" &&
          output.indexOf("\n") > 0 &&
          output.replace("\n", "").indexOf("\n") > 0 &&
          /\n(?!(\s*\*))/.test(output) === false)
      ) {
        return [output, a];
      }
      b = config.start;
      if (b > 0 && config.chars[b - 1] !== "\n" && /\s/.test(config.chars[b - 1]) === true) {
        do {
          b = b - 1;
        } while (b > 0 && config.chars[b - 1] !== "\n" && /\s/.test(config.chars[b - 1]) === true);
      }
      space = config.chars.slice(b, config.start).join("");
      spaceLine = new RegExp(`\n${space}`, "g");
      lines = output.replace(/\r\n/g, "\n").replace(spaceLine, "\n").split("\n");
      len = lines.length;
      lines[0] = lines[0].replace(regStart, "");
      lines[len - 1] = lines[len - 1].replace(regEnd, "");
      if (len < 2) {
        lines = lines[0].split(" ");
      }
      if (lines[0] === "") {
        lines[0] = config.opening;
      } else {
        lines.splice(0, 0, config.opening);
      }
      len = lines.length;
      b = 0;
      do {
        bline = b < len - 1 ? lines[b + 1].replace(/^\s+/, "") : "";
        if (/^\s+$/.test(lines[b]) === true || lines[b] === "") {
          emptyLines();
        } else if (lines[b].slice(0, 4) === "    ") {
          second.push(lines[b]);
        } else if (
          lines[b].replace(/^\s+/, "").length > wrap &&
          lines[b].replace(/^\s+/, "").indexOf(" ") > wrap
        ) {
          lines[b] = lines[b].replace(/^\s+/, "");
          c = lines[b].indexOf(" ");
          second.push(lines[b].slice(0, c));
          lines[b] = lines[b].slice(c + 1);
          b = b - 1;
        } else {
          if (config.opening === "/*" && lines[b].indexOf("/*") !== 0) {
            lines[b] = `   ${lines[b]
              .replace(/^\s+/, "")
              .replace(/\s+$/, "")
              .replace(/\s+/g, " ")}`;
          } else {
            lines[b] = `${lines[b].replace(/^\s+/, "").replace(/\s+$/, "").replace(/\s+/g, " ")}`;
          }
          twrap = b < 1 ? wrap - (config.opening.length + 1) : wrap;
          c = lines[b].length;
          d = lines[b].replace(/^\s+/, "").indexOf(" ");
          if (c > twrap && d > 0 && d < twrap) {
            c = twrap;
            do {
              c = c - 1;
              if (/\s/.test(lines[b].charAt(c)) === true && c <= wrap) {
                break;
              }
            } while (c > 0);
            if (
              lines[b].slice(0, 4) !== "    " &&
              /^\s*(\*|-)\s/.test(lines[b]) === true &&
              /^\s*(\*|-)\s/.test(lines[b + 1]) === false
            ) {
              lines.splice(b + 1, 0, "* ");
            }
            if (
              lines[b].slice(0, 4) !== "    " &&
              /^\s*\d+\.\s/.test(lines[b]) === true &&
              /^\s*\d+\.\s/.test(lines[b + 1]) === false
            ) {
              lines.splice(b + 1, 0, "1. ");
            }
            if (c < 4) {
              second.push(lines[b]);
              bigLine = true;
            } else if (b === len - 1) {
              second.push(lines[b].slice(0, c));
              lines[b] = lines[b].slice(c + 1);
              bigLine = true;
              b = b - 1;
            } else if (/^\s+$/.test(lines[b + 1]) === true || lines[b + 1] === "") {
              second.push(lines[b].slice(0, c));
              lines[b] = lines[b].slice(c + 1);
              emptyLine = true;
              b = b - 1;
            } else if (
              lines[b + 1].slice(0, 4) !== "    " &&
              /^\s*(\*|-)\s/.test(lines[b + 1]) === true
            ) {
              second.push(lines[b].slice(0, c));
              lines[b] = lines[b].slice(c + 1);
              bulletLine = true;
              b = b - 1;
            } else if (
              lines[b + 1].slice(0, 4) !== "    " &&
              /^\s*\d+\.\s/.test(lines[b + 1]) === true
            ) {
              second.push(lines[b].slice(0, c));
              lines[b] = lines[b].slice(c + 1);
              numberLine = true;
              b = b - 1;
            } else if (lines[b + 1].slice(0, 4) === "    ") {
              second.push(lines[b].slice(0, c));
              lines[b] = lines[b].slice(c + 1);
              bigLine = true;
              b = b - 1;
            } else if (c + bline.length > wrap && bline.indexOf(" ") < 0) {
              second.push(lines[b].slice(0, c));
              lines[b] = lines[b].slice(c + 1);
              bigLine = true;
              b = b - 1;
            } else if (lines[b].replace(/^\s+/, "").indexOf(" ") < wrap) {
              if (lines[b].length > wrap) {
                lines[b + 1] = lines[b].slice(c + 1) + options.lf + lines[b + 1];
              } else {
                lines[b + 1] = `${lines[b].slice(c + 1)} ${lines[b + 1]}`;
              }
            }
            if (
              emptyLine === false &&
              bulletLine === false &&
              numberLine === false &&
              bigLine === false
            ) {
              lines[b] = lines[b].slice(0, c);
            }
          } else if (
            lines[b + 1] !== undefined &&
            ((lines[b].length + bline.indexOf(" ") > wrap && bline.indexOf(" ") > 0) ||
              (lines[b].length + bline.length > wrap && bline.indexOf(" ") < 0))
          ) {
            second.push(lines[b]);
            b = b + 1;
          } else if (
            lines[b + 1] !== undefined &&
            /^\s+$/.test(lines[b + 1]) === false &&
            lines[b + 1] !== "" &&
            lines[b + 1].slice(0, 4) !== "    " &&
            /^\s*(\*|-|(\d+\.))\s/.test(lines[b + 1]) === false
          ) {
            lines[b + 1] = `${lines[b]} ${lines[b + 1]}`;
            emptyLine = true;
          }
          if (bigLine === false && bulletLine === false && numberLine === false) {
            if (emptyLine === true) {
              emptyLine = false;
            } else if (/^\s*(\*|-|(\d+\.))\s*$/.test(lines[b]) === false) {
              if (
                b < len - 1 &&
                lines[b + 1] !== "" &&
                /^\s+$/.test(lines[b]) === false &&
                lines[b + 1].slice(0, 4) !== "    " &&
                /^\s*(\*|-|(\d+\.))\s/.test(lines[b + 1]) === false
              ) {
                lines[b] = `${lines[b]} ${lines[b + 1]}`;
                lines.splice(b + 1, 1);
                len = len - 1;
                b = b - 1;
              } else {
                if (config.opening === "/*" && lines[b].indexOf("/*") !== 0) {
                  second.push(
                    `   ${lines[b].replace(/^\s+/, "").replace(/\s+$/, "").replace(/\s+/g, " ")}`
                  );
                } else {
                  second.push(
                    `${lines[b].replace(/^\s+/, "").replace(/\s+$/, "").replace(/\s+/g, " ")}`
                  );
                }
              }
            }
          }
          bigLine = false;
          bulletLine = false;
          numberLine = false;
        }
        b = b + 1;
      } while (b < len);
      if (second.length > 0) {
        if (second[second.length - 1].length > wrap - (config.terminator.length + 1)) {
          second.push(config.terminator);
        } else {
          second[second.length - 1] = `${second[second.length - 1]} ${config.terminator}`;
        }
        output = second.join(options.lf);
      } else {
        lines[lines.length - 1] = lines[lines.length - 1] + config.terminator;
        output = lines.join(options.lf);
      }
      return [output, a];
    },
    // parsing line comments and simultaneously applying word wrap
    wrapCommentLine: function parse_wrapCommentLine(config: wrapConfig): [string, number] {
      let a: number = config.start,
        b: number = 0,
        output: string = "",
        build: string[] = [];
      const wrap: number = options.wrap,
        recurse = function parse_wrapCommentLine_recurse(): void {
          let line: string = "";
          do {
            b = b + 1;
            if (config.chars[b + 1] === "\n") {
              return;
            }
          } while (b < config.end && /\s/.test(config.chars[b]) === true);
          if (config.chars[b] + config.chars[b + 1] === "//") {
            build = [];
            do {
              build.push(config.chars[b]);
              b = b + 1;
            } while (b < config.end && config.chars[b] !== "\n");
            line = build.join("");
            if (
              /^\/\/ (\*|-|(\d+\.))/.test(line) === false &&
              line.slice(0, 6) !== "//    " &&
              /^\/\/\s*$/.test(line) === false
            ) {
              output = `${output} ${line.replace(/(^\/\/\s*)/, "").replace(/\s+$/, "")}`;
              a = b - 1;
              parse_wrapCommentLine_recurse();
            }
          }
        },
        wordWrap = function parse_wrapCommentLine_wordWrap(): void {
          let c: number = 0,
            d: number = 0;
          const lines: string[] = [],
            record: record =
              parse.count > -1
                ? {
                    begin: parse.structure[parse.structure.length - 1][1],
                    ender: -1,
                    lines: parse.linesSpace,
                    stack: parse.structure[parse.structure.length - 1][0],
                    token: parse.data.token[parse.count],
                    types: "comment",
                  }
                : {
                    begin: -1,
                    ender: -1,
                    lines: parse.linesSpace,
                    stack: "global",
                    token: "",
                    types: "comment",
                  };
          output = output.replace(/\s+/g, " ").replace(/\s+$/, "");
          d = output.length;
          if (wrap > d) {
            return;
          }
          do {
            c = wrap;
            if (output.charAt(c) !== " ") {
              do {
                c = c - 1;
              } while (c > 0 && output.charAt(c) !== " ");
              if (c < 3) {
                c = wrap;
                do {
                  c = c + 1;
                } while (c < d - 1 && output.charAt(c) !== " ");
              }
            }
            lines.push(output.slice(0, c));
            output = `// ${output.slice(c).replace(/^\s+/, "")}`;
            d = output.length;
          } while (wrap < d);
          c = 0;
          d = lines.length;
          do {
            record.token = lines[c];
            parse.push(parse.data, record, "");
            record.lines = 2;
            parse.linesSpace = 2;
            c = c + 1;
          } while (c < d);
        };
      do {
        build.push(config.chars[a]);
        a = a + 1;
      } while (a < config.end && config.chars[a] !== "\n");
      if (a === config.end) {
        // necessary because the wrapping logic expects line termination
        config.chars.push("\n");
      } else {
        a = a - 1;
      }
      output = build.join("").replace(/\s+$/, "");
      if (/^(\/\/\s*parse-ignore\u002dstart)/.test(output) === true) {
        let termination: string = "\n";
        a = a + 1;
        do {
          build.push(config.chars[a]);
          a = a + 1;
        } while (
          a < config.end &&
          (config.chars[a - 1] !== "d" ||
            (config.chars[a - 1] === "d" &&
              build.slice(build.length - 16).join("") !== "parse-ignore-end"))
        );
        b = a;
        do {
          b - b - 1;
        } while (
          b > config.start &&
          config.chars[b - 1] === "/" &&
          (config.chars[b] === "*" || config.chars[b] === "/")
        );
        if (config.chars[b] === "*") {
          termination = "\u002a/";
        }
        if (termination !== "\n" || config.chars[a] !== "\n") {
          do {
            build.push(config.chars[a]);
            if (termination === "\n" && config.chars[a + 1] === "\n") {
              break;
            }
            a = a + 1;
          } while (
            a < config.end &&
            (termination === "\n" ||
              (termination === "\u002a/" &&
                (config.chars[a - 1] !== "*" || config.chars[a] !== "/")))
          );
        }
        if (config.chars[a] === "\n") {
          a = a - 1;
        }
        output = build.join("").replace(/\s+$/, "");
        return [output, a];
      }
      if (output === "//" || output.slice(0, 6) === "//    " || options.preserve_comment === true) {
        return [output, a];
      }
      output = output.replace(/(\/\/\s*)/, "// ");
      if (wrap < 1 || (a === config.end - 1 && parse.data.begin[parse.count] < 1)) {
        return [output, a];
      }
      b = a + 1;
      recurse();
      wordWrap();
      return [output, a];
    },
  };
  const parser = function parse_parser(): any {
      parse.count = -1;
      parse.data = {
        begin: [],
        ender: [],
        lines: [],
        stack: [],
        token: [],
        types: [],
      };
      parse.linesSpace = 0;
      parse.lineNumber = 1;
      parse.structure = [["global", -1]];

      parse.structure.pop = function parse_structure_pop(): [string, number] {
        const len: number = parse.structure.length - 1,
          arr: [string, number] = parse.structure[len];
        if (len > 0) {
          parse.structure.splice(len, 1);
        }
        return arr;
      };
      sparser.parseerror = "";
      // reset references data if sparser is used on multiple files
      parse.references = [[]];
      // This line parses the code using a lexer file
      markupLexer(sparser);
      // restore language and lexer values

      let a: number = 0;
      const data: record[] = [],
        len = parse.count + 1;
      do {
        data.push({
          begin: parse.data.begin[a],
          ender: parse.data.ender[a],
          lines: parse.data.lines[a],
          stack: parse.data.stack[a],
          token: parse.data.token[a],
          types: parse.data.types[a],
        });
        a = a + 1;
      } while (a < len);
      return data;
    },
    sparser: sparser = {
      options: options,
      parse: parse,
      parser: parser,
      parseerror: "",
    };
  return sparser;
}
