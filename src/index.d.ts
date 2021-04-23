interface externalIndex {
  [key: string]: number;
}
interface parseResult {
  begin: number[];
  ender: number[];
  lexer: string[];
  lines: number[];
  stack: string[];
  token: string[];
  types: string[];
}

interface ParserInterface {
  options: any;
  data: data;
  c: number;
  lexer: string;
  lf: string;
  externalIndex: externalIndex;
  level: number[];
  a: number;
  comstart: number;
  next: number;
  count: number;
  indent: number;
  build: string[];
}
