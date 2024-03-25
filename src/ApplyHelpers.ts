function ind(i: FormatterState): string {
  const indy: string[] = [i.indentChar],
    size: number = i.indentSize - 1;
  let aa: number = 0;
  while (aa < size) {
    indy.push(i.indentChar);
    aa = aa + 1;
  }
  return indy.join("");
}

export function nl(i: FormatterState, tabs: number): string {
  // i.start new line character plus the correct amount of indentation for the given line
  // of code
  const linesout: string[] = [],
    total: number = Math.min(i.data.lines[i.start + 1] - 1, 2);
  let index = 0;
  if (tabs < 0) tabs = 0;
  do {
    linesout.push(i.lf);
    index = index + 1;
  } while (index < total);
  if (tabs > 0) {
    index = 0;
    do {
      linesout.push(ind(i));
      index = index + 1;
    } while (index < tabs);
  }
  return linesout.join("");
}

function multilineLev(i: FormatterState): number {
  let bb: number = i.start - 1,
    start: boolean = false;
  if (i.level[i.start] > -1 && i.data.types[i.start] === "attribute")
    return i.level[i.start] + 1;
  while (bb > -1) {
    if (i.level[bb] > -1)
      return i.data.types[bb] === "content" && start === false
        ? i.level[bb]
        : i.level[bb] + 1;
    if (i.data.types[bb].indexOf("start") > -1) start = true;
    bb = bb - 1;
  }
  return 1;
}

export function multiline(i: FormatterState): void {
  const lines: string[] = i.data.token[i.start].split(i.lf),
    line: number = i.data.lines[i.start + 1],
    lev: number = multilineLev(i);
  let aa: number,
    len: number = lines.length - 1;
  i.data.lines[i.start + 1] = 0;
  for (aa = 0; aa < len; ++aa) {
    i.build.push(lines[aa].trim());
    i.build.push(nl(i, aa === len - 1 ? lev - 1 : lev));
  }
  i.data.lines[i.start + 1] = line;
  i.build.push(lines[len].trim());
  if (i.level[i.start] === -10) i.build.push(i.indentChar);
  else if (i.level[i.start] > -1) i.build.push(nl(i, i.level[i.start]));
}

export function attributeEnd(i: FormatterState): void {
  const parent: string = i.data.token[i.start],
    regend: RegExp = /(\/|\?)?>$/,
    end: string[] | null = regend.exec(parent);
  let y: number = i.start + 1;
  if (end === null) return;
  let space: string = end[0] === "/>" ? " " : "";
  i.data.token[i.start] = parent.replace(regend, "");
  do {
    if (i.data.begin[y] < i.start || i.data.types[y].indexOf("attribute") < 0) {
      break;
    }
    y = y + 1;
  } while (y < i.end);
  if (i.data.types[y - 1] === "comment_attribute") {
    space = nl(i, i.level[y - 2] - 1);
  }
  i.data.token[y - 1] = i.data.token[y - 1] + space + end[0];
}
