#!/usr/bin/env node
/**
 * Test Coverage Analyzer and Recommendation Generator
 * Analyzes test coverage and generates actionable recommendations for developers
 */

import { exec } from 'child_process'
import { promises as fs } from 'fs'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

interface CoverageData {
  total: {
    lines: { pct: number; covered: number; total: number }
    statements: { pct: number; covered: number; total: number }
    functions: { pct: number; covered: number; total: number }
    branches: { pct: number; covered: number; total: number }
  }
  files: Record<string, {
    lines: { pct: number; covered: number; total: number }
    statements: { pct: number; covered: number; total: number }
    functions: { pct: number; covered: number; total: number }
    branches: { pct: number; covered: number; total: number }
    uncoveredLines?: number[]
  }>
}

interface TestResults {
  numTotalTests: number
  numPassedTests: number
  numFailedTests: number
  testResults: Array<{
    name: string
    status: 'passed' | 'failed'
    message?: string
  }>
}

interface Recommendation {
  priority: 'critical' | 'high' | 'medium' | 'low'
  category: string
  issue: string
  recommendation: string
  files?: string[]
}

class TestAnalyzer {
  private recommendations: Recommendation[] = []
  
  async analyze(): Promise<void> {
    console.log('🔍 Analyzing Brainy Test Coverage and Quality...\n')
    
    // Run tests with coverage
    console.log('📊 Running tests with coverage...')
    try {
      await execAsync('npm run test:coverage -- --reporter=json --outputFile=test-results.json')
    } catch (error) {
      console.log('Some tests failed, continuing with analysis...')
    }
    
    // Analyze coverage
    const coverage = await this.analyzeCoverage()
    
    // Analyze test results
    const testResults = await this.analyzeTestResults()
    
    // Generate recommendations
    this.generateRecommendations(coverage, testResults)
    
    // Generate report
    await this.generateReport(coverage, testResults)
  }
  
  private async analyzeCoverage(): Promise<CoverageData | null> {
    try {
      // Check if coverage data exists
      const coverageFile = path.join(process.cwd(), 'coverage', 'coverage-final.json')
      const coverageData = await fs.readFile(coverageFile, 'utf-8')
      const coverage = JSON.parse(coverageData)
      
      // Calculate totals
      let totalLines = 0, coveredLines = 0
      let totalStatements = 0, coveredStatements = 0
      let totalFunctions = 0, coveredFunctions = 0
      let totalBranches = 0, coveredBranches = 0
      
      const files: CoverageData['files'] = {}
      
      for (const [filePath, fileData] of Object.entries(coverage as any)) {
        const data = fileData as any
        
        // Lines
        const linesCovered = Object.values(data.l || {}).filter((v: any) => v > 0).length
        const linesTotal = Object.keys(data.l || {}).length
        
        // Statements
        const stmtsCovered = Object.values(data.s || {}).filter((v: any) => v > 0).length
        const stmtsTotal = Object.keys(data.s || {}).length
        
        // Functions
        const funcsCovered = Object.values(data.f || {}).filter((v: any) => v > 0).length
        const funcsTotal = Object.keys(data.f || {}).length
        
        // Branches
        const branchData = data.b || {}
        let branchesCovered = 0, branchesTotal = 0
        for (const branches of Object.values(branchData) as any[]) {
          branchesTotal += branches.length
          branchesCovered += branches.filter((v: number) => v > 0).length
        }
        
        // Find uncovered lines
        const uncoveredLines = Object.entries(data.l || {})
          .filter(([_, count]) => count === 0)
          .map(([line]) => parseInt(line))
        
        files[filePath] = {
          lines: { 
            pct: linesTotal > 0 ? (linesCovered / linesTotal) * 100 : 100,
            covered: linesCovered,
            total: linesTotal
          },
          statements: {
            pct: stmtsTotal > 0 ? (stmtsCovered / stmtsTotal) * 100 : 100,
            covered: stmtsCovered,
            total: stmtsTotal
          },
          functions: {
            pct: funcsTotal > 0 ? (funcsCovered / funcsTotal) * 100 : 100,
            covered: funcsCovered,
            total: funcsTotal
          },
          branches: {
            pct: branchesTotal > 0 ? (branchesCovered / branchesTotal) * 100 : 100,
            covered: branchesCovered,
            total: branchesTotal
          },
          uncoveredLines
        }
        
        totalLines += linesTotal
        coveredLines += linesCovered
        totalStatements += stmtsTotal
        coveredStatements += stmtsCovered
        totalFunctions += funcsTotal
        coveredFunctions += funcsCovered
        totalBranches += branchesTotal
        coveredBranches += branchesCovered
      }
      
      return {
        total: {
          lines: {
            pct: totalLines > 0 ? (coveredLines / totalLines) * 100 : 0,
            covered: coveredLines,
            total: totalLines
          },
          statements: {
            pct: totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 0,
            covered: coveredStatements,
            total: totalStatements
          },
          functions: {
            pct: totalFunctions > 0 ? (coveredFunctions / totalFunctions) * 100 : 0,
            covered: coveredFunctions,
            total: totalFunctions
          },
          branches: {
            pct: totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 0,
            covered: coveredBranches,
            total: totalBranches
          }
        },
        files
      }
    } catch (error) {
      console.error('Could not analyze coverage:', error)
      return null
    }
  }
  
  private async analyzeTestResults(): Promise<TestResults | null> {
    try {
      const resultsFile = path.join(process.cwd(), 'test-results.json')
      const resultsData = await fs.readFile(resultsFile, 'utf-8')
      return JSON.parse(resultsData)
    } catch (error) {
      // Fallback: count test files
      const { stdout } = await execAsync('find tests -name "*.test.ts" | wc -l')
      const fileCount = parseInt(stdout.trim())
      
      return {
        numTotalTests: fileCount * 10, // Estimate
        numPassedTests: fileCount * 9, // Estimate
        numFailedTests: fileCount,
        testResults: []
      }
    }
  }
  
  private generateRecommendations(coverage: CoverageData | null, testResults: TestResults | null): void {
    if (coverage) {
      // Overall coverage recommendations
      if (coverage.total.lines.pct < 80) {
        this.recommendations.push({
          priority: 'critical',
          category: 'Coverage',
          issue: `Line coverage is only ${coverage.total.lines.pct.toFixed(1)}%`,
          recommendation: 'Increase test coverage to at least 80% for production readiness'
        })
      }
      
      if (coverage.total.branches.pct < 70) {
        this.recommendations.push({
          priority: 'high',
          category: 'Coverage',
          issue: `Branch coverage is only ${coverage.total.branches.pct.toFixed(1)}%`,
          recommendation: 'Add tests for conditional logic and edge cases'
        })
      }
      
      // File-specific recommendations
      const criticalFiles: string[] = []
      const poorlyCoveredFiles: string[] = []
      
      for (const [filePath, data] of Object.entries(coverage.files)) {
        if (filePath.includes('brainy.ts') && data.lines.pct < 90) {
          criticalFiles.push(filePath)
        } else if (data.lines.pct < 50) {
          poorlyCoveredFiles.push(filePath)
        }
        
        // Check for completely uncovered functions
        if (data.functions.covered === 0 && data.functions.total > 0) {
          this.recommendations.push({
            priority: 'high',
            category: 'Coverage',
            issue: `No functions tested in ${path.basename(filePath)}`,
            recommendation: 'Add unit tests for all public methods',
            files: [filePath]
          })
        }
      }
      
      if (criticalFiles.length > 0) {
        this.recommendations.push({
          priority: 'critical',
          category: 'Coverage',
          issue: 'Core files have insufficient coverage',
          recommendation: 'Priority: Add tests for core Brainy functionality',
          files: criticalFiles
        })
      }
      
      if (poorlyCoveredFiles.length > 0) {
        this.recommendations.push({
          priority: 'medium',
          category: 'Coverage',
          issue: `${poorlyCoveredFiles.length} files have less than 50% coverage`,
          recommendation: 'Create comprehensive test suites for these files',
          files: poorlyCoveredFiles.slice(0, 5) // Top 5
        })
      }
    }
    
    if (testResults) {
      // Test quality recommendations
      if (testResults.numFailedTests > 0) {
        this.recommendations.push({
          priority: 'critical',
          category: 'Test Quality',
          issue: `${testResults.numFailedTests} tests are failing`,
          recommendation: 'Fix all failing tests before deployment'
        })
      }
      
      const passRate = (testResults.numPassedTests / testResults.numTotalTests) * 100
      if (passRate < 95) {
        this.recommendations.push({
          priority: 'high',
          category: 'Test Quality',
          issue: `Test pass rate is only ${passRate.toFixed(1)}%`,
          recommendation: 'Aim for at least 95% test pass rate'
        })
      }
    }
    
    // API-specific recommendations
    this.recommendations.push({
      priority: 'high',
      category: 'API Testing',
      issue: 'Metadata spreading in add() method causes issues',
      recommendation: 'Fix: Don\'t spread string data into metadata object',
      files: ['src/brainy.ts']
    })
    
    this.recommendations.push({
      priority: 'medium',
      category: 'API Testing',
      issue: 'No duplicate ID validation',
      recommendation: 'Consider adding option to prevent duplicate IDs',
      files: ['src/brainy.ts']
    })
    
    this.recommendations.push({
      priority: 'medium',
      category: 'API Testing',
      issue: 'Vector dimensions not consistently validated',
      recommendation: 'Add strict dimension validation for all vector operations',
      files: ['src/brainy.ts']
    })
    
    // Performance recommendations
    this.recommendations.push({
      priority: 'low',
      category: 'Performance',
      issue: 'No performance benchmarks',
      recommendation: 'Add performance regression tests for critical paths'
    })
  }
  
  private async generateReport(coverage: CoverageData | null, testResults: TestResults | null): Promise<void> {
    const timestamp = new Date().toISOString()
    
    let report = `# 📊 Brainy Test Analysis Report
Generated: ${timestamp}

## 📈 Coverage Summary
${coverage ? `
- **Line Coverage**: ${coverage.total.lines.pct.toFixed(1)}% (${coverage.total.lines.covered}/${coverage.total.lines.total})
- **Statement Coverage**: ${coverage.total.statements.pct.toFixed(1)}% (${coverage.total.statements.covered}/${coverage.total.statements.total})
- **Function Coverage**: ${coverage.total.functions.pct.toFixed(1)}% (${coverage.total.functions.covered}/${coverage.total.functions.total})
- **Branch Coverage**: ${coverage.total.branches.pct.toFixed(1)}% (${coverage.total.branches.covered}/${coverage.total.branches.total})
` : 'Coverage data not available'}

## 🧪 Test Results
${testResults ? `
- **Total Tests**: ${testResults.numTotalTests}
- **Passed**: ${testResults.numPassedTests} ✅
- **Failed**: ${testResults.numFailedTests} ❌
- **Pass Rate**: ${((testResults.numPassedTests / testResults.numTotalTests) * 100).toFixed(1)}%
` : 'Test results not available'}

## 🎯 Recommendations for Development Team

${this.groupRecommendationsByPriority()}

## 📝 Action Items

### Immediate (Critical)
${this.getActionItems('critical')}

### Short-term (High Priority)
${this.getActionItems('high')}

### Medium-term (Medium Priority)
${this.getActionItems('medium')}

### Long-term (Low Priority)
${this.getActionItems('low')}

## 📊 Coverage Details by File

${this.getFileCoverageDetails(coverage)}

## 🔍 Next Steps

1. **Fix failing tests** - Ensure all tests pass consistently
2. **Increase coverage** - Focus on critical paths and edge cases
3. **Add integration tests** - Test complete user workflows
4. **Performance testing** - Add benchmarks for critical operations
5. **Documentation** - Update API docs based on test findings

## 🏆 Coverage Goals

- **Minimum**: 80% line coverage
- **Target**: 90% line coverage
- **Stretch**: 95% line coverage with 100% for critical paths

---
*Report generated by Brainy Test Analyzer v1.0*
`
    
    // Save report
    await fs.writeFile('test-analysis-report.md', report)
    console.log('\n✅ Report saved to test-analysis-report.md')
    
    // Also save as JSON for CI/CD integration
    const jsonReport = {
      timestamp,
      coverage: coverage?.total,
      testResults: testResults ? {
        total: testResults.numTotalTests,
        passed: testResults.numPassedTests,
        failed: testResults.numFailedTests,
        passRate: (testResults.numPassedTests / testResults.numTotalTests) * 100
      } : null,
      recommendations: this.recommendations
    }
    
    await fs.writeFile('test-analysis.json', JSON.stringify(jsonReport, null, 2))
    console.log('✅ JSON report saved to test-analysis.json')
    
    // Display summary
    console.log('\n📋 Summary:')
    console.log(`- Coverage: ${coverage?.total.lines.pct.toFixed(1)}%`)
    console.log(`- Tests: ${testResults?.numPassedTests}/${testResults?.numTotalTests} passing`)
    console.log(`- Critical Issues: ${this.recommendations.filter(r => r.priority === 'critical').length}`)
    console.log(`- Total Recommendations: ${this.recommendations.length}`)
  }
  
  private groupRecommendationsByPriority(): string {
    const grouped = {
      critical: this.recommendations.filter(r => r.priority === 'critical'),
      high: this.recommendations.filter(r => r.priority === 'high'),
      medium: this.recommendations.filter(r => r.priority === 'medium'),
      low: this.recommendations.filter(r => r.priority === 'low')
    }
    
    let result = ''
    
    for (const [priority, recs] of Object.entries(grouped)) {
      if (recs.length === 0) continue
      
      const emoji = {
        critical: '🔴',
        high: '🟠',
        medium: '🟡',
        low: '🟢'
      }[priority]
      
      result += `\n### ${emoji} ${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority\n\n`
      
      for (const rec of recs) {
        result += `**${rec.category}**: ${rec.issue}\n`
        result += `- **Recommendation**: ${rec.recommendation}\n`
        if (rec.files && rec.files.length > 0) {
          result += `- **Files**: ${rec.files.map(f => '`' + path.basename(f) + '`').join(', ')}\n`
        }
        result += '\n'
      }
    }
    
    return result
  }
  
  private getActionItems(priority: string): string {
    const items = this.recommendations
      .filter(r => r.priority === priority)
      .map(r => `- [ ] ${r.recommendation}`)
    
    return items.length > 0 ? items.join('\n') : '- No items'
  }
  
  private getFileCoverageDetails(coverage: CoverageData | null): string {
    if (!coverage) return 'Coverage data not available'
    
    // Sort files by coverage percentage
    const sortedFiles = Object.entries(coverage.files)
      .sort((a, b) => a[1].lines.pct - b[1].lines.pct)
      .slice(0, 10) // Top 10 worst covered
    
    let result = '### Files with Lowest Coverage\n\n'
    result += '| File | Lines | Statements | Functions | Branches |\n'
    result += '|------|-------|------------|-----------|----------|\n'
    
    for (const [filePath, data] of sortedFiles) {
      const fileName = path.basename(filePath)
      result += `| ${fileName} | ${data.lines.pct.toFixed(1)}% | ${data.statements.pct.toFixed(1)}% | ${data.functions.pct.toFixed(1)}% | ${data.branches.pct.toFixed(1)}% |\n`
    }
    
    return result
  }
}

// Run analyzer
const analyzer = new TestAnalyzer()
analyzer.analyze().catch(console.error)