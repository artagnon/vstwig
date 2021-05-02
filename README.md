# vstwig

[![](https://img.shields.io/visual-studio-marketplace/d/artagnon.vstwig?logo=visual-studio-code&style=for-the-badge&labelColor=000000&label=Downloads)](https://marketplace.visualstudio.com/items?itemName=artagnon.vstwig)
[![](https://img.shields.io/visual-studio-marketplace/i/artagnon.vstwig?logo=visual-studio-code&style=for-the-badge&labelColor=000000&label=Installs)](https://marketplace.visualstudio.com/items?itemName=artagnon.vstwig)
[![](https://img.shields.io/lgtm/grade/javascript/github/artagnon/vstwig?style=for-the-badge&labelColor=000000&logo=lgtm&label=Code%20Quality)](https://lgtm.com/projects/g/artagnon/vstwig/context:javascript)

Includes syntax highlighting for the Twig language, and an opinionated formatter that actually works. The formatter formats a document containing HTML tags, `{{ ... }}`, and `{% [block] %} ... {% end[block] %}`, leaving the code between `<style>...</style>` and `<script>...</script>` untouched. There are no configuration options, and the formatter respects the current VSCode configuration.

Before:
![Before](assets/vstwig-before.png)

After:
![After](assets/vstwig-after.png)
