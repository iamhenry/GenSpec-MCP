#!/usr/bin/env node

/**
 * GenSpec MCP Server - Installation Test
 * 
 * Automated test to validate proper installation and basic functionality
 * Run after: npm install -g genspec-mcp-server
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// ANSI color codes for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.bold}${colors.blue}${msg}${colors.reset}`)
};

class InstallationTester {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      warnings: 0
    };
    this.packageName = 'genspec-mcp-server';
  }

  async runAllTests() {
    log.header('🚀 GenSpec MCP Server Installation Test');
    log.info('Validating installation and basic functionality...\n');

    try {
      await this.testNodeVersion();
      await this.testNpmVersion();
      await this.testPackageInstallation();
      await this.testEntryPoint();
      await this.testTemplateFiles();
      await this.testDirectoryStructure();
      await this.testBinaryAccess();
      await this.testMCPServerBasics();
      
      this.printSummary();
      
      if (this.testResults.failed > 0) {
        process.exit(1);
      }
      
    } catch (error) {
      log.error(`Fatal error during testing: ${error.message}`);
      process.exit(1);
    }
  }

  async testNodeVersion() {
    log.header('Testing Node.js Version');
    
    try {
      const version = process.version;
      const majorVersion = parseInt(version.slice(1).split('.')[0]);
      
      if (majorVersion >= 18) {
        log.success(`Node.js version ${version} meets requirements (18+)`);
        this.testResults.passed++;
      } else {
        log.error(`Node.js version ${version} is too old. Required: 18+`);
        this.testResults.failed++;
      }
    } catch (error) {
      log.error(`Could not determine Node.js version: ${error.message}`);
      this.testResults.failed++;
    }
  }

  async testNpmVersion() {
    log.header('Testing npm Version');
    
    return new Promise((resolve) => {
      const npm = spawn('npm', ['--version'], { stdio: 'pipe' });
      let output = '';
      
      npm.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      npm.on('close', (code) => {
        if (code === 0) {
          const version = output.trim();
          const majorVersion = parseInt(version.split('.')[0]);
          
          if (majorVersion >= 8) {
            log.success(`npm version ${version} meets requirements (8+)`);
            this.testResults.passed++;
          } else {
            log.error(`npm version ${version} is too old. Required: 8+`);
            this.testResults.failed++;
          }
        } else {
          log.error('Could not determine npm version');
          this.testResults.failed++;
        }
        resolve();
      });
    });
  }

  async testPackageInstallation() {
    log.header('Testing Package Installation');
    
    return new Promise((resolve) => {
      const npm = spawn('npm', ['list', '-g', this.packageName], { stdio: 'pipe' });
      let output = '';
      let errorOutput = '';
      
      npm.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      npm.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      npm.on('close', (code) => {
        if (output.includes(this.packageName)) {
          log.success(`Package ${this.packageName} is installed globally`);
          this.testResults.passed++;
        } else {
          log.error(`Package ${this.packageName} not found in global installations`);
          log.info('Try running: npm install -g genspec-mcp-server');
          this.testResults.failed++;
        }
        resolve();
      });
    });
  }

  async testEntryPoint() {
    log.header('Testing Entry Point');
    
    try {
      // Try to resolve the main entry point
      const packagePath = path.dirname(require.resolve(this.packageName + '/package.json'));
      const packageJson = JSON.parse(fs.readFileSync(path.join(packagePath, 'package.json'), 'utf8'));
      
      if (packageJson.main) {
        const mainFile = path.join(packagePath, packageJson.main);
        if (fs.existsSync(mainFile)) {
          log.success(`Entry point ${packageJson.main} exists`);
          this.testResults.passed++;
        } else {
          log.error(`Entry point ${packageJson.main} not found`);
          this.testResults.failed++;
        }
      } else if (packageJson.bin) {
        const binFile = typeof packageJson.bin === 'string' ? 
          packageJson.bin : 
          packageJson.bin[this.packageName] || Object.values(packageJson.bin)[0];
          
        const fullBinPath = path.join(packagePath, binFile);
        if (fs.existsSync(fullBinPath)) {
          log.success(`Binary entry point ${binFile} exists`);
          this.testResults.passed++;
        } else {
          log.error(`Binary entry point ${binFile} not found`);
          this.testResults.failed++;
        }
      } else {
        log.error('No main or bin entry point defined in package.json');
        this.testResults.failed++;
      }
    } catch (error) {
      log.error(`Could not test entry point: ${error.message}`);
      this.testResults.failed++;
    }
  }

  async testTemplateFiles() {
    log.header('Testing Template Files');
    
    const requiredTemplates = [
      '1-generate-readme.md',
      '2-generate-roadmap.md', 
      '3-generate-system-architecture.md'
    ];
    
    try {
      const packagePath = path.dirname(require.resolve(this.packageName + '/package.json'));
      const templatesDir = path.join(packagePath, 'templates');
      
      if (!fs.existsSync(templatesDir)) {
        log.error('Templates directory not found');
        this.testResults.failed++;
        return;
      }
      
      log.success('Templates directory exists');
      
      for (const template of requiredTemplates) {
        const templatePath = path.join(templatesDir, template);
        if (fs.existsSync(templatePath)) {
          const stats = fs.statSync(templatePath);
          if (stats.size > 0) {
            log.success(`Template ${template} exists and has content`);
            this.testResults.passed++;
          } else {
            log.warn(`Template ${template} exists but is empty`);
            this.testResults.warnings++;
          }
        } else {
          log.error(`Template ${template} not found`);
          this.testResults.failed++;
        }
      }
    } catch (error) {
      log.error(`Could not test template files: ${error.message}`);
      this.testResults.failed++;
    }
  }

  async testDirectoryStructure() {
    log.header('Testing Directory Structure');
    
    try {
      const packagePath = path.dirname(require.resolve(this.packageName + '/package.json'));
      
      const requiredDirs = ['dist', 'templates'];
      const optionalDirs = ['src', 'lib'];
      
      for (const dir of requiredDirs) {
        const dirPath = path.join(packagePath, dir);
        if (fs.existsSync(dirPath)) {
          log.success(`Required directory ${dir}/ exists`);
          this.testResults.passed++;
        } else {
          log.error(`Required directory ${dir}/ not found`);
          this.testResults.failed++;
        }
      }
      
      for (const dir of optionalDirs) {
        const dirPath = path.join(packagePath, dir);
        if (fs.existsSync(dirPath)) {
          log.info(`Optional directory ${dir}/ found`);
        }
      }
      
    } catch (error) {
      log.error(`Could not test directory structure: ${error.message}`);
      this.testResults.failed++;
    }
  }

  async testBinaryAccess() {
    log.header('Testing Binary Access');
    
    return new Promise((resolve) => {
      const which = spawn('which', [this.packageName], { stdio: 'pipe' });
      let output = '';
      
      which.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      which.on('close', (code) => {
        if (code === 0 && output.trim()) {
          log.success(`Binary ${this.packageName} is accessible in PATH`);
          log.info(`Located at: ${output.trim()}`);
          this.testResults.passed++;
        } else {
          log.warn(`Binary ${this.packageName} not found in PATH`);
          log.info('This might be expected if installed as a library only');
          this.testResults.warnings++;
        }
        resolve();
      });
    });
  }

  async testMCPServerBasics() {
    log.header('Testing MCP Server Basics');
    
    try {
      const packagePath = path.dirname(require.resolve(this.packageName + '/package.json'));
      const packageJson = JSON.parse(fs.readFileSync(path.join(packagePath, 'package.json'), 'utf8'));
      
      // Check for MCP dependencies
      const allDeps = {
        ...packageJson.dependencies || {},
        ...packageJson.devDependencies || {},
        ...packageJson.peerDependencies || {}
      };
      
      if (allDeps['@modelcontextprotocol/sdk']) {
        log.success('MCP SDK dependency found');
        this.testResults.passed++;
      } else {
        log.error('MCP SDK dependency not found');
        this.testResults.failed++;
      }
      
      // Check package metadata
      if (packageJson.name === this.packageName) {
        log.success('Package name matches expected');
        this.testResults.passed++;
      } else {
        log.error(`Package name mismatch. Expected: ${this.packageName}, Found: ${packageJson.name}`);
        this.testResults.failed++;
      }
      
      if (packageJson.description) {
        log.success('Package has description');
        this.testResults.passed++;
      } else {
        log.warn('Package missing description');
        this.testResults.warnings++;
      }
      
    } catch (error) {
      log.error(`Could not test MCP server basics: ${error.message}`);
      this.testResults.failed++;
    }
  }

  printSummary() {
    log.header('📊 Test Summary');
    
    const total = this.testResults.passed + this.testResults.failed + this.testResults.warnings;
    
    log.info(`Total tests: ${total}`);
    log.success(`Passed: ${this.testResults.passed}`);
    
    if (this.testResults.warnings > 0) {
      log.warn(`Warnings: ${this.testResults.warnings}`);
    }
    
    if (this.testResults.failed > 0) {
      log.error(`Failed: ${this.testResults.failed}`);
    } else {
      log.success('All critical tests passed! ✨');
    }
    
    if (this.testResults.failed === 0) {
      console.log('\n🎉 Installation validation complete!');
      console.log('\nNext steps:');
      console.log('1. Create a USER-STORIES.md file in your project');
      console.log('2. Configure your MCP client (Claude Desktop, VS Code, etc.)');
      console.log('3. Run: start_genspec');
      console.log('\nFor detailed setup instructions, see: README.md');
    } else {
      console.log('\n❌ Installation has issues that need to be resolved.');
      console.log('Please check the errors above and reinstall if necessary.');
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new InstallationTester();
  tester.runAllTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = InstallationTester;