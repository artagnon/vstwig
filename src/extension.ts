import {
  languages,
  ExtensionContext,
  TextDocument,
  Position,
  Range,
  TextEdit,
  window,
  EndOfLine,
} from "vscode";
import FormatTwig from "./FormatTwig";

function textEdits(document: TextDocument, range: Range): TextEdit[] {
  let tabSize = window.activeTextEditor?.options.tabSize ?? 2;
  tabSize = typeof tabSize == "string" ? 2 : tabSize;
  let insertSpaces = window.activeTextEditor?.options.insertSpaces ?? true;
  insertSpaces = typeof insertSpaces == "string" ? true : insertSpaces;
  const indentSize = insertSpaces ? tabSize : 1;
  const lf =
    window.activeTextEditor?.document.eol === EndOfLine.LF ? "\n" : "\r\n";
  const options: FormatterOptions = {
    source: document.getText(range),
    lf: lf,
    indentChar: insertSpaces ? " " : "\t",
    indentSize: indentSize,
  };

  const ft = new FormatTwig(options);
  return [TextEdit.replace(range, ft.formatDocument())];
}

export function activate(_: ExtensionContext) {
  languages.registerDocumentRangeFormattingEditProvider("twig", {
    provideDocumentRangeFormattingEdits: (
      document: TextDocument,
      range: Range
    ) => {
      const start = new Position(range.start.line, 0);
      let end = range.end;
      end =
        end.character === 0
          ? end.translate(-1, Number.MAX_VALUE)
          : end.translate(0, Number.MAX_VALUE);
      return textEdits(document, new Range(start, end));
    },
  });

  languages.registerDocumentFormattingEditProvider("twig", {
    provideDocumentFormattingEdits: (document: TextDocument) => {
      const start = new Position(0, 0);
      const end = new Position(
        document.lineCount - 1,
        document.lineAt(document.lineCount - 1).text.length
      );
      return textEdits(document, new Range(start, end));
    },
  });
}

// this method is called when your extension is deactivated
export function deactivate() {}
