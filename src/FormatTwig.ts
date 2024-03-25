import Parser from "./Parser";
import * as Collect from "./CollectHelpers";
import * as Apply from "./ApplyHelpers";

export default class FormatTwig implements FormatterState {
  // The result of the parse data
  data: ParseData;

  // The line feed character: "\n" on UNIX-like systems
  lf: string;

  // levels sets the white space value between the current token and the next token
  // * -20 value means no white space
  // * -10 means to separate with a space
  // * 0 and above is the number of indentation to insert
  level: number[] = [];

  // Start of the sparser array
  start = 0;

  // End of the sparser array
  end: number;

  // start - 1, excluding comments
  prev = 0;

  // start + 1, excluding comments
  next = 0;

  // Comment start
  comstart = -1;

  // Keeps count of the number of tokens encountered
  count = 0;

  // The amount of overall identation
  indent = 0;

  // The character to use for indentation
  indentChar: string;

  // The number of spaces to insert when indenting (1 if TAB)
  indentSize: number;

  // The final result of the formatting is collected here
  build: string[] = [];

  constructor(options: any) {
    this.lf = options.lf;
    this.data = new Parser(options).runLexer();
    this.end = this.data.token.length;
    this.indentChar = options.indentChar;
    this.indentSize = options.indentSize;
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
      if (i.data.token[i.start].toLowerCase().indexOf("<!doctype") === 0) {
        i.level[i.start - 1] = i.indent;
      }
      if (i.data.types[i.start].indexOf("attribute") > -1) {
        Collect.attribute(i);
      } else if (i.data.types[i.start] === "comment") {
        if (i.comstart < 0) {
          i.comstart = i.start;
        }
        if (
          i.data.types[i.start + 1] !== "comment" ||
          i.data.types[i.start - 1].indexOf("end") > -1
        ) {
          Collect.comment(i);
        }
      } else if (i.data.types[i.start] !== "comment") {
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
          if (
            i.data.token[i.start] === "</ol>" ||
            i.data.token[i.start] === "</ul>"
          ) {
            Collect.anchor(i);
          }
        }
        if (
          i.data.types[i.start] === "content" ||
          i.data.types[i.start] === "singleton" ||
          i.data.types[i.start] === "template"
        ) {
          i.count = i.count + i.data.token[i.start].length;
          if (
            i.data.types[i.start] === "template_start" &&
            i.data.types[Collect.next(i)].indexOf("template") < 0
          ) {
            Collect.content(i);
          } else {
            i.level.push(i.indent);
          }
        } else if (
          i.data.types[i.start] === "start" ||
          i.data.types[i.start] === "template_start"
        ) {
          i.indent += 1;
          if (
            i.data.types[i.start] === "template_start" &&
            i.data.types[Collect.next(i)] === "template_else"
          ) {
            i.indent += 1;
          }
          if (
            i.data.types[i.start] === "start" &&
            i.data.types[Collect.next(i)] === "end"
          ) {
            i.level.push(-20);
          } else if (
            i.data.types[i.start] === "template_start" &&
            i.data.types[Collect.next(i)] === "template_end"
          ) {
            i.level.push(-20);
          } else {
            i.level.push(i.indent);
          }
        } else if (i.data.types[i.start] === "template_else") {
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
        i.data.types[i.start] !== "content" &&
        i.data.types[i.start] !== "singleton" &&
        i.data.types[i.start] !== "template" &&
        i.data.types[i.start] !== "attribute"
      ) {
        i.count = 0;
      }
      i.start += 1;
    } while (i.start < i.end);
  }

  applyMarkupLevels(): void {
    const i = this;
    i.start = 0;
    do {
      if (
        (i.data.types[i.start] === "start" ||
          i.data.types[i.start] === "singleton" ||
          i.data.types[i.start] === "xml" ||
          i.data.types[i.start] === "sgml") &&
        i.data.types[i.start + 1] !== undefined &&
        i.data.types[i.start].indexOf("attribute") < 0 &&
        i.start < i.end - 1 &&
        i.data.types[i.start + 1].indexOf("attribute") > -1
      ) {
        Apply.attributeEnd(i);
      }
      if (
        i.data.token[i.start].indexOf(i.lf) > 0 &&
        (i.data.types[i.start] === "content" ||
          i.data.types[i.start] === "comment" ||
          i.data.types[i.start] === "attribute")
      ) {
        Apply.multiline(i);
      } else {
        i.build.push(i.data.token[i.start]);
        if (i.level[i.start] === -10 && i.start < i.end - 1) {
          i.build.push(i.indentChar);
        } else if (i.level[i.start] > -1) {
          i.build.push(Apply.nl(i, i.level[i.start]));
        }
      }
      i.start += 1;
    } while (i.start < i.end);
    if (i.build[0] === i.lf || i.build[0] === " ") {
      i.build[0] = "";
    }
  }
}
