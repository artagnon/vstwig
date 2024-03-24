export function next(i: FormatterState): number {
  let x;
  for (x = i.start + 1; x < i.end; x += 1) {
    if (
      i.data.types[x] !== "comment" &&
      i.data.types[x].indexOf("attribute") < 0
    ) {
      break;
    }
  }
  return x;
}

export function prev(i: FormatterState): number {
  let x;
  for (x = i.start - 1; x > 0; x -= 1) {
    if (
      i.data.types[x] !== "comment" &&
      i.data.types[x].indexOf("attribute") < 0
    ) {
      break;
    }
  }
  return x;
}

export function anchor(i: FormatterState): void {
  let aa: number = i.start;
  const stop: number = i.data.begin[i.start];
  // Verify list is only start link list before making changes
  do {
    aa = aa - 1;
    if (
      i.data.token[aa] === "</li>" &&
      i.data.begin[i.data.begin[aa]] === stop &&
      i.data.token[aa - 1] === "</start>" &&
      i.data.begin[aa - 1] === i.data.begin[aa] + 1
    ) {
      aa = i.data.begin[aa];
    } else {
      return;
    }
  } while (aa > stop + 1);

  // now make the changes
  aa = i.start;
  do {
    aa = aa - 1;
    if (i.data.types[aa + 1].indexOf("attribute") > -1) {
      i.level[aa] = -10;
    } else if (i.data.token[aa] !== "</li>") {
      i.level[aa] = -20;
    }
  } while (aa > stop + 1);
}

export function comment(i: FormatterState): void {
  let x: number = i.start,
    test: boolean = false;
  if (i.data.lines[i.start + 1] === 0) {
    do {
      if (i.data.lines[x] > 0) {
        test = true;
        break;
      }
      x = x - 1;
    } while (x > i.comstart);
    x = i.start;
  } else {
    test = true;
  }

  // the first condition applies indentation while the else block does not
  if (test === true) {
    let ind =
      i.data.types[i.next] === "end" || i.data.types[i.next] === "template_end"
        ? i.indent + 1
        : i.indent;
    do {
      i.level.push(ind);
      x = x - 1;
    } while (x > i.comstart);

    // correction so that start following end tag is not indented 1 too much
    if (ind === i.indent + 1) {
      i.level[i.start] = i.indent;
    }
  } else {
    do {
      i.level.push(-20);
      x = x - 1;
    } while (x > i.comstart);
    i.level[x] = -20;
  }
  i.comstart = -1;
}

export function content(i: FormatterState): void {
  let ind: number = i.indent;
  if (
    i.next < i.end &&
    (i.data.types[i.next].indexOf("end") > -1 ||
      i.data.types[i.next].indexOf("start") > -1) &&
    i.data.lines[i.next] > 0
  ) {
    i.level.push(i.indent);
    ind = ind + 1;
    if (
      i.data.types[i.start] === "singleton" &&
      i.start > 0 &&
      i.data.types[i.start - 1].indexOf("attribute") > -1 &&
      i.data.types[i.data.begin[i.start - 1]] === "singleton"
    ) {
      if (
        i.data.begin[i.start] < 0 ||
        (i.data.types[i.data.begin[i.start - 1]] === "singleton" &&
          i.data.begin[i.data.ender[i.start] - 1] !== i.start)
      ) {
        i.level[i.start - 1] = i.indent;
      } else {
        i.level[i.start - 1] = i.indent + 1;
      }
    }
  } else if (
    i.data.types[i.start] === "singleton" &&
    i.start > 0 &&
    i.data.types[i.start - 1].indexOf("attribute") > -1
  ) {
    i.level[i.start - 1] = i.indent;
    i.count = i.data.token[i.start].length;
    i.level.push(-10);
  } else if (i.data.lines[i.next] === 0) {
    i.level.push(-20);
  } else if (
    // wrap if
    // * i.options.wrap is 0
    // * i.next token is singleton with an attribute and exceeds wrap
    // * i.next token is template or singleton and exceeds wrap
    ((i.start < i.end - 2 &&
      i.data.token[i.start].length +
        i.data.token[i.start + 1].length +
        i.data.token[i.start + 2].length +
        1 >
        0 &&
      i.data.types[i.start + 2].indexOf("attribute") > -1) ||
      i.data.token[i.start].length + i.data.token[i.start + 1].length > 0) &&
    (i.data.types[i.start + 1] === "singleton" ||
      i.data.types[i.start + 1] === "template")
  ) {
    i.level.push(i.indent);
  } else {
    i.count = i.count + 1;
    i.level.push(-10);
  }
  if (
    i.start > 0 &&
    i.data.types[i.start - 1].indexOf("attribute") > -1 &&
    i.data.lines[i.start] < 1
  ) {
    i.level[i.start - 1] = -20;
  }
  if (i.count > 0) {
    let d: number = i.start,
      e: number = Math.max(i.data.begin[i.start], 0);
    if (i.data.types[i.start] === "content") {
      let countx: number = 0,
        chars: string[] = i.data.token[i.start].replace(/\s+/g, " ").split(" ");
      do {
        d = d - 1;
        if (i.level[d] < 0) {
          countx = countx + i.data.token[d].length;
          if (i.level[d] === -10) {
            countx = countx + 1;
          }
        } else {
          break;
        }
      } while (d > 0);
      d = 0;
      e = chars.length;
      do {
        if (chars[d].length + countx > 0) {
          chars[d] = i.lf + chars[d];
          countx = chars[d].length;
        } else {
          chars[d] = ` ${chars[d]}`;
          countx = countx + chars[d].length;
        }
        d = d + 1;
      } while (d < e);
      if (chars[0].charAt(0) === " ") {
        i.data.token[i.start] = chars.join("").slice(1);
      } else {
        i.level[i.start - 1] = ind;
        i.data.token[i.start] = chars.join("").replace(i.lf, "");
      }
      if (i.data.token[i.start].indexOf(i.lf) > 0) {
        i.count =
          i.data.token[i.start].length -
          i.data.token[i.start].lastIndexOf(i.lf);
      }
    } else {
      do {
        d = d - 1;
        if (i.level[d] > -1) {
          i.count = i.data.token[i.start].length;
          if (i.data.lines[i.start + 1] > 0) {
            i.count = i.count + 1;
          }
          return;
        }
        if (i.data.types[d].indexOf("start") > -1) {
          i.count = 0;
          return;
        }
        if (
          (i.data.types[d] !== "attribute" ||
            (i.data.types[d] === "attribute" &&
              i.data.types[d + 1] !== "attribute")) &&
          i.data.lines[d + 1] > 0
        ) {
          if (
            i.data.types[d] !== "singleton" ||
            (i.data.types[d] === "singleton" &&
              i.data.types[d + 1] !== "attribute")
          ) {
            i.count = i.data.token[i.start].length;
            if (i.data.lines[i.start + 1] > 0) {
              i.count = i.count + 1;
            }
            break;
          }
        }
      } while (d > e);
      i.level[d] = ind;
    }
  }
}

function attributeLevel(i: FormatterState): [boolean, number] {
  let parent = i.start - 1,
    plural: boolean = false;
  if (i.data.types[i.start].indexOf("start") > 0) {
    let x: number = i.start;
    do {
      if (i.data.types[x].indexOf("end") > 0 && i.data.begin[x] === i.start) {
        if (x < i.end - 1 && i.data.types[x + 1].indexOf("attribute") > -1) {
          plural = true;
          break;
        }
      }
      x = x + 1;
    } while (x < i.end);
  } else if (
    i.start < i.end - 1 &&
    i.data.types[i.start + 1].indexOf("attribute") > -1
  ) {
    plural = true;
  }
  if (
    i.data.types[i.next] === "end" ||
    i.data.types[i.next] === "template_end"
  ) {
    if (i.data.types[parent] === "singleton") {
      return [plural, i.indent + 2];
    }
    return [plural, i.indent + 1];
  }
  if (i.data.types[parent] === "singleton") {
    return [plural, i.indent + 1];
  }
  return [plural, i.indent];
}

export function attribute(i: FormatterState): void {
  let y: number,
    parent: number = i.start - 1,
    len: number = i.data.token[parent].length + 1,
    [plural, lev] = attributeLevel(i),
    earlyexit: boolean = false,
    attStart: boolean = false;

  if (plural === false && i.data.types[i.start] === "comment_attribute") {
    if (i.data.types[i.prev] === "singleton") {
      i.level[i.prev] = i.indent + 1;
    } else {
      i.level[i.prev] = i.indent;
    }
    i.level.push(i.indent);
    i.level[parent] = i.indent;
    return;
  }

  if (lev < 1) {
    lev = 1;
  }

  // First, set levels and determine if there are template attributes
  do {
    i.count = i.count + i.data.token[i.start].length + 1;
    if (i.data.types[i.start].indexOf("attribute") > 0) {
      if (i.data.types[i.start] === "template_attribute") {
        i.level.push(-10);
      } else if (i.data.types[i.start] === "comment_attribute") {
        i.level.push(lev);
      } else if (i.data.types[i.start].indexOf("start") > 0) {
        attStart = true;
        if (
          i.start < i.end - 2 &&
          i.data.types[i.start + 2].indexOf("attribute") > 0
        ) {
          i.level.push(-20);
          i.start += 1;
        } else {
          if (parent === i.start - 1 && plural === false) {
            i.level.push(lev);
          } else {
            i.level.push(lev + 1);
          }
        }
      } else if (i.data.types[i.start].indexOf("end") > 0) {
        if (i.level[i.start - 1] !== -20) {
          i.level[i.start - 1] = i.level[i.data.begin[i.start]] - 1;
        }
        i.level.push(lev);
      } else {
        i.level.push(lev);
      }
      earlyexit = true;
    } else if (i.data.types[i.start] === "attribute") {
      len = len + i.data.token[i.start].length + 1;
      if (
        attStart === true ||
        (i.start < i.end - 1 &&
          i.data.types[i.start + 1] !== "template_attribute" &&
          i.data.types[i.start + 1].indexOf("attribute") > 0)
      ) {
        i.level.push(lev);
      } else {
        i.level.push(-10);
      }
    } else if (i.data.begin[i.start] < parent + 1) {
      break;
    }
    i.start = i.start + 1;
  } while (i.start < i.end);

  i.start = i.start - 1;
  if (
    i.level[i.start - 1] > 0 &&
    i.data.types[i.start].indexOf("end") > 0 &&
    i.data.types[i.start].indexOf("attribute") > 0 &&
    plural === true
  ) {
    i.level[i.start - 1] = i.level[i.start - 1] - 1;
  }
  if (i.level[i.start] !== -20) {
    i.level[i.start] = i.level[parent];
  }
  i.level[parent] = -10;
  if (
    earlyexit === true ||
    i.data.token[parent] === "<%xml%>" ||
    i.data.token[parent] === "<?xml?>"
  ) {
    i.count = 0;
    return;
  }
  y = i.start;
}
