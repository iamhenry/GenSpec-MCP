# Release Guide - GenSpec MCP Server

This document outlines the complete release process for GenSpec MCP Server, including pre-release validation, release execution, and post-release verification.

## Version Management

### Semantic Versioning

Follow [Semantic Versioning](https://semver.org/) principles:

- **MAJOR** (x.0.0): Breaking changes to MCP tools, incompatible API changes
- **MINOR** (0.x.0): New features, new tools, backward-compatible changes  
- **PATCH** (0.0.x): Bug fixes, template improvements, documentation updates

### Version Planning

Before any release, determine the appropriate version bump:

```bash
# Check current version
npm version

# Preview version bump (dry run)
npm version patch --dry-run    # Bug fixes
npm version minor --dry-run    # New features
npm version major --dry-run    # Breaking changes
```

## Pre-Release Checklist

### 🔍 Code Quality & Testing

- [ ] All unit tests pass: `npm test`
- [ ] Integration tests pass: `npm run test:integration`
- [ ] TypeScript compilation succeeds: `npm run build`
- [ ] ESLint passes without errors: `npm run lint`
- [ ] No security vulnerabilities: `npm audit`
- [ ] Installation test passes: `node test-install.js`

### 📝 Documentation & Templates

- [ ] README.md is up-to-date with latest features
- [ ] All template files are present and validated
- [ ] CHANGELOG.md updated with release notes
- [ ] API documentation reflects current tool signatures
- [ ] MCP client configuration examples are accurate

### 🔧 Package Configuration

- [ ] package.json version is correct
- [ ] package.json dependencies are up-to-date
- [ ] .npmignore excludes development files properly
- [ ] Binary entry points are configured correctly
- [ ] File permissions are set appropriately

### 🎯 Functionality Validation

- [ ] All MCP tools work correctly (`start_genspec`, `generate_*`)
- [ ] Template resources are accessible via MCP
- [ ] File writing to `_ai/docs/` functions properly
- [ ] Approval workflow operates as expected
- [ ] Error handling provides clear messages
- [ ] Phase dependencies are enforced correctly

### 🌐 Multi-Client Testing

Test with each supported MCP client:

- [ ] **Claude Desktop**: Configuration loads, tools execute
- [ ] **VS Code MCP**: Extension recognizes server, commands work
- [ ] **Cursor**: MCP integration functions correctly
- [ ] **Other MCP Clients**: Basic compatibility verified

### 📊 Performance Validation

- [ ] Generation time under 30s for typical USER-STORIES.md
- [ ] Memory usage remains reasonable during execution
- [ ] No memory leaks in long-running sessions
- [ ] Concurrent tool execution handles properly

## Release Process

### 1. Pre-Release Preparation

```bash
# Ensure clean working directory
git status

# Pull latest changes
git pull origin main

# Run full test suite
npm run test:all

# Update dependencies (if needed)
npm update
npm audit fix

# Build production artifacts
npm run build
```

### 2. Version and Documentation Update

```bash
# Update version (choose appropriate bump)
npm version patch    # or minor/major

# Update CHANGELOG.md with new version
# Add release notes, breaking changes, new features

# Commit version changes
git add CHANGELOG.md
git commit -m "docs: update changelog for v$(npm --version)"
```

### 3. Final Validation

```bash
# Test installation locally
npm pack
npm install -g ./genspec-mcp-server-*.tgz

# Run installation test
node test-install.js

# Test in MCP client (Claude Desktop recommended)
# Verify basic workflow: start_genspec → approve → approve → approve

# Clean up test installation
npm uninstall -g genspec-mcp-server
rm genspec-mcp-server-*.tgz
```

### 4. Release Execution

```bash
# Push version tag
git push origin main
git push origin --tags

# Publish to npm registry
npm publish

# Verify published package
npm view genspec-mcp-server
```

### 5. GitHub Release

Create release on GitHub:

1. Go to repository → Releases → New Release
2. Tag: v[VERSION] (e.g., v1.2.3)
3. Title: GenSpec MCP Server v[VERSION] 
4. Description: Copy from CHANGELOG.md
5. Attach build artifacts if applicable
6. Mark as pre-release if beta/alpha

## Post-Release Checklist

### ✅ Immediate Verification

- [ ] Package appears on [npmjs.com](https://www.npmjs.com/package/genspec-mcp-server)
- [ ] Installation works: `npm install -g genspec-mcp-server`
- [ ] Basic functionality test passes
- [ ] Documentation renders correctly on npm
- [ ] GitHub release is visible and complete

### 📢 Communication

- [ ] Update project README badges (if applicable)
- [ ] Notify users in relevant channels/forums
- [ ] Update MCP community registry (if exists)
- [ ] Social media announcement (optional)

### 📈 Monitoring

Monitor for 24-48 hours after release:

- [ ] npm download statistics
- [ ] GitHub issue reports
- [ ] User feedback and bug reports
- [ ] MCP client compatibility reports

## Rollback Procedure

If critical issues are discovered post-release:

### Immediate Actions

```bash
# Unpublish if within 24 hours and no dependencies
npm unpublish genspec-mcp-server@[VERSION]

# Or deprecate the version
npm deprecate genspec-mcp-server@[VERSION] "Critical bug - use [SAFE_VERSION]"
```

### Recovery Steps

1. **Identify Issue**: Document the problem clearly
2. **Create Hotfix**: Fix on `hotfix/[VERSION]` branch
3. **Test Thoroughly**: Run full test suite + manual validation
4. **Release Patch**: Follow expedited release process
5. **Communicate**: Notify users of the issue and fix

## Emergency Release Process

For critical security or functionality issues:

1. **Skip Minor Steps**: Focus on essential testing only
2. **Fast-Track Testing**: Priority on affected functionality
3. **Immediate Release**: Bypass normal review if necessary
4. **Post-Release Validation**: Extra monitoring and testing
5. **Follow-up**: Complete documentation and process review

## Release Templates

### Changelog Entry Template

```markdown
## [VERSION] - YYYY-MM-DD

### Added
- New feature descriptions
- New MCP tools or resources

### Changed  
- Modifications to existing functionality
- Template improvements

### Fixed
- Bug fixes
- Security patches

### Breaking Changes
- API changes requiring user action
- Configuration changes
```

### Release Notes Template

```markdown
# GenSpec MCP Server v[VERSION]

Brief description of the release focus and key improvements.

## 🎉 New Features
- Feature 1 with brief description
- Feature 2 with brief description

## 🐛 Bug Fixes  
- Fix 1 description
- Fix 2 description

## 📚 Documentation
- Documentation improvements
- New examples or guides

## 🔧 Technical
- Dependencies updated
- Performance improvements

## 📦 Installation
```bash
npm install -g genspec-mcp-server@[VERSION]
```

## 🧪 Testing
This release has been tested with:
- Claude Desktop [version]
- VS Code MCP extension [version]
- Cursor [version]

Full release notes: [GitHub release link]
```

## Automation Opportunities

Consider implementing automated release workflows:

- **CI/CD Pipeline**: GitHub Actions for automated testing
- **Release Automation**: Automated npm publishing on tag push
- **Documentation Updates**: Auto-generated API docs
- **Notification Systems**: Automated user notifications

## Troubleshooting Common Release Issues

### npm publish fails

```bash
# Check authentication
npm whoami

# Login if needed
npm login

# Verify package.json
npm run build
npm pack --dry-run
```

### Version conflicts

```bash
# Check remote tags
git fetch --tags
git tag -l

# Fix local version
npm version --no-git-tag-version [VERSION]
git add package.json
git commit -m "fix: correct version number"
```

### MCP client compatibility issues

1. Test with minimal configuration
2. Check MCP protocol version compatibility
3. Validate tool and resource schemas
4. Review client-specific requirements

## Success Metrics

Track these metrics for each release:

- **Installation Success Rate**: % of successful installations
- **Client Compatibility**: % of supported clients working  
- **User Adoption**: Download count within first week
- **Issue Reports**: Number of post-release issues
- **User Satisfaction**: Community feedback and ratings

---

*This release guide should be updated as the project evolves and new insights are gained from each release cycle.*