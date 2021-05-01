interface attStore extends Array<[string, number]> {
  [index: number]: [string, number];
}
interface markupCount {
  end: number;
  index: number;
  start: number;
}

interface wrapConfig {
  chars: string[];
  end: number;
  opening: string;
  start: number;
  terminator: string;
}

interface spacer {
  array: string[];
  end: number;
  index: number;
}

interface parse {
  concat(data: data, array: data): void;
  count: number;
  data: data;
  lineNumber: number;
  linesSpace: number;
  objectSort(data: data): void;
  pop(data: data): record;
  push(data: data, record: record, structure: string): void;
  references: string[][];
  safeSort(array: any[], operation: string, recursive: boolean): any[];
  spacer(args: spacer): number;
  splice(spliceData: splice): void;
  structure: Array<[string, number]>;
  wrapCommentBlock(config: wrapConfig): [string, number];
  wrapCommentLine(config: wrapConfig): [string, number];
}

interface splice {
  data: data;
  howmany: number;
  index: number;
  record?: record;
}

interface LexerData {
  options: any;
  parse: parse;
  parseerror: string;
}
interface data {
  begin: number[];
  ender: number[];
  lines: number[];
  stack: string[];
  token: string[];
  types: string[];
}

interface record {
  begin: number;
  ender: number;
  lines: number;
  stack: string;
  token: string;
  types: string;
}

interface FormatterOptions {
  source: string;
  beautify: object;
  end: number;
  iterator: number;
  start: number;
  lf: string;
  force_indent: boolean;
  force_attribute: boolean;
  wrap: number;
  preserve_text: boolean;
  preserve_comment: boolean;
  unformatted: boolean;
  space_close: boolean;
  indent_char: string;
  indent_size: number;
  preserve: number;
  correct: boolean;
  indent_level: number;
}
interface FormatterState {
  options: any;
  data: data;
  lf: string;
  level: number[];
  a: number;
  c: number;
  prev: number;
  next: number;
  comstart: number;
  count: number;
  indent: number;
  build: string[];
}
