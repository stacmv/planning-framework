# Contributing to Planning Framework

Thank you for your interest in improving the Planning Framework! This document provides guidelines for contributing.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Contribution Guidelines](#contribution-guidelines)
- [Submitting Changes](#submitting-changes)

---

## Code of Conduct

This project follows a simple code of conduct:

- **Be respectful** - Treat all contributors with respect
- **Be constructive** - Provide helpful feedback and suggestions
- **Be collaborative** - Work together to improve the framework
- **Be patient** - Remember that everyone is learning

---

## How Can I Contribute?

### 1. Report Issues

Found a problem or have a suggestion? [Open an issue](https://github.com/yourusername/planning-framework/issues) with:

- **Clear description** - What's the problem or suggestion?
- **Context** - What were you trying to do?
- **Expected vs Actual** - What did you expect? What happened instead?
- **Steps to reproduce** - How can we recreate the issue?

**Issue Labels:**
- `bug` - Something isn't working
- `enhancement` - New feature or improvement
- `documentation` - Docs need updating
- `question` - Need clarification
- `good first issue` - Good for newcomers

### 2. Improve Documentation

Documentation improvements are always welcome:

- Fix typos or unclear wording
- Add examples or use cases
- Improve template clarity
- Add domain-specific variations (web apps, mobile, etc.)

### 3. Enhance Templates

Contribute better templates:

- Additional template variations
- Domain-specific customizations
- Language-specific versions
- Integration examples

### 4. Share Examples

Real-world examples help others understand the framework:

- Add your project as an example
- Document what worked well
- Share lessons learned
- Contribute case studies

### 5. Improve Tooling

Enhance setup scripts and automation:

- Better error handling in setup scripts
- Additional platform support (macOS, other shells)
- IDE integration (VS Code snippets, etc.)
- CI/CD integration examples

---

## Development Setup

### Prerequisites

- Git
- Bash (for testing setup scripts on Linux/macOS)
- PowerShell (for testing on Windows)
- A test project to validate changes

### Local Setup

1. **Fork and clone:**
   ```bash
   git clone https://github.com/YOUR-USERNAME/planning-framework.git
   cd planning-framework
   ```

2. **Create a branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Test your changes:**
   ```bash
   # Run the test suite
   make test

   # Try the framework end-to-end on a throwaway project
   mkdir ../test-project
   make converge TARGET=../test-project

   # Verify it works
   ls -la ../test-project/docs/planning/
   ```

   `converge` is the single entry point: it installs into a fresh project,
   upgrades an older one, and tops up an incomplete v3 one.

---

## Contribution Guidelines

### Template Changes

When modifying templates:

✅ **Do:**
- Keep templates generic and reusable
- Use placeholders (`[Project Name]`, `YYYY-MM-DD`)
- Include helpful comments and examples
- Test with the setup script
- Update template README if adding new templates

❌ **Don't:**
- Add project-specific content
- Remove core sections without discussion
- Make breaking changes without versioning

### Documentation Changes

✅ **Do:**
- Use clear, concise language
- Include code examples
- Add links to related sections
- Keep formatting consistent
- Test all command examples

❌ **Don't:**
- Use jargon without explanation
- Make assumptions about user knowledge
- Add very long paragraphs (use bullet points)

### Script Changes

✅ **Do:**
- Test on multiple platforms (if possible)
- Add error handling
- Provide clear error messages
- Document any new parameters
- Maintain backward compatibility

❌ **Don't:**
- Remove existing functionality without discussion
- Add dependencies without good reason
- Skip error handling
- Use platform-specific commands without fallbacks

---

## Submitting Changes

### Pull Request Process

1. **Update documentation**
   - Update README.md if adding features
   - Update FRAMEWORK.md if changing concepts
   - Update template README if adding templates

2. **Test thoroughly**
   - Test setup script works
   - Verify templates render correctly
   - Check all links work
   - Test on different platforms (if possible)

3. **Create pull request**
   - Use descriptive title
   - Explain what changed and why
   - Reference any related issues
   - Include screenshots for visual changes

4. **Wait for review**
   - Address feedback constructively
   - Make requested changes
   - Ask questions if unclear

### PR Title Format

Use conventional commit format:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `chore:` - Maintenance tasks
- `refactor:` - Code restructuring

**Examples:**
- `feat: Add risk register template`
- `fix: Correct path in setup script`
- `docs: Improve quick reference examples`
- `chore: Update dependencies`

### Commit Messages

Write clear commit messages:

```
feat: Add web application PRD template

- Add sections for API specs and UI/UX
- Include database schema section
- Add deployment pipeline details
- Update template README with new template

Closes #42
```

---

## Types of Contributions We're Looking For

### High Priority

🔥 **Additional Templates**
- Risk register template
- Testing plan template
- Deployment plan template
- Performance testing template
- Security requirements template

🔥 **Domain-Specific Variations**
- Web application templates
- Mobile app templates
- Data science project templates
- DevOps/Infrastructure templates
- API/microservices templates

🔥 **Real-World Examples**
- More project examples in `examples/`
- Case studies showing framework value
- Before/after comparisons

### Medium Priority

⚙️ **Tooling Improvements**
- NPM package for easy installation
- Python package (`pip install planning-framework`)
- Docker container for testing
- GitHub Action for checking docs are updated
- VS Code extension

⚙️ **Integration Examples**
- Jira integration
- Linear integration
- Notion integration
- Trello integration
- GitHub Projects integration

### Nice to Have

💡 **Documentation Enhancements**
- Video tutorials
- Interactive examples
- Translations to other languages
- Detailed case studies
- Best practices guide

💡 **Advanced Features**
- Automated progress report generation
- AI-powered task suggestions
- Integration with Claude Code API
- Automated ADR generation from discussions

---

## Development Workflow

### Typical Contribution Flow

1. **Identify improvement** - Issue, idea, or bug
2. **Discuss first** - For large changes, open an issue to discuss
3. **Create branch** - `git checkout -b feature/name`
4. **Make changes** - Edit templates, docs, or scripts
5. **Test thoroughly** - Run setup script, verify templates
6. **Update docs** - Keep documentation in sync
7. **Commit changes** - Use clear commit messages
8. **Push branch** - `git push origin feature/name`
9. **Open PR** - Explain changes, reference issues
10. **Address feedback** - Work with reviewers
11. **Merge** - Once approved, changes are merged

### Testing Checklist

Before submitting PR:

- [ ] Setup script runs without errors
- [ ] Templates render correctly (no broken placeholders)
- [ ] All documentation links work
- [ ] Code examples are tested
- [ ] CHANGELOG.md updated (if applicable)
- [ ] No typos or grammar errors
- [ ] Formatting is consistent

---

## Style Guidelines

### Markdown Style

- Use ATX-style headers (`#` not underlines)
- Use fenced code blocks with language identifiers
- Use bullet points for lists (not numbers unless order matters)
- Use `**bold**` for emphasis, `*italic*` for secondary emphasis
- Use `code` for commands, file names, and code references
- One sentence per line in paragraphs (easier git diffs)

### Template Style

- Use clear section headers
- Include examples in comments
- Use consistent placeholder format: `[Project Name]`, `YYYY-MM-DD`
- Add "what this demonstrates" sections in examples
- Keep templates under 500 lines (split if larger)

### Code Style

**Shell Scripts:**
- Use `#!/bin/bash` shebang
- Use `set -e` for error handling
- Use clear variable names (`PROJECT_PATH` not `pp`)
- Add comments for complex logic
- Use shellcheck for linting

**PowerShell:**
- Use clear parameter names
- Add help comments
- Handle errors gracefully
- Test on Windows

---

## Community

### Getting Help

- 📖 **Documentation:** Read [FRAMEWORK.md](docs/planning/FRAMEWORK.md) and [QUICKSTART.md](docs/planning/QUICKSTART.md)
- 💬 **Discussions:** Use [GitHub Discussions](https://github.com/yourusername/planning-framework/discussions)
- 🐛 **Issues:** Report bugs via [GitHub Issues](https://github.com/yourusername/planning-framework/issues)

### Recognition

Contributors are recognized in:

- CHANGELOG.md for their contributions
- GitHub's contributor graph
- Special thanks in release notes

---

## Questions?

Have questions about contributing? Feel free to:

- Open an issue with the `question` label
- Start a discussion in GitHub Discussions
- Comment on existing issues or PRs

---

**Thank you for contributing to the Planning Framework!**

Your improvements help developers and AI assistants work more effectively together.
