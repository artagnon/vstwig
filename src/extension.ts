import { languages, ExtensionContext, TextDocument, Position, Range, TextEdit } from "vscode";
import FormatTwig from "./FormatTwig";
import "sparser";

function textEdits(document: TextDocument, range: Range): TextEdit[] {
  const options: any = {
    beautify: {},
    end: 0,
    iterator: 0,
    start: 0,
    force_indent: false,
    force_attribute: false,
    wrap: 0,
    preserve_text: false,
    unformatted: false,
    space_close: true,
    indent_char: " ",
    indent_size: 2,
    preserve: 1,
    indent_level: 0,
  };

  global.sparser.options.source = document.getText(range);
  options.parsed = global.sparser.parser();
  const ft = new FormatTwig(options);
  return [TextEdit.replace(range, ft.formatDocument())];
}

export function activate(_: ExtensionContext) {
  languages.registerDocumentRangeFormattingEditProvider(
    { scheme: "file", language: "twig" },
    {
      provideDocumentRangeFormattingEdits: function (document: TextDocument, range: Range) {
        const start = new Position(range.start.line, 0);
        let end = range.end;
        if (end.character === 0) {
          end = end.translate(-1, Number.MAX_VALUE);
        } else {
          end = end.translate(0, Number.MAX_VALUE);
        }
        return textEdits(document, new Range(start, end));
      },
    }
  );

  languages.registerDocumentFormattingEditProvider(
    { scheme: "file", language: "twig" },
    {
      provideDocumentFormattingEdits: function (document: TextDocument) {
        const start = new Position(0, 0);
        const end = new Position(
          document.lineCount - 1,
          document.lineAt(document.lineCount - 1).text.length
        );
        return textEdits(document, new Range(start, end));
      },
    }
  );
}

// this method is called when your extension is deactivated
export function deactivate() {}
