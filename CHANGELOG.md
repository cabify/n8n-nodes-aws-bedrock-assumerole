# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2025-11-18

### Added
- sub-node to generate a chat model compatible with AI Agent


## [1.2.0] - 2025-11-18

### Added
- Optional image input support (Text and Image) with new helper and example workflow. Backwards compatible for existing text-only workflows.


## [1.1.0] - 2025-11-14

### Added
- Now Application Inference profiles are configurable from credential


## [1.0.6] - 2025-11-13

### Fixed
- model name checker


## [1.0.5] - 2025-11-13

### Fixed
- fix inferenced models nomeclature


## [1.0.4] - 2025-11-13

### Changed
- icons to modern ones on the folder

### Removed
- not used code


## [1.0.2] - 2024-11-13

### Fixed
- Fixed custom SVG icons not displaying correctly in n8n UI
- Icons now properly located in `dist/nodes/` and `dist/credentials/` directories
- Removed redundant `dist/icons/` directory

### Changed
- Updated icon references to use `file:bedrock.svg` and `file:aws.svg`
- Optimized build script to copy icons to correct locations

### Removed
- Removed unused `authenticate` and `test` properties from credentials
- Removed unused imports (`IAuthenticateGeneric`, `ICredentialTestRequest`)
- Cleaned up dead code and redundant files

## [1.0.1] - 2024-11-12

### Fixed
- Minor bug fixes and improvements

## [1.0.0] - 2024-11-12

### Added
- Initial release of n8n-nodes-aws-bedrock-assumerole
- AWS Bedrock integration with AssumeRole authentication
- Support for multiple Claude models:
  - Claude 3.5 Sonnet (v2 & v1)
  - Claude 3 Opus
  - Claude 3 Sonnet
  - Claude 3 Haiku
  - Claude 2.1
  - Claude 2.0
  - Claude Instant 1.2
- Automatic credential caching with expiration handling
- Comprehensive error handling and logging
- Batch processing support for multiple items
- Usage tracking and response metadata
- TypeScript implementation with full type safety
- Complete documentation and examples
- Installation script for easy setup

### Features
- 🔐 Secure cross-account access using AWS STS AssumeRole
- ⚡ Credential caching to minimize STS calls
- 🛡️ Comprehensive error handling
- 📊 Detailed usage information and response metadata
- 🔄 Support for processing multiple items in a single execution
- 🎨 Custom SVG icons for better visual identification

### Security
- Environment variable support for AWS credentials
- Secure credential handling with AssumeRole pattern
- No hardcoded credentials in the codebase
- Proper session token management
