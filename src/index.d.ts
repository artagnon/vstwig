interface ExternalIndex {
  [key: string]: number;
}

interface ParserState {
  options: any;
  data: data;
  lexer: string;
  lf: string;
  externalIndex: ExternalIndex;
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
