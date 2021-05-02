export function nextIndex(i: FormatterState): number {
  let x;
  for (x = i.a + 1; x < i.c; x += 1) {
    if (i.data.types[x] !== "comment" && i.data.types[x].indexOf("attribute") < 0) {
      break;
    }
  }
  return x;
}

export function prevIndex(i: FormatterState): number {
  let x;
  for (x = i.a - 1; x > 0; x -= 1) {
    if (i.data.types[x] !== "comment" && i.data.types[x].indexOf("attribute") < 0) {
      break;
    }
  }
  return x;
}

export function anchor(i: FormatterState): void {
  let aa: number = i.a;
  const stop: number = i.data.begin[i.a];
  // Verify list is only a link list before making changes
  do {
    aa = aa - 1;
    if (
      i.data.token[aa] === "</li>" &&
      i.data.begin[i.data.begin[aa]] === stop &&
      i.data.token[aa - 1] === "</a>" &&
      i.data.begin[aa - 1] === i.data.begin[aa] + 1
    ) {
      aa = i.data.begin[aa];
    } else {
      return;
    }
  } while (aa > stop + 1);

  // now make the changes
  aa = i.a;
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
  let x: number = i.a,
    test: boolean = false;
  if (i.data.lines[i.a + 1] === 0 && i.options.forceIndent === false) {
    do {
      if (i.data.lines[x] > 0) {
        test = true;
        break;
      }
      x = x - 1;
    } while (x > i.comstart);
    x = i.a;
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

    // correction so that a following end tag is not indented 1 too much
    if (ind === i.indent + 1) {
      i.level[i.a] = i.indent;
    }

    // indentation must be applied to the tag preceeding the comment
    if (i.data.types[x].indexOf("attribute") > -1) {
      i.level[i.data.begin[x]] = ind;
    } else {
      i.level[x] = ind;
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
  if (i.options.forceIndent === true || i.options.forceAttribute === true) {
    i.level.push(i.indent);
    return;
  }
  if (
    i.next < i.c &&
    (i.data.types[i.next].indexOf("end") > -1 || i.data.types[i.next].indexOf("start") > -1) &&
    i.data.lines[i.next] > 0
  ) {
    i.level.push(i.indent);
    ind = ind + 1;
    if (
      i.data.types[i.a] === "singleton" &&
      i.a > 0 &&
      i.data.types[i.a - 1].indexOf("attribute") > -1 &&
      i.data.types[i.data.begin[i.a - 1]] === "singleton"
    ) {
      if (
        i.data.begin[i.a] < 0 ||
        (i.data.types[i.data.begin[i.a - 1]] === "singleton" &&
          i.data.begin[i.data.ender[i.a] - 1] !== i.a)
      ) {
        i.level[i.a - 1] = i.indent;
      } else {
        i.level[i.a - 1] = i.indent + 1;
      }
    }
  } else if (
    i.data.types[i.a] === "singleton" &&
    i.a > 0 &&
    i.data.types[i.a - 1].indexOf("attribute") > -1
  ) {
    i.level[i.a - 1] = i.indent;
    i.count = i.data.token[i.a].length;
    i.level.push(-10);
  } else if (i.data.lines[i.next] === 0) {
    i.level.push(-20);
  } else if (
    // wrap if
    // * i.options.wrap is 0
    // * i.next token is singleton with an attribute and exceeds wrap
    // * i.next token is template or singleton and exceeds wrap
    (i.options.wrap === 0 ||
      (i.a < i.c - 2 &&
        i.data.token[i.a].length + i.data.token[i.a + 1].length + i.data.token[i.a + 2].length + 1 >
          i.options.wrap &&
        i.data.types[i.a + 2].indexOf("attribute") > -1) ||
      i.data.token[i.a].length + i.data.token[i.a + 1].length > i.options.wrap) &&
    (i.data.types[i.a + 1] === "singleton" || i.data.types[i.a + 1] === "template")
  ) {
    i.level.push(i.indent);
  } else {
    i.count = i.count + 1;
    i.level.push(-10);
  }
  if (i.a > 0 && i.data.types[i.a - 1].indexOf("attribute") > -1 && i.data.lines[i.a] < 1) {
    i.level[i.a - 1] = -20;
  }
  if (i.count > i.options.wrap) {
    let d: number = i.a,
      e: number = Math.max(i.data.begin[i.a], 0);
    if (i.data.types[i.a] === "content" && i.options.preserveText === false) {
      let countx: number = 0,
        chars: string[] = i.data.token[i.a].replace(/\s+/g, " ").split(" ");
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
        if (chars[d].length + countx > i.options.wrap) {
          chars[d] = i.lf + chars[d];
          countx = chars[d].length;
        } else {
          chars[d] = ` ${chars[d]}`;
          countx = countx + chars[d].length;
        }
        d = d + 1;
      } while (d < e);
      if (chars[0].charAt(0) === " ") {
        i.data.token[i.a] = chars.join("").slice(1);
      } else {
        i.level[i.a - 1] = ind;
        i.data.token[i.a] = chars.join("").replace(i.lf, "");
      }
      if (i.data.token[i.a].indexOf(i.lf) > 0) {
        i.count = i.data.token[i.a].length - i.data.token[i.a].lastIndexOf(i.lf);
      }
    } else {
      do {
        d = d - 1;
        if (i.level[d] > -1) {
          i.count = i.data.token[i.a].length;
          if (i.data.lines[i.a + 1] > 0) {
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
            (i.data.types[d] === "attribute" && i.data.types[d + 1] !== "attribute")) &&
          i.data.lines[d + 1] > 0
        ) {
          if (
            i.data.types[d] !== "singleton" ||
            (i.data.types[d] === "singleton" && i.data.types[d + 1] !== "attribute")
          ) {
            i.count = i.data.token[i.a].length;
            if (i.data.lines[i.a + 1] > 0) {
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

function wrap(i: FormatterState, index: number) {
  const item: string[] = i.data.token[index].replace(/\s+/g, " ").split(" "),
    ilen: number = item.length;
  let bb: number = 1,
    acount: number = item[0].length;
  if (/=("|')?(<|(\{(\{|%|#|@|!|\?|^))|(\[%))/.test(i.data.token[index]) === true) {
    return;
  }
  do {
    if (acount + item[bb].length > i.options.wrap) {
      acount = item[bb].length;
      item[bb] = i.lf + item[bb];
    } else {
      item[bb] = ` ${item[bb]}`;
      acount = acount + item[bb].length;
    }
    bb = bb + 1;
  } while (bb < ilen);
  i.data.token[index] = item.join("");
}

function attributeLevel(i: FormatterState): [boolean, number] {
  let parent = i.a - 1,
    plural: boolean = false;
  if (i.data.types[i.a].indexOf("start") > 0) {
    let x: number = i.a;
    do {
      if (i.data.types[x].indexOf("end") > 0 && i.data.begin[x] === i.a) {
        if (x < i.c - 1 && i.data.types[x + 1].indexOf("attribute") > -1) {
          plural = true;
          break;
        }
      }
      x = x + 1;
    } while (x < i.c);
  } else if (i.a < i.c - 1 && i.data.types[i.a + 1].indexOf("attribute") > -1) {
    plural = true;
  }
  if (i.data.types[i.next] === "end" || i.data.types[i.next] === "template_end") {
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
  let y: number = i.a,
    parent: number = i.a - 1,
    len: number = i.data.token[parent].length + 1,
    [plural, lev] = attributeLevel(i),
    earlyexit: boolean = false,
    attStart: boolean = false;

  if (plural === false && i.data.types[i.a] === "comment_attribute") {
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
    i.count = i.count + i.data.token[i.a].length + 1;
    if (i.data.types[i.a].indexOf("attribute") > 0) {
      if (i.data.types[i.a] === "template_attribute") {
        i.level.push(-10);
      } else if (i.data.types[i.a] === "comment_attribute") {
        i.level.push(lev);
      } else if (i.data.types[i.a].indexOf("start") > 0) {
        attStart = true;
        if (i.a < i.c - 2 && i.data.types[i.a + 2].indexOf("attribute") > 0) {
          i.level.push(-20);
          i.a += 1;
        } else {
          if (parent === i.a - 1 && plural === false) {
            i.level.push(lev);
          } else {
            i.level.push(lev + 1);
          }
        }
      } else if (i.data.types[i.a].indexOf("end") > 0) {
        if (i.level[i.a - 1] !== -20) {
          i.level[i.a - 1] = i.level[i.data.begin[i.a]] - 1;
        }
        i.level.push(lev);
      } else {
        i.level.push(lev);
      }
      earlyexit = true;
    } else if (i.data.types[i.a] === "attribute") {
      len = len + i.data.token[i.a].length + 1;
      if (i.options.unformatted === true) {
        i.level.push(-10);
      } else if (
        i.options.forceAttribute === true ||
        attStart === true ||
        (i.a < i.c - 1 &&
          i.data.types[i.a + 1] !== "template_attribute" &&
          i.data.types[i.a + 1].indexOf("attribute") > 0)
      ) {
        i.level.push(lev);
      } else {
        i.level.push(-10);
      }
    } else if (i.data.begin[i.a] < parent + 1) {
      break;
    }
    i.a = i.a + 1;
  } while (i.a < i.c);

  i.a = i.a - 1;
  if (
    i.level[i.a - 1] > 0 &&
    i.data.types[i.a].indexOf("end") > 0 &&
    i.data.types[i.a].indexOf("attribute") > 0 &&
    plural === true
  ) {
    i.level[i.a - 1] = i.level[i.a - 1] - 1;
  }
  if (i.level[i.a] !== -20) {
    i.level[i.a] = i.level[parent];
  }
  if (i.options.forceAttribute === true) {
    i.count = 0;
    i.level[parent] = lev;
  } else {
    i.level[parent] = -10;
  }
  if (
    earlyexit === true ||
    i.options.unformatted === true ||
    i.data.token[parent] === "<%xml%>" ||
    i.data.token[parent] === "<?xml?>"
  ) {
    i.count = 0;
    return;
  }
  y = i.a;

  // Second, ensure tag contains more than one attribute
  if (y > parent + 1) {
    // Finally, indent attributes if tag length exceeds the wrap limit
    if (i.options.spaceClose === false) {
      len = len - 1;
    }
    if (len > i.options.wrap && i.options.wrap > 0 && i.options.forceAttribute === false) {
      i.count = i.data.token[i.a].length;
      do {
        if (i.data.token[y].length > i.options.wrap && /\s/.test(i.data.token[y]) === true) {
          wrap(i, y);
        }
        y = y - 1;
        i.level[y] = lev;
      } while (y > parent);
    }
  } else if (
    i.options.wrap > 0 &&
    i.data.types[i.a].indexOf("attribute") > -1 &&
    i.data.token[i.a].length > i.options.wrap &&
    /\s/.test(i.data.token[i.a]) === true
  ) {
    wrap(i, i.a);
  }
}
