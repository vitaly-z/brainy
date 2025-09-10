/**
 * Version utilities for Brainy
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
// Get package.json path relative to this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, '../../package.json');
let cachedVersion = null;
/**
 * Get the current Brainy package version
 * @returns The current version string
 */
export function getBrainyVersion() {
    if (!cachedVersion) {
        try {
            const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
            cachedVersion = packageJson.version;
        }
        catch {
            // Fallback version if package.json can't be read
            cachedVersion = '2.7.1';
        }
    }
    return cachedVersion;
}
/**
 * Get version information for augmentation metadata
 * @param service The service/augmentation name
 * @returns Version metadata object
 */
export function getAugmentationVersion(service) {
    return {
        augmentation: service,
        version: getBrainyVersion()
    };
}
//# sourceMappingURL=version.js.map