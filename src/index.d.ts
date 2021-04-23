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
  comstart: number;
  next: number;
  count: number;
  indent: number;
  build: string[];
}
