import { initParser } from "./Parser";
import { applyAttributeEnd, applyMultiline, applyNl } from "./applyHelpers";
import {
  nextIndex,
  handleAnchor,
  handleAttribute,
  handleComment,
  handleContent,
  prevIndex,
} from "./collectHelpers";

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

  // Initialized to options.indent_level: the amount of overall identation
  indent: number;

  // The final result of the formatting is collected here
  build: string[] = [];

  constructor(options: any) {
    const sparser = initParser(options);
    this.options = options;
    this.lf = options.lf;
    this.data = sparser.parser();
    this.level = [];
    this.a = 0;
    this.c = this.data.token.length;
    this.comstart = -1;
    this.prev = 0;
    this.next = 0;
    this.count = 0;
    this.indent = options.indent_level;
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
        handleAttribute(i);
      } else if (i.data.types[i.a] === "comment") {
        if (i.comstart < 0) {
          i.comstart = i.a;
        }
        if (i.data.types[i.a + 1] !== "comment" || i.data.types[i.a - 1].indexOf("end") > -1) {
          handleComment(i);
        }
      } else if (i.data.types[i.a] !== "comment") {
        i.next = nextIndex(i);
        i.prev = prevIndex(i);
        if (i.data.types[i.next] === "end" || i.data.types[i.next] === "template_end") {
          i.indent -= 1;
          if (
            i.data.types[i.next] === "template_end" &&
            i.data.types[i.data.begin[i.next] + 1] === "template_else"
          ) {
            i.indent -= 1;
          }
          if (i.data.token[i.a] === "</ol>" || i.data.token[i.a] === "</ul>") {
            handleAnchor(i);
          }
        }
        if (
          (i.options.force_indent === false ||
            (i.options.force_indent === true && i.data.types[i.next] === "script_start")) &&
          (i.data.types[i.a] === "content" ||
            i.data.types[i.a] === "singleton" ||
            i.data.types[i.a] === "template")
        ) {
          i.count = i.count + i.data.token[i.a].length;
          if (i.data.types[i.next] === "script_start") {
            i.level.push(-10);
          } else if (
            i.data.types[i.a] === "template_start" &&
            i.data.types[i.next].indexOf("template") < 0
          ) {
            handleContent(i);
          } else {
            i.level.push(i.indent);
          }
        } else if (i.data.types[i.a] === "start" || i.data.types[i.a] === "template_start") {
          i.indent += 1;
          if (i.data.types[i.a] === "template_start" && i.data.types[i.next] === "template_else") {
            i.indent += 1;
          }
          if (i.data.types[i.a] === "start" && i.data.types[i.next] === "end") {
            i.level.push(-20);
          } else if (i.options.force_indent === true) {
            i.level.push(i.indent);
          } else if (
            i.data.types[i.a] === "template_start" &&
            i.data.types[i.next] === "template_end"
          ) {
            i.level.push(-20);
          } else if (
            i.data.types[i.next] === "content" ||
            i.data.types[i.next] === "singleton" ||
            (i.data.types[i.a] === "start" && i.data.types[i.next] === "template")
          ) {
            i.level.push(-20);
          } else {
            i.level.push(i.indent);
          }
        } else if (
          i.options.force_indent === false &&
          (i.data.types[i.next] === "content" || i.data.types[i.next] === "singleton")
        ) {
          i.level.push(-20);
        } else if (i.data.types[i.a] === "template_else") {
          if (i.data.types[i.next] === "template_end") {
            i.level[i.prev] = i.indent + 1;
          } else {
            i.level[i.prev] = i.indent - 1;
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
    let lastLevel: number = i.options.indent_level;
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
        applyAttributeEnd(i);
      }
      if (
        i.data.token[i.a].indexOf(i.lf) > 0 &&
        ((i.data.types[i.a] === "content" && i.options.preserve_text === false) ||
          i.data.types[i.a] === "comment" ||
          i.data.types[i.a] === "attribute")
      ) {
        applyMultiline(i);
      } else {
        i.build.push(i.data.token[i.a]);
        if (i.level[i.a] === -10 && i.a < i.c - 1) {
          i.build.push(" ");
        } else if (i.level[i.a] > -1) {
          lastLevel = i.level[i.a];
          i.build.push(applyNl(i, i.level[i.a]));
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
