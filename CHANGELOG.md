# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial repo scaffold (README, CHANGELOG, LICENSE, plan).
- TypeScript + Vite + `@crxjs/vite-plugin` build toolchain with MV3
  `manifest.json`, ESLint flat config, Prettier, and Vitest. Stub
  popup, options, and service-worker entry points build green and load
  as an unpacked extension from `dist/`.
