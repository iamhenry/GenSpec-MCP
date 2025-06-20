#!/usr/bin/env node

/**
 * GenSpec MCP Server Installation Test
 * 
 * This script validates that the GenSpec MCP server is properly installed
 * and configured. It tests the build process, entry point, template files,
 * and basic functionality.
 */

import { promises as fs } from 'fs';
import { resolve, join } from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');

class InstallationTester {
  constructor() {
    this.testResults = [];
    this.errors = [];
    this.projectRoot = __dirname;
  }

  /**
   * Run all installation tests
   */
  async runTests() {
    console.log('🚀 GenSpec MCP Server Installation Test');
    console.log('==========================================\n');

    try {
      await this.testProjectStructure();
      await this.testPackageJson();
      await this.testBuildProcess();
      await this.testEntryPoint();
      await this.testTemplateFiles();
      await this.testTypeScript();
      await this.testMCPCapabilities();
      
      this.printResults();
      
      if (this.errors.length === 0) {
        console.log('\n✅ All tests passed! GenSpec MCP server is ready for use.');
        process.exit(0);
      } else {
        console.log(`\n❌ ${this.errors.length} test(s) failed. Please fix the issues above.`);
        process.exit(1);
      }
    } catch (error) {
      console.error('💥 Test runner crashed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Test project structure and required files
   */
  async testProjectStructure() {
    const testName = 'Project Structure';
    const requiredFiles = [
      'package.json',
      'tsconfig.json',
      'src/index.ts',
      'src/server.ts',
      'src/types.ts',
      'templates/1-generate-readme.md',
      'templates/2-generate-roadmap.md',
      'templates/3-generate-system-architecture.md',
      'README.md'
    ];

    const requiredDirs = [
      'src',
      'templates'
    ];

    try {
      // Check required files
      for (const file of requiredFiles) {
        const filePath = join(this.projectRoot, file);
        await fs.access(filePath);
      }

      // Check required directories
      for (const dir of requiredDirs) {
        const dirPath = join(this.projectRoot, dir);
        const stat = await fs.stat(dirPath);
        if (!stat.isDirectory()) {
          throw new Error(`${dir} is not a directory`);
        }
      }

      this.pass(testName, 'All required files and directories exist');
    } catch (error) {
      this.fail(testName, error.message);
    }
  }

  /**
   * Test package.json configuration
   */
  async testPackageJson() {
    const testName = 'Package Configuration';
    
    try {
      const packagePath = join(this.projectRoot, 'package.json');
      const packageContent = await fs.readFile(packagePath, 'utf8');
      const packageJson = JSON.parse(packageContent);

      // Required fields
      const requiredFields = ['name', 'version', 'main', 'type', 'scripts'];
      for (const field of requiredFields) {
        if (!packageJson[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // Check main entry point
      if (packageJson.main !== 'dist/index.js') {
        throw new Error(`Main entry point should be 'dist/index.js', got '${packageJson.main}'`);
      }

      // Check module type
      if (packageJson.type !== 'module') {
        throw new Error(`Package type should be 'module', got '${packageJson.type}'`);
      }

      // Check required scripts
      const requiredScripts = ['build', 'start'];
      for (const script of requiredScripts) {
        if (!packageJson.scripts[script]) {
          throw new Error(`Missing required script: ${script}`);
        }
      }

      // Check dependencies
      const requiredDeps = ['@modelcontextprotocol/sdk', 'typescript', 'tsx'];
      for (const dep of requiredDeps) {
        if (!packageJson.dependencies[dep]) {
          throw new Error(`Missing required dependency: ${dep}`);
        }
      }

      // Check files array
      if (!packageJson.files || !Array.isArray(packageJson.files)) {
        throw new Error('Missing or invalid files array');
      }

      const requiredFiles = ['dist/', 'templates/', 'README.md'];
      for (const file of requiredFiles) {
        if (!packageJson.files.includes(file)) {
          throw new Error(`Missing file in package files: ${file}`);
        }
      }

      this.pass(testName, 'Package.json is properly configured');
    } catch (error) {
      this.fail(testName, error.message);
    }
  }

  /**
   * Test TypeScript build process
   */
  async testBuildProcess() {
    const testName = 'Build Process';
    
    try {
      // Clean dist directory
      const distPath = join(this.projectRoot, 'dist');
      try {
        await fs.rm(distPath, { recursive: true, force: true });
      } catch (error) {
        // Directory might not exist, that's ok
      }

      // Run build
      await this.runCommand('npm', ['run', 'build'], 'Build failed');

      // Check that dist files were created
      const expectedFiles = ['index.js', 'server.js', 'types.js'];
      for (const file of expectedFiles) {
        const filePath = join(distPath, file);
        await fs.access(filePath);
      }

      this.pass(testName, 'TypeScript compilation successful');
    } catch (error) {
      this.fail(testName, error.message);
    }
  }

  /**
   * Test entry point validity
   */
  async testEntryPoint() {
    const testName = 'Entry Point';
    
    try {
      const entryPath = join(this.projectRoot, 'dist/index.js');
      await fs.access(entryPath);

      // Try to import the entry point (basic syntax check)
      const entryContent = await fs.readFile(entryPath, 'utf8');
      
      // Check for basic MCP server patterns
      if (!entryContent.includes('@modelcontextprotocol/sdk')) {
        throw new Error('Entry point does not import MCP SDK');
      }

      this.pass(testName, 'Entry point is valid');
    } catch (error) {
      this.fail(testName, error.message);
    }
  }

  /**
   * Test template files
   */
  async testTemplateFiles() {
    const testName = 'Template Files';
    
    try {
      const templateDir = join(this.projectRoot, 'templates');
      const expectedTemplates = [
        '1-generate-readme.md',
        '2-generate-roadmap.md', 
        '3-generate-system-architecture.md'
      ];

      for (const template of expectedTemplates) {
        const templatePath = join(templateDir, template);
        await fs.access(templatePath);
        
        // Check that template has content
        const content = await fs.readFile(templatePath, 'utf8');
        if (content.trim().length === 0) {
          throw new Error(`Template ${template} is empty`);
        }
      }

      this.pass(testName, 'All template files exist and have content');
    } catch (error) {
      this.fail(testName, error.message);
    }
  }

  /**
   * Test TypeScript configuration
   */
  async testTypeScript() {
    const testName = 'TypeScript Configuration';
    
    try {
      const tsconfigPath = join(this.projectRoot, 'tsconfig.json');
      const tsconfigContent = await fs.readFile(tsconfigPath, 'utf8');
      const tsconfig = JSON.parse(tsconfigContent);

      // Check compiler options
      if (!tsconfig.compilerOptions) {
        throw new Error('Missing compilerOptions in tsconfig.json');
      }

      const requiredOptions = ['target', 'module', 'outDir'];
      for (const option of requiredOptions) {
        if (!tsconfig.compilerOptions[option]) {
          throw new Error(`Missing compiler option: ${option}`);
        }
      }

      this.pass(testName, 'TypeScript configuration is valid');
    } catch (error) {
      this.fail(testName, error.message);
    }
  }

  /**
   * Test MCP capabilities (basic validation)
   */
  async testMCPCapabilities() {
    const testName = 'MCP Capabilities';
    
    try {
      const serverPath = join(this.projectRoot, 'src/server.ts');
      const serverContent = await fs.readFile(serverPath, 'utf8');

      // Check for required MCP handlers
      const requiredHandlers = [
        'ListPromptsRequestSchema',
        'GetPromptRequestSchema',
        'ListResourcesRequestSchema',
        'ReadResourceRequestSchema',
        'ListToolsRequestSchema',
        'CallToolRequestSchema'
      ];

      for (const handler of requiredHandlers) {
        if (!serverContent.includes(handler)) {
          throw new Error(`Missing MCP handler: ${handler}`);
        }
      }

      // Check for required MCP tools
      const requiredTools = [
        'start_genspec',
        'generate_readme',
        'generate_roadmap',
        'generate_architecture'
      ];

      for (const tool of requiredTools) {
        if (!serverContent.includes(tool)) {
          throw new Error(`Missing MCP tool: ${tool}`);
        }
      }

      this.pass(testName, 'MCP capabilities are properly implemented');
    } catch (error) {
      this.fail(testName, error.message);
    }
  }

  /**
   * Run a command and return promise
   */
  async runCommand(command, args, errorMessage) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: this.projectRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: process.platform === 'win32'
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`${errorMessage}: ${stderr || stdout}`));
        } else {
          resolve(stdout);
        }
      });

      child.on('error', (error) => {
        reject(new Error(`${errorMessage}: ${error.message}`));
      });
    });
  }

  /**
   * Record a passing test
   */
  pass(testName, message) {
    this.testResults.push({ name: testName, status: 'PASS', message });
    console.log(`✅ ${testName}: ${message}`);
  }

  /**
   * Record a failing test
   */
  fail(testName, message) {
    this.testResults.push({ name: testName, status: 'FAIL', message });
    this.errors.push({ name: testName, message });
    console.log(`❌ ${testName}: ${message}`);
  }

  /**
   * Print test results summary
   */
  printResults() {
    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    
    console.log('\n📊 Test Results Summary');
    console.log('=======================');
    console.log(`Total tests: ${this.testResults.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    
    if (failed > 0) {
      console.log('\n💥 Failed Tests:');
      this.errors.forEach(error => {
        console.log(`  - ${error.name}: ${error.message}`);
      });
    }
  }
}

// Run the tests
const tester = new InstallationTester();
tester.runTests().catch(error => {
  console.error('💥 Test execution failed:', error.message);
  process.exit(1);
});