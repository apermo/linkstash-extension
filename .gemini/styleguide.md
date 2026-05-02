# Code Review Style Guide

## Project Context

This is a GitHub template repository for bootstrapping new projects. A `setup.sh` script lets developers configure the project name, namespace, and description.

## Code Style

- Flag inline comments that merely restate what the code does instead of explaining intent or reasoning.
- Flag commented-out code.
- Do not flag docblocks — these may be required by coding standards even when the function is self-explanatory.
- Flag new code that duplicates existing functionality in the repository.

## File Operations

- Flag files that appear to be deleted and re-added as new files instead of being moved/renamed (losing git history).

## Build & Packaging

- Flag newly added files or directories that are missing from build/packaging configs (`.gitattributes`, `Makefile`, CI workflows, etc.).

## Testing

- If tests exist for a changed area, flag missing or insufficient test coverage for new/modified code.

## Documentation

- If a change affects user-facing behavior, flag missing updates to README, CHANGELOG, or inline docblocks.

## Commits

- This project uses Conventional Commits with a 50-char subject / 72-char body limit.
- Each commit should address a single concern.

<!-- Add language-specific rules below as needed, e.g. coding style,
     indentation, naming conventions, or framework-specific guidelines.
     This keeps the base template generic while allowing derived
     projects to tailor reviews to their stack. -->
