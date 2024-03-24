interface AttStore extends Array<[string, number]> {
  [index: number]: [string, number];
}
interface MarkupCount {
  end: number;
  index: number;
  start: number;
}

interface WrapConfig {
  chars: string[];
  end: number;
  opening: string;
  start: number;
  terminator: string;
}

interface Spacer {
  chars: string[];
  end: number;
  index: number;
}

interface Parse {
  concat(ParseData: ParseData, array: ParseData): void;
  count: number;
  data: ParseData;
  lineNumber: number;
  linesSpace: number;
  objectSort(ParseData: ParseData): void;
  pop(data: ParseData): DataRecord;
  push(data: ParseData, record: DataRecord, structure: string): void;
  references: string[][];
  safeSort(array: any[], operation: string, recursive: boolean): any[];
  spacer(args: Spacer): number;
  splice(spliceData: Splice): void;
  structure: Array<[string, number]>;
  wrapCommentBlock(config: WrapConfig): [string, number];
  wrapCommentLine(config: WrapConfig): [string, number];
}

interface Splice {
  data: ParseData;
  howmany: number;
  index: number;
  record?: DataRecord;
}

interface ParseData {
  begin: number[];
  ender: number[];
  lines: number[];
  stack: string[];
  token: string[];
  types: string[];
}

interface DataRecord {
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
  forceIndent: boolean;
  forceAttribute: boolean;
  wrap: number;
  preserveText: boolean;
  preserveComment: boolean;
  unformatted: boolean;
  spaceClose: boolean;
  indentChar: string;
  indentSize: number;
  preserve: number;
  correct: boolean;
  indentLevel: number;
}

interface FormatterState {
  options: FormatterOptions;
  data: ParseData;
  lf: string;
  level: number[];
  start: number;
  end: number;
  prev: number;
  next: number;
  comstart: number;
  count: number;
  indent: number;
  build: string[];
}

interface LexState {
  start: number;
  chars: string[];
  end: number;
  parse: Parse;
  sgmlflag: number;
  html: "html" | "xml" | "";
  parseerror: string;
  count: MarkupCount;
  options: FormatterOptions;
  htmlblocks: any;
}
