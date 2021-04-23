interface scriptScopes extends Array<[string, number]> {
  [index: number]: [string, number];
}
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
