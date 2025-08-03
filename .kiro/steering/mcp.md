---
inclusion: always
---

# MCP.md - MCP Server Reference

## Context7 Integration (Documentation & Research)

**Purpose**: Official library documentation, code examples, best practices, localization standards

**Activation Patterns**: 
- Automatic: External library imports detected, framework-specific questions, scribe persona active
- Manual: `--c7`, `--context7` flags
- Smart: Commands detect need for official documentation patterns

**Workflow Process**:
1. Library Detection: Scan imports, dependencies, package.json for library references
2. ID Resolution: Use `resolve-library-id` to find Context7-compatible library ID
3. Documentation Retrieval: Call `get-library-docs` with specific topic focus
4. Pattern Extraction: Extract relevant code patterns and implementation examples
5. Implementation: Apply patterns with proper attribution and version compatibility
6. Validation: Verify implementation against official documentation
7. Caching: Store successful patterns for session reuse