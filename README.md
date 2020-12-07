# tei-publisher-vscode README

A package to help editors work on TEI files.

## Features

* Preview the currently edited TEI document by sending it to a TEI Publisher instance where it will be transformed to HTML via an existing ODD
* Look up an entity in a register database
### Preview

Get an HTML preview of the TEI file currently opened in the editor. The content is sent to a TEI Publisher endpoint and transformed to HTML via an ODD with processing instructions. The extension queries the server for a list of available ODDs and lets you choose one.

System | Keybinding
---------|----------|---------
 mac | cmd-shift-a
 other | ctrl-shift-a

## Entity Markup

Look up an entity in a register database.

System | Keybinding
---------|----------|---------
 mac | cmd-shift-e
 other | ctrl-shift-e

 ## Snippets


Column A | Column B | Column C
---------|----------|---------
 A1 | B1 | C1
 A2 | B2 | C2
 A3 | B3 | C3