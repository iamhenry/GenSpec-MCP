# GenSpec MCP Server Release Process

This document outlines the complete release process for the GenSpec MCP Server, including pre-release preparation, release execution, and post-release activities.

## Release Checklist Overview

- [ ] **Pre-Release** - Code quality, testing, documentation
- [ ] **Release** - Version management, publishing, tagging
- [ ] **Post-Release** - Verification, communication, maintenance

## Pre-Release Phase

### Code Quality & Testing

- [ ] **Run Full Test Suite**
  ```bash
  npm test
  npm run test-install.js
  ```

- [ ] **Code Quality Check**
  - [ ] All TypeScript files compile without errors
  - [ ] No eslint warnings or errors (if configured)
  - [ ] All TODO/FIXME comments addressed or documented

- [ ] **Build Verification**
  ```bash
  npm run build
  # Ensure dist/ directory is properly generated
  ls -la dist/
  ```

- [ ] **Template Validation**
  - [ ] All templates in templates/ directory are present
  - [ ] Template content is valid and up-to-date
  - [ ] Template URIs match phase mappings in types.ts

### Integration Testing

- [ ] **MCP Client Testing**
  - [ ] Test with Claude Desktop
  - [ ] Test with VS Code MCP extension
  - [ ] Test with Cursor (if available)

- [ ] **Workflow Testing**
  - [ ] Test complete workflow: start_genspec
  - [ ] Test individual phases: generate_readme, generate_roadmap, generate_architecture
  - [ ] Test approval/edit cycles
  - [ ] Test error handling and validation

- [ ] **Installation Testing**
  - [ ] Clean install in fresh environment
  - [ ] Global installation via npm
  - [ ] Test entry point execution
  - [ ] Verify all dependencies are properly included

### Documentation Review

- [ ] **README.md**
  - [ ] Installation instructions are current
  - [ ] MCP client examples are tested
  - [ ] Troubleshooting section is comprehensive
  - [ ] Feature list matches current capabilities

- [ ] **API Documentation**
  - [ ] Tool descriptions are accurate
  - [ ] Prompt documentation is complete
  - [ ] Resource URI scheme is documented
  - [ ] Input/output schemas are current

- [ ] **Code Documentation**
  - [ ] JSDoc comments are complete
  - [ ] Type definitions are documented
  - [ ] Integration points are clear

### Version Preparation

- [ ] **Version Number Decision**
  - Major version (X.0.0): Breaking changes, new architecture
  - Minor version (X.Y.0): New features, backward compatible
  - Patch version (X.Y.Z): Bug fixes, no new features

- [ ] **Change Log Preparation**
  - [ ] Document all changes since last release
  - [ ] Categorize: Features, Bug Fixes, Breaking Changes, Internal
  - [ ] Include migration instructions if needed

- [ ] **Dependency Review**
  - [ ] Update dependencies to latest stable versions
  - [ ] Check for security vulnerabilities
  - [ ] Test with updated dependencies

## Release Phase

### Version Management

- [ ] **Update Version**
  ```bash
  npm version [major|minor|patch]
  # This updates package.json and creates a git tag
  ```

- [ ] **Verify Version Update**
  - [ ] package.json version is updated
  - [ ] Git tag is created
  - [ ] No uncommitted changes

### Pre-Publication Validation

- [ ] **Final Build Test**
  ```bash
  npm run build
  npm test
  ```

- [ ] **Package Content Verification**
  ```bash
  npm pack --dry-run
  # Review what files will be included in the package
  ```

- [ ] **Local Installation Test**
  ```bash
  npm pack
  npm install -g genspec-mcp-*.tgz
  # Test the actual package that will be published
  ```

### NPM Publishing

- [ ] **Login to NPM**
  ```bash
  npm login
  # Ensure you're logged in with proper permissions
  ```

- [ ] **Publish to NPM**
  ```bash
  npm publish
  # For beta releases: npm publish --tag beta
  ```

- [ ] **Verify Publication**
  - [ ] Check package on npmjs.com
  - [ ] Verify downloadable and installable
  - [ ] Test installation from npm registry

### Git Repository Management

- [ ] **Push Release**
  ```bash
  git push origin main
  git push origin --tags
  ```

- [ ] **Create GitHub Release**
  - [ ] Use the git tag created by npm version
  - [ ] Include release notes from changelog
  - [ ] Upload any additional assets if needed

## Post-Release Phase

### Verification

- [ ] **Installation Verification**
  ```bash
  # Test global installation from npm
  npm install -g genspec-mcp
  genspec-mcp --version
  ```

- [ ] **MCP Client Integration**
  - [ ] Test installation in fresh Claude Desktop config
  - [ ] Verify tools and prompts are available
  - [ ] Run basic workflow test

- [ ] **Documentation Updates**
  - [ ] Update any external documentation
  - [ ] Update integration examples if needed
  - [ ] Notify documentation sites if applicable

### Communication

- [ ] **Release Announcement**
  - [ ] Update project README with latest version info
  - [ ] Post to relevant communities/forums
  - [ ] Update social media if applicable

- [ ] **User Notification**
  - [ ] Notify existing users of the update
  - [ ] Highlight breaking changes or important updates
  - [ ] Provide migration instructions if needed

### Monitoring

- [ ] **Monitor for Issues**
  - [ ] Watch for installation problems
  - [ ] Monitor error reports
  - [ ] Check community feedback

- [ ] **Performance Monitoring**
  - [ ] Monitor npm download stats
  - [ ] Track user adoption
  - [ ] Watch for performance issues

## Hotfix Process

For critical issues that need immediate release:

### Hotfix Preparation

- [ ] **Create Hotfix Branch**
  ```bash
  git checkout -b hotfix/issue-description
  ```

- [ ] **Fix Issue**
  - [ ] Make minimal changes to address the issue
  - [ ] Add test case for the fix
  - [ ] Update documentation if needed

- [ ] **Test Hotfix**
  ```bash
  npm test
  npm run build
  # Test only the affected functionality
  ```

### Hotfix Release

- [ ] **Merge to Main**
  ```bash
  git checkout main
  git merge hotfix/issue-description
  ```

- [ ] **Release Process**
  - [ ] Follow abbreviated release process
  - [ ] Use patch version increment
  - [ ] Fast-track testing for critical path only

- [ ] **Communication**
  - [ ] Immediate notification of hotfix
  - [ ] Clear description of what was fixed
  - [ ] Recommendation for immediate update

## Version Management Strategy

### Semantic Versioning

- **MAJOR** (X.0.0): Incompatible API changes
  - MCP protocol breaking changes
  - Tool interface changes
  - Removal of features

- **MINOR** (X.Y.0): Backward compatible functionality
  - New tools or prompts
  - New features
  - Enhanced capabilities

- **PATCH** (X.Y.Z): Backward compatible bug fixes
  - Bug fixes
  - Security patches
  - Documentation updates

### Release Frequency

- **Regular Releases**: Monthly minor releases for new features
- **Patch Releases**: As needed for bug fixes
- **Major Releases**: Quarterly or when breaking changes accumulate

## Rollback Procedure

If a release causes critical issues:

### Immediate Actions

- [ ] **Assess Impact**
  - [ ] Identify scope of the problem
  - [ ] Determine if rollback is necessary
  - [ ] Consider hotfix vs. rollback

- [ ] **NPM Deprecation**
  ```bash
  npm deprecate genspec-mcp@version "Critical issue, please downgrade"
  ```

- [ ] **Communication**
  - [ ] Immediate notification to users
  - [ ] Clear instructions for downgrade
  - [ ] Timeline for fix

### Rollback Execution

- [ ] **Revert Changes**
  ```bash
  git revert [commit-hash]
  npm version patch
  npm publish
  ```

- [ ] **Verify Rollback**
  - [ ] Test reverted version
  - [ ] Confirm issues are resolved
  - [ ] Update documentation

## Release Automation

### GitHub Actions (Future Enhancement)

Consider implementing automated release pipeline:

- Automated testing on PR merge
- Automated version bumping
- Automated npm publishing
- Automated GitHub release creation

### Quality Gates

- All tests must pass
- Code coverage thresholds met
- No critical security vulnerabilities
- Documentation is up-to-date

## Contact Information

For release-related questions or issues:

- **Release Manager**: [To be defined]
- **Technical Lead**: [To be defined]
- **Documentation**: [To be defined]

## Release History

### Version 1.0.0 (Initial Release)
- **Date**: [To be filled]
- **Features**: Initial MCP server implementation
- **Changes**: N/A (initial release)
- **Known Issues**: [To be documented]

---

*This document should be updated with each release to reflect lessons learned and process improvements.*