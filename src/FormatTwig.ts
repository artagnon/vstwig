import Parser from "./Parser";
import * as Collect from "./CollectHelpers";
import * as Apply from "./ApplyHelpers";

export default class FormatTwig implements FormatterState {
  // The options passed to the parser
  options: any;

  // The result of the parse data
  data: data;

  // The line feed character: "\n" on UNIX-like systems
  lf: string;

  // levels sets the white space value between the current token and the next token
  // * -20 value means no white space
  // * -10 means to separate with a space
  // * 0 and above is the number of indentation to insert
  level: number[];

  // Start of the sparser array
  a: number;

  // End of the sparser array
  c: number;

  // a - 1, excluding comments
  prev: number;

  // a + 1, excluding comments
  next: number;

  // Comment start; initialized to -1
  comstart: number;

  // Keeps count of the number of tokens encountered
  count: number;

  // Initialized to options.indentLevel: the amount of overall identation
  indent: number;

  // The final result of the formatting is collected here
  build: string[] = [];

  constructor(options: any) {
    this.options = options;
    this.lf = options.lf;
    this.data = new Parser(options).runLexer();
    this.level = [];
    this.a = 0;
    this.c = this.data.token.length;
    this.comstart = -1;
    this.prev = 0;
    this.next = 0;
    this.count = 0;
    this.indent = options.indentLevel;
  }

  public formatDocument(): string {
    this.collectLevels();
    this.applyMarkupLevels();
    return this.build.join("");
  }

  collectLevels(): void {
    const i = this;
    // i.data.lines -> space before token
    // i.level -> space after token
    do {
      if (i.data.token[i.a].toLowerCase().indexOf("<!doctype") === 0) {
        i.level[i.a - 1] = i.indent;
      }
      if (i.data.types[i.a].indexOf("attribute") > -1) {
        Collect.attribute(i);
      } else if (i.data.types[i.a] === "comment") {
        if (i.comstart < 0) {
          i.comstart = i.a;
        }
        if (i.data.types[i.a + 1] !== "comment" || i.data.types[i.a - 1].indexOf("end") > -1) {
          Collect.comment(i);
        }
      } else if (i.data.types[i.a] !== "comment") {
        if (
          i.data.types[Collect.next(i)] === "end" ||
          i.data.types[Collect.next(i)] === "template_end"
        ) {
          i.indent -= 1;
          if (
            i.data.types[Collect.next(i)] === "template_end" &&
            i.data.types[i.data.begin[Collect.next(i)] + 1] === "template_else"
          ) {
            i.indent -= 1;
          }
          if (i.data.token[i.a] === "</ol>" || i.data.token[i.a] === "</ul>") {
            Collect.anchor(i);
          }
        }
        if (
          i.options.forceIndent === false &&
          (i.data.types[i.a] === "content" ||
            i.data.types[i.a] === "singleton" ||
            i.data.types[i.a] === "template")
        ) {
          i.count = i.count + i.data.token[i.a].length;
          if (
            i.data.types[i.a] === "template_start" &&
            i.data.types[Collect.next(i)].indexOf("template") < 0
          ) {
            Collect.content(i);
          } else {
            i.level.push(i.indent);
          }
        } else if (i.data.types[i.a] === "start" || i.data.types[i.a] === "template_start") {
          i.indent += 1;
          if (
            i.data.types[i.a] === "template_start" &&
            i.data.types[Collect.next(i)] === "template_else"
          ) {
            i.indent += 1;
          }
          if (i.data.types[i.a] === "start" && i.data.types[Collect.next(i)] === "end") {
            i.level.push(-20);
          } else if (i.options.forceIndent === true) {
            i.level.push(i.indent);
          } else if (
            i.data.types[i.a] === "template_start" &&
            i.data.types[Collect.next(i)] === "template_end"
          ) {
            i.level.push(-20);
          } else {
            i.level.push(i.indent);
          }
        } else if (i.data.types[i.a] === "template_else") {
          if (i.data.types[Collect.next(i)] === "template_end") {
            i.level[Collect.prev(i)] = i.indent + 1;
          } else {
            i.level[Collect.prev(i)] = i.indent - 1;
          }
          i.level.push(i.indent);
        } else {
          i.level.push(i.indent);
        }
      }
      if (
        i.data.types[i.a] !== "content" &&
        i.data.types[i.a] !== "singleton" &&
        i.data.types[i.a] !== "template" &&
        i.data.types[i.a] !== "attribute"
      ) {
        i.count = 0;
      }
      i.a += 1;
    } while (i.a < i.c);
  }

  applyMarkupLevels(): void {
    const i = this;
    this.a = this.options.start;
    do {
      if (
        (i.data.types[i.a] === "start" ||
          i.data.types[i.a] === "singleton" ||
          i.data.types[i.a] === "xml" ||
          i.data.types[i.a] === "sgml") &&
        i.data.types[i.a + 1] !== undefined &&
        i.data.types[i.a].indexOf("attribute") < 0 &&
        i.a < i.c - 1 &&
        i.data.types[i.a + 1].indexOf("attribute") > -1
      ) {
        Apply.attributeEnd(i);
      }
      if (
        i.data.token[i.a].indexOf(i.lf) > 0 &&
        ((i.data.types[i.a] === "content" && i.options.preserveText === false) ||
          i.data.types[i.a] === "comment" ||
          i.data.types[i.a] === "attribute")
      ) {
        Apply.multiline(i);
      } else {
        i.build.push(i.data.token[i.a]);
        if (i.level[i.a] === -10 && i.a < i.c - 1) {
          i.build.push(" ");
        } else if (i.level[i.a] > -1) {
          i.build.push(Apply.nl(i, i.level[i.a]));
        }
      }
      i.a += 1;
    } while (i.a < i.c);
    i.options.iterator = i.c - 1;
    if (i.build[0] === i.lf || i.build[0] === " ") {
      i.build[0] = "";
    }
  }
}
