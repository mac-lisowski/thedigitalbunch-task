# Changelog

All notable changes to the Property Matching System will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-03-25

### Added
- Added MODEL environment variable to configure the OpenAI model
- Added extended documentation in the docs directory
- Added conditional console logging based on DEBUG environment flag
- Added more robust LLM response parsing for better percentage detection
- Added more descriptive environment variable documentation in .env.tpl

### Changed
- Improved pre-filtering to avoid keyword-based filtering that might exclude valid matches
- Updated the OpenAI prompt to better handle property comparisons
- Increased candidate limit from 5 to 20 potential matches per property
- Improved exact matching to use only basic text normalization
- Moved from hardcoded model selection to configurable model via environment variables

### Fixed
- Fixed issue where "Downtown Commercial Office Space" and "Downtown Office Complex" weren't being properly compared
- Fixed potential parsing issues with LLM responses containing varied percentage formats
- Fixed console output flooding by making debug logs conditional

## [1.0.0] - 2025-03-01

### Added
- Initial release of the Property Matching System
- Implemented exact text matching for property descriptions
- Integrated LLM-based semantic matching for non-exact matches
- Added Redis caching for comparison results
- Implemented worker thread parallelization
- Added CSV report generation
- Created test data generation script 