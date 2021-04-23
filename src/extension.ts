import { languages, ExtensionContext, TextDocument, Position, Range, TextEdit } from "vscode";
import beautify from "./beautify";
import "sparser";

export function activate(_: ExtensionContext) {
  const options: any = {
    beautify: {},
    end: 0,
    iterator: 0,
    meta: {
      error: "",
      lang: ["", "", ""],
      time: "",
      insize: 0,
      outsize: 0,
      difftotal: 0,
      difflines: 0,
    },
    scopes: [],
    start: 0,
    crlf: false,
    force_indent: false,
    force_attribute: true,
    wrap: 0,
    preserve_text: false,
    unformatted: false,
    language: "twig",
    space_close: true,
    indent_char: " ",
    indent_size: 2,
    preserve: 1,
    indent_level: 0,
  };
  languages.registerDocumentRangeFormattingEditProvider(
    { scheme: "file", language: "twig" },
    {
      provideDocumentRangeFormattingEdits: function (document: TextDocument, range: Range) {
        let end = range.end;

        if (end.character === 0) {
          end = end.translate(-1, Number.MAX_VALUE);
        } else {
          end = end.translate(0, Number.MAX_VALUE);
        }

        const rng = new Range(new Position(range.start.line, 0), end);
        global.sparser.options.source = document.getText(rng);
        options.parsed = global.sparser.parser();
        return [TextEdit.replace(rng, beautify(options))];
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
        const rng = new Range(start, end);
        global.sparser.options.source = document.getText(rng);
        options.parsed = global.sparser.parser();
        return [TextEdit.replace(rng, beautify(options))];
      },
    }
  );
}

// this method is called when your extension is deactivated
export function deactivate() {}
