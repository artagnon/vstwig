function applyInd(i: FormatterState): string {
  const indy: string[] = [i.options.indentChar],
    size: number = i.options.indentSize - 1;
  let aa: number = 0;
  if (aa < size) {
    do {
      indy.push(i.options.indentChar);
      aa = aa + 1;
    } while (aa < size);
  }
  return indy.join("");
}

export function applyNl(i: FormatterState, tabs: number): string {
  // i.a new line character plus the correct amount of identation for the given line
  // of code
  const linesout: string[] = [],
    pres: number = i.options.preserve + 1,
    total: number = Math.min(i.data.lines[i.a + 1] - 1, pres);
  let index = 0;
  if (tabs < 0) {
    tabs = 0;
  }
  do {
    linesout.push(i.lf);
    index = index + 1;
  } while (index < total);
  if (tabs > 0) {
    index = 0;
    do {
      linesout.push(applyInd(i));
      index = index + 1;
    } while (index < tabs);
  }
  return linesout.join("");
}

function applyMultilineLev(i: FormatterState): number {
  let bb: number = i.a - 1,
    start: boolean = bb > -1 && i.data.types[bb].indexOf("start") > -1;
  if (i.level[i.a] > -1 && i.data.types[i.a] === "attribute") {
    return i.level[i.a] + 1;
  }
  do {
    bb = bb - 1;
    if (i.level[bb] > -1) {
      if (i.data.types[i.a] === "content" && start === false) {
        return i.level[bb];
      }
      return i.level[bb] + 1;
    }
    if (i.data.types[bb].indexOf("start") > -1) {
      start = true;
    }
  } while (bb > 0);
  return 1;
}

export function applyMultiline(i: FormatterState): void {
  const lines: string[] = i.data.token[i.a].split(i.lf),
    line: number = i.data.lines[i.a + 1],
    lev: number =
      i.level[i.a - 1] > -1
        ? i.data.types[i.a] === "attribute"
          ? i.level[i.a - 1] + 1
          : i.level[i.a - 1]
        : applyMultilineLev(i);
  let aa: number = 0,
    len: number = lines.length - 1;
  i.data.lines[i.a + 1] = 0;
  do {
    i.build.push(lines[aa]);
    i.build.push(applyNl(i, lev));
    aa = aa + 1;
  } while (aa < len);
  i.data.lines[i.a + 1] = line;
  i.build.push(lines[len]);
  if (i.level[i.a] === -10) {
    i.build.push(" ");
  } else if (i.level[i.a] > -1) {
    i.build.push(applyNl(i, i.level[i.a]));
  }
}

export function applyAttributeEnd(i: FormatterState): void {
  const parent: string = i.data.token[i.a],
    regend: RegExp = /(\/|\?)?>$/,
    end: string[] | null = regend.exec(parent);
  let y: number = i.a + 1,
    space: string = i.options.spaceClose === true && end !== null && end[0] === "/>" ? " " : "";
  if (end === null) {
    return;
  }
  i.data.token[i.a] = parent.replace(regend, "");
  do {
    if (i.data.begin[y] < i.a || i.data.types[y].indexOf("attribute") < 0) {
      break;
    }
    y = y + 1;
  } while (y < i.c);
  if (i.data.types[y - 1] === "comment_attribute") {
    space = applyNl(i, i.level[y - 2] - 1);
  }
  i.data.token[y - 1] = i.data.token[y - 1] + space + end[0];
}
