# Changelog
All notable changes to this project will be documented in this file.

This project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2017-11-21
### Changed
- converted the library to typescript
- updated examples to illustrate the latest changes

## [0.0.14] - 2017-11-19
### Fixed
- missing var declaration

## [0.0.13] - 2017-11-09
### Added
- added named export for typescript compatibility

## [0.0.12] - 2017-07-17
### Added
- added 'retryInterval' option
- implemented a delayed retry if the specified port is already in use

## [0.0.11] - 2017-07-13
### Changed
- dgram options to make the port reusable
- improved console log messages

## [0.0.10] - 2017-04-07
### Fixed
- service discovery could succeed if just the last element of a service of interest matched with the broadcast

## [0.0.9] - 2017-04-04
### Added
- ability to limit broadcasts to a certain number of repetitions

## [0.0.8] - 2017-22-02
### Changed
- introduced ES6 arrow functions
- cleaned up the code

## [0.0.7] - 2017-02-20
### Changed
- raised broadcast interval from 250ms to 1s


