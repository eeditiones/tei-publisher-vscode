# Change Log

All notable changes to the "tei-publisher-vscode" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.0.1] - 2020-12-22

### Fixed

* Respect whitespace when splitting element: skip over whitespace after split point before inserting opening tag

### Documentation

* Add screencast showing extra editing commands

## [1.0.0] - 2020-12-21

### Added 

* New command: delete closest tag around current node

### Fixed

* Catch and report XML parsing errors which prevent commands to succeed

## [0.9.0] - 2020-12-20

### Added

* New command: split current element at cursor position

## [0.8.0] - 2020-12-20

### Added

* New command: expand selection to parent element