import { applyAttributeEnd, applyMultiline, applyNl } from "./applyHelpers";
import {
  nextIdx,
  handleAnchor,
  handleAttribute,
  handleComment,
  handleContent,
  handleExternal,
} from "./collectHelpers";

export default class FormatTwig implements ParserInterface {
  options: any;
  data: data;
  c: number;
  lexer: string = "markup";
  lf: string = "\n";
  externalIndex: externalIndex = {};
  level: number[];
  a: number;
  comstart: number;
  next: number;
  count: number;
  indent: number;
  build: string[] = [];

  constructor(options: any) {
    this.options = options;
    this.data = options.parsed;
    this.c =
      options.end < 1 || options.end > this.data.token.length
        ? this.data.token.length
        : options.end + 1;
    this.level =
      this.options.start > 0 ? Array(this.options.start).fill(0, 0, this.options.start) : [];
    this.a = options.start;
    this.comstart = -1;
    this.next = 0;
    this.count = 0;
    this.indent = isNaN(options.indent_level) === true ? 0 : Number(options.indent_level);
  }

  public formatDocument(): string {
    this.collectLevels();
    this.applyLevels();
    return this.build.join("");
  }

  collectLevels(): void {
    const i = this;
    // i.data.lines -> space before token
    // i.level -> space after token
    do {
      if (i.data.lexer[i.a] === i.lexer) {
        if (i.data.token[i.a].toLowerCase().indexOf("<!doctype") === 0) {
          i.level[i.a - 1] = i.indent;
        }
        if (i.data.types[i.a].indexOf("attribute") > -1) {
          handleAttribute(i);
        } else if (i.data.types[i.a] === "comment") {
          if (i.comstart < 0) {
            i.comstart = i.a;
          }
          if (
            i.data.types[i.a + 1] !== "comment" ||
            (i.a > 0 && i.data.types[i.a - 1].indexOf("end") > -1)
          ) {
            handleComment(i);
          }
        } else if (i.data.types[i.a] !== "comment") {
          i.next = nextIdx(i);
          if (i.data.types[i.next] === "end" || i.data.types[i.next] === "template_end") {
            i.indent = i.indent - 1;
            if (
              i.data.types[i.next] === "template_end" &&
              i.data.types[i.data.begin[i.next] + 1] === "template_else"
            ) {
              i.indent = i.indent - 1;
            }
            if (i.data.token[i.a] === "</ol>" || i.data.token[i.a] === "</ul>") {
              handleAnchor(i);
            }
          }
          if (i.data.types[i.a] === "script_end" && i.data.types[i.a + 1] === "end") {
            if (i.data.lines[i.a + 1] < 1) {
              i.level.push(-20);
            } else {
              i.level.push(-10);
            }
          } else if (
            (i.options.force_indent === false ||
              (i.options.force_indent === true && i.data.types[i.next] === "script_start")) &&
            (i.data.types[i.a] === "content" ||
              i.data.types[i.a] === "singleton" ||
              i.data.types[i.a] === "template")
          ) {
            i.count = i.count + i.data.token[i.a].length;
            if (i.data.lines[i.next] > 0 && i.data.types[i.next] === "script_start") {
              i.level.push(-10);
            } else if (
              i.options.wrap > 0 &&
              (i.data.types[i.a].indexOf("template") < 0 ||
                (i.next < i.c &&
                  i.data.types[i.a].indexOf("template") > -1 &&
                  i.data.types[i.next].indexOf("template") < 0))
            ) {
              handleContent(i);
            } else if (
              i.next < i.c &&
              (i.data.types[i.next].indexOf("end") > -1 ||
                i.data.types[i.next].indexOf("start") > -1) &&
              (i.data.lines[i.next] > 0 || i.data.types[i.next].indexOf("template_") > -1)
            ) {
              i.level.push(i.indent);
            } else if (i.data.lines[i.next] === 0) {
              i.level.push(-20);
            } else {
              i.level.push(i.indent);
            }
          } else if (i.data.types[i.a] === "start" || i.data.types[i.a] === "template_start") {
            i.indent = i.indent + 1;
            if (
              i.data.types[i.a] === "template_start" &&
              i.data.types[i.a + 1] === "template_else"
            ) {
              i.indent = i.indent + 1;
            }
            if (i.data.types[i.a] === "start" && i.data.types[i.next] === "end") {
              i.level.push(-20);
            } else if (i.data.types[i.a] === "start" && i.data.types[i.next] === "script_start") {
              i.level.push(-10);
            } else if (i.options.force_indent === true) {
              i.level.push(i.indent);
            } else if (
              i.data.types[i.a] === "template_start" &&
              i.data.types[i.next] === "template_end"
            ) {
              i.level.push(-20);
            } else if (
              i.data.lines[i.next] === 0 &&
              (i.data.types[i.next] === "content" ||
                i.data.types[i.next] === "singleton" ||
                (i.data.types[i.a] === "start" && i.data.types[i.next] === "template"))
            ) {
              i.level.push(-20);
            } else {
              i.level.push(i.indent);
            }
          } else if (
            i.options.force_indent === false &&
            i.data.lines[i.next] === 0 &&
            (i.data.types[i.next] === "content" || i.data.types[i.next] === "singleton")
          ) {
            i.level.push(-20);
          } else if (i.data.types[i.a + 2] === "script_end") {
            i.level.push(-20);
          } else if (i.data.types[i.a] === "template_else") {
            if (i.data.types[i.next] === "template_end") {
              i.level[i.a - 1] = i.indent + 1;
            } else {
              i.level[i.a - 1] = i.indent - 1;
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
      } else {
        i.count = 0;
        handleExternal(i);
      }
      i.a = i.a + 1;
    } while (i.a < i.c);
  }

  applyLevels(): void {
    const i = this;
    this.a = this.options.start;
    let external: string = "";
    let lastLevel: number = i.options.indent_level;
    do {
      if (i.data.lexer[i.a] === i.lexer || i.options.beautify[i.data.lexer[i.a]] === undefined) {
        if (
          (i.data.types[i.a] === "start" ||
            i.data.types[i.a] === "singleton" ||
            i.data.types[i.a] === "xml" ||
            i.data.types[i.a] === "sgml") &&
          i.data.types[i.a].indexOf("attribute") < 0 &&
          i.a < i.c - 1 &&
          i.data.types[i.a + 1] !== undefined &&
          i.data.types[i.a + 1].indexOf("attribute") > -1
        ) {
          applyAttributeEnd(i);
        }
        if (
          i.data.token[i.a] !== undefined &&
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
      } else {
        if (i.externalIndex[i.a] === i.a && i.data.types[i.a] !== "reference") {
          i.build.push(i.data.token[i.a]);
        } else {
          i.options.end = i.externalIndex[i.a];
          i.options.indent_level = lastLevel;
          i.options.start = i.a;
          external = i.options.beautify[i.data.lexer[i.a]](i.options).replace(/\s+$/, "");
          i.build.push(external);
          if (i.level[i.options.iterator] > -1 && i.externalIndex[i.a] > i.a) {
            i.build.push(applyNl(i, i.level[i.options.iterator]));
          }
          i.a = i.options.iterator;
        }
      }
      i.a = i.a + 1;
    } while (i.a < i.c);
    i.options.iterator = i.c - 1;
    if (i.build[0] === i.lf || i.build[0] === " ") {
      i.build[0] = "";
    }
  }
}
