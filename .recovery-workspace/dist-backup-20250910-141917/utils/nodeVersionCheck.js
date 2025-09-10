/**
 * Node.js Version Compatibility Check
 *
 * Brainy requires Node.js 22.x LTS for maximum stability with ONNX Runtime.
 * This prevents V8 HandleScope locking issues in worker threads.
 */
/**
 * Check if the current Node.js version is supported
 */
export function checkNodeVersion() {
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
    const versionInfo = {
        current: nodeVersion,
        major: majorVersion,
        isSupported: majorVersion === 22,
        recommendation: 'Node.js 22.x LTS'
    };
    return versionInfo;
}
/**
 * Enforce Node.js version requirement with helpful error messaging
 */
export function enforceNodeVersion() {
    const versionInfo = checkNodeVersion();
    if (!versionInfo.isSupported) {
        const errorMessage = [
            '🚨 BRAINY COMPATIBILITY ERROR',
            '━'.repeat(50),
            `❌ Current Node.js: ${versionInfo.current}`,
            `✅ Required: ${versionInfo.recommendation}`,
            '',
            '💡 Quick Fix:',
            '  nvm install 22 && nvm use 22',
            '  npm install',
            '',
            '📖 Why Node.js 22?',
            '  • Maximum ONNX Runtime stability',
            '  • Prevents V8 threading crashes',
            '  • Optimal zero-config performance',
            '',
            '🔗 More info: https://github.com/soulcraftlabs/brainy#node-version',
            '━'.repeat(50)
        ].join('\n');
        throw new Error(errorMessage);
    }
}
/**
 * Soft warning for version issues (non-blocking)
 */
export function warnNodeVersion() {
    const versionInfo = checkNodeVersion();
    if (!versionInfo.isSupported) {
        console.warn([
            '⚠️  BRAINY VERSION WARNING',
            `   Current: ${versionInfo.current}`,
            `   Recommended: ${versionInfo.recommendation}`,
            '   Consider upgrading for best stability',
            ''
        ].join('\n'));
        return false;
    }
    return true;
}
//# sourceMappingURL=nodeVersionCheck.js.map