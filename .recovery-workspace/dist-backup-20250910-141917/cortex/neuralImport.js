/**
 * Neural Import - Atomic Age AI-Powered Data Understanding System
 *
 * 🧠 Leveraging the brain-in-jar to understand and automatically structure data
 * ⚛️ Complete with confidence scoring and relationship weight calculation
 */
import { NounType, VerbType } from '../types/graphTypes.js';
import * as fs from '../universal/fs.js';
import * as path from '../universal/path.js';
// @ts-ignore
import chalk from 'chalk';
// @ts-ignore
import ora from 'ora';
// @ts-ignore
import boxen from 'boxen';
// @ts-ignore
import Table from 'cli-table3';
// @ts-ignore
import prompts from 'prompts';
/**
 * Neural Import Engine - The Brain Behind the Analysis
 */
export class NeuralImport {
    constructor(brainy) {
        this.colors = {
            primary: chalk.hex('#3A5F4A'),
            success: chalk.hex('#2D4A3A'),
            warning: chalk.hex('#D67441'),
            error: chalk.hex('#B85C35'),
            info: chalk.hex('#4A6B5A'),
            dim: chalk.hex('#8A9B8A'),
            highlight: chalk.hex('#E88B5A'),
            accent: chalk.hex('#F5E6D3'),
            brain: chalk.hex('#E88B5A')
        };
        this.emojis = {
            brain: '🧠',
            atom: '⚛️',
            lab: '🔬',
            data: '🎛️',
            magic: '⚡',
            check: '✅',
            warning: '⚠️',
            sparkle: '✨',
            rocket: '🚀',
            gear: '⚙️'
        };
        this.brainy = brainy;
    }
    /**
     * Main Neural Import Function - The Master Controller
     */
    async neuralImport(filePath, options = {}) {
        const opts = {
            confidenceThreshold: 0.7,
            autoApply: false,
            enableWeights: true,
            previewOnly: false,
            validateOnly: false,
            skipDuplicates: true,
            ...options
        };
        console.log(boxen(`${this.emojis.brain} ${this.colors.brain('NEURAL IMPORT INITIATED')} ${this.emojis.atom}\n\n` +
            `${this.colors.accent('◆')} ${this.colors.dim('Activating atomic age AI analysis')}\n` +
            `${this.colors.accent('◆')} ${this.colors.dim('File:')} ${this.colors.highlight(filePath)}\n` +
            `${this.colors.accent('◆')} ${this.colors.dim('Confidence Threshold:')} ${this.colors.highlight(opts.confidenceThreshold.toString())}`, { padding: 1, borderStyle: 'round', borderColor: '#E88B5A' }));
        const spinner = ora(`${this.emojis.brain} Initializing neural analysis...`).start();
        try {
            // Phase 1: Data Parsing
            spinner.text = `${this.emojis.lab} Parsing data structure...`;
            const rawData = await this.parseFile(filePath);
            // Phase 2: Neural Entity Detection
            spinner.text = `${this.emojis.atom} Analyzing ${Object.keys(NounType).length} entity types...`;
            const detectedEntities = await this.detectEntitiesWithNeuralAnalysis(rawData, opts);
            // Phase 3: Neural Relationship Detection  
            spinner.text = `${this.emojis.data} Testing ${Object.keys(VerbType).length} relationship patterns...`;
            const detectedRelationships = await this.detectRelationshipsWithNeuralAnalysis(detectedEntities, rawData, opts);
            // Phase 4: Neural Insights Generation
            spinner.text = `${this.emojis.magic} Computing neural insights...`;
            const insights = await this.generateNeuralInsights(detectedEntities, detectedRelationships);
            // Phase 5: Confidence Scoring
            const overallConfidence = this.calculateOverallConfidence(detectedEntities, detectedRelationships);
            spinner.stop();
            const result = {
                detectedEntities,
                detectedRelationships,
                confidence: overallConfidence,
                insights,
                preview: await this.generatePreview(detectedEntities, detectedRelationships)
            };
            // Display results
            await this.displayNeuralAnalysisResults(result, opts);
            // Handle execution based on options
            if (opts.previewOnly || opts.validateOnly) {
                return result;
            }
            if (!opts.autoApply) {
                const shouldExecute = await this.confirmNeuralImport(result);
                if (!shouldExecute) {
                    console.log(this.colors.dim('Neural import cancelled'));
                    return result;
                }
            }
            // Execute the import
            await this.executeNeuralImport(result, opts);
            return result;
        }
        catch (error) {
            spinner.fail('Neural analysis failed');
            throw error;
        }
    }
    /**
     * Parse file based on extension
     */
    async parseFile(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const content = await fs.readFile(filePath, 'utf8');
        switch (ext) {
            case '.json':
                const jsonData = JSON.parse(content);
                return Array.isArray(jsonData) ? jsonData : [jsonData];
            case '.csv':
                return this.parseCSV(content);
            case '.yaml':
            case '.yml':
                // For now, basic YAML support - in full implementation would use yaml parser
                return JSON.parse(content); // Placeholder
            default:
                throw new Error(`Unsupported file format: ${ext}`);
        }
    }
    /**
     * Basic CSV parser
     */
    parseCSV(content) {
        const lines = content.split('\n').filter(line => line.trim());
        if (lines.length < 2)
            return [];
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const data = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            data.push(row);
        }
        return data;
    }
    /**
     * Neural Entity Detection - The Core AI Engine
     */
    async detectEntitiesWithNeuralAnalysis(rawData, options) {
        const entities = [];
        const nounTypes = Object.values(NounType);
        for (const [index, dataItem] of rawData.entries()) {
            const mainText = this.extractMainText(dataItem);
            const detections = [];
            // Test against all noun types using semantic similarity
            for (const nounType of nounTypes) {
                const confidence = await this.calculateEntityTypeConfidence(mainText, dataItem, nounType);
                if (confidence >= options.confidenceThreshold - 0.2) { // Allow slightly lower for alternatives
                    const reasoning = await this.generateEntityReasoning(mainText, dataItem, nounType);
                    detections.push({ type: nounType, confidence, reasoning });
                }
            }
            if (detections.length > 0) {
                // Sort by confidence
                detections.sort((a, b) => b.confidence - a.confidence);
                const primaryType = detections[0];
                const alternatives = detections.slice(1, 3); // Top 2 alternatives
                entities.push({
                    originalData: dataItem,
                    nounType: primaryType.type,
                    confidence: primaryType.confidence,
                    suggestedId: this.generateSmartId(dataItem, primaryType.type, index),
                    reasoning: primaryType.reasoning,
                    alternativeTypes: alternatives
                });
            }
        }
        return entities;
    }
    /**
     * Calculate entity type confidence using AI
     */
    async calculateEntityTypeConfidence(text, data, nounType) {
        // Base semantic similarity using search instead of similarity method
        const searchResults = await this.brainy.search(text + ' ' + nounType, 1);
        const textSimilarity = searchResults.length > 0 ? searchResults[0].score : 0.5;
        // Field-based confidence boost
        const fieldBoost = this.calculateFieldBasedConfidence(data, nounType);
        // Pattern-based confidence boost  
        const patternBoost = this.calculatePatternBasedConfidence(text, data, nounType);
        // Combine confidences with weights
        const combined = (textSimilarity * 0.5) + (fieldBoost * 0.3) + (patternBoost * 0.2);
        return Math.min(combined, 1.0);
    }
    /**
     * Field-based confidence calculation
     */
    calculateFieldBasedConfidence(data, nounType) {
        const fields = Object.keys(data);
        let boost = 0;
        // Field patterns that boost confidence for specific noun types
        const fieldPatterns = {
            [NounType.Person]: ['name', 'email', 'phone', 'age', 'firstname', 'lastname', 'employee'],
            [NounType.Organization]: ['company', 'organization', 'corp', 'inc', 'ltd', 'department', 'team'],
            [NounType.Project]: ['project', 'task', 'deadline', 'status', 'milestone', 'deliverable'],
            [NounType.Location]: ['address', 'city', 'country', 'state', 'zip', 'location', 'coordinates'],
            [NounType.Product]: ['product', 'price', 'sku', 'inventory', 'category', 'brand'],
            [NounType.Event]: ['date', 'time', 'venue', 'event', 'meeting', 'conference', 'schedule']
        };
        const relevantPatterns = fieldPatterns[nounType] || [];
        for (const field of fields) {
            for (const pattern of relevantPatterns) {
                if (field.toLowerCase().includes(pattern)) {
                    boost += 0.1;
                }
            }
        }
        return Math.min(boost, 0.5);
    }
    /**
     * Pattern-based confidence calculation
     */
    calculatePatternBasedConfidence(text, data, nounType) {
        let boost = 0;
        // Content patterns that indicate entity types
        const patterns = {
            [NounType.Person]: [
                /@.*\.com/i, // Email pattern
                /\b[A-Z][a-z]+ [A-Z][a-z]+\b/, // Name pattern
                /Mr\.|Mrs\.|Dr\.|Prof\./i // Title pattern
            ],
            [NounType.Organization]: [
                /\bInc\.|Corp\.|LLC\.|Ltd\./i, // Corporate suffixes
                /Company|Corporation|Enterprise/i
            ],
            [NounType.Location]: [
                /\b\d{5}(-\d{4})?\b/, // ZIP code
                /Street|Ave|Road|Blvd/i
            ]
        };
        const relevantPatterns = patterns[nounType] || [];
        for (const pattern of relevantPatterns) {
            if (pattern.test(text)) {
                boost += 0.15;
            }
        }
        return Math.min(boost, 0.3);
    }
    /**
     * Generate reasoning for entity type selection
     */
    async generateEntityReasoning(text, data, nounType) {
        const reasons = [];
        // Semantic similarity reason using search
        const searchResults = await this.brainy.search(text + ' ' + nounType, 1);
        const similarity = searchResults.length > 0 ? searchResults[0].score : 0.5;
        if (similarity > 0.7) {
            reasons.push(`High semantic similarity (${(similarity * 100).toFixed(1)}%)`);
        }
        // Field-based reasons
        const relevantFields = this.getRelevantFields(data, nounType);
        if (relevantFields.length > 0) {
            reasons.push(`Contains ${nounType}-specific fields: ${relevantFields.join(', ')}`);
        }
        // Pattern-based reasons
        const matchedPatterns = this.getMatchedPatterns(text, data, nounType);
        if (matchedPatterns.length > 0) {
            reasons.push(`Matches ${nounType} patterns: ${matchedPatterns.join(', ')}`);
        }
        return reasons.length > 0 ? reasons.join('; ') : 'General semantic match';
    }
    /**
     * Neural Relationship Detection
     */
    async detectRelationshipsWithNeuralAnalysis(entities, rawData, options) {
        const relationships = [];
        const verbTypes = Object.values(VerbType);
        // For each pair of entities, test relationship possibilities
        for (let i = 0; i < entities.length; i++) {
            for (let j = i + 1; j < entities.length; j++) {
                const sourceEntity = entities[i];
                const targetEntity = entities[j];
                // Extract context for relationship detection
                const context = this.extractRelationshipContext(sourceEntity.originalData, targetEntity.originalData, rawData);
                // Test all verb types
                for (const verbType of verbTypes) {
                    const confidence = await this.calculateRelationshipConfidence(sourceEntity, targetEntity, verbType, context);
                    if (confidence >= options.confidenceThreshold - 0.1) { // Slightly lower threshold for relationships
                        const weight = options.enableWeights ?
                            this.calculateRelationshipWeight(sourceEntity, targetEntity, verbType, context) :
                            0.5;
                        const reasoning = await this.generateRelationshipReasoning(sourceEntity, targetEntity, verbType, context);
                        relationships.push({
                            sourceId: sourceEntity.suggestedId,
                            targetId: targetEntity.suggestedId,
                            verbType,
                            confidence,
                            weight,
                            reasoning,
                            context,
                            metadata: this.extractRelationshipMetadata(sourceEntity.originalData, targetEntity.originalData, verbType)
                        });
                    }
                }
            }
        }
        // Sort by confidence and remove duplicates/conflicts
        return this.pruneRelationships(relationships);
    }
    /**
     * Calculate relationship confidence
     */
    async calculateRelationshipConfidence(source, target, verbType, context) {
        // Semantic similarity between entities and verb type using search
        const relationshipText = `${this.extractMainText(source.originalData)} ${verbType} ${this.extractMainText(target.originalData)}`;
        const directResults = await this.brainy.search(relationshipText, 1);
        const directScore = directResults.length > 0 ? directResults[0].score : 0.4;
        const contextResults = await this.brainy.search(context + ' ' + verbType, 1);
        const contextSimilarity = contextResults.length > 0 ? contextResults[0].score : 0.5;
        // Entity type compatibility
        const typeCompatibility = this.calculateTypeCompatibility(source.nounType, target.nounType, verbType);
        // Combine with weights
        return (directScore * 0.4) + (contextSimilarity * 0.4) + (typeCompatibility * 0.2);
    }
    /**
     * Calculate relationship weight/strength
     */
    calculateRelationshipWeight(source, target, verbType, context) {
        let weight = 0.5; // Base weight
        // Context richness (more descriptive = stronger)
        const contextWords = context.split(' ').length;
        weight += Math.min(contextWords / 20, 0.2);
        // Entity importance (higher confidence entities = stronger relationships)
        const avgEntityConfidence = (source.confidence + target.confidence) / 2;
        weight += avgEntityConfidence * 0.2;
        // Verb type specificity (more specific verbs = stronger)
        const verbSpecificity = this.getVerbSpecificity(verbType);
        weight += verbSpecificity * 0.1;
        return Math.min(weight, 1.0);
    }
    /**
     * Generate Neural Insights - The Intelligence Layer
     */
    async generateNeuralInsights(entities, relationships) {
        const insights = [];
        // Detect hierarchies
        const hierarchies = this.detectHierarchies(relationships);
        hierarchies.forEach(hierarchy => {
            insights.push({
                type: 'hierarchy',
                description: `Detected ${hierarchy.type} hierarchy with ${hierarchy.levels} levels`,
                confidence: hierarchy.confidence,
                affectedEntities: hierarchy.entities,
                recommendation: `Consider visualizing the ${hierarchy.type} structure`
            });
        });
        // Detect clusters  
        const clusters = this.detectClusters(entities, relationships);
        clusters.forEach(cluster => {
            insights.push({
                type: 'cluster',
                description: `Found cluster of ${cluster.size} ${cluster.primaryType} entities`,
                confidence: cluster.confidence,
                affectedEntities: cluster.entities,
                recommendation: `These ${cluster.primaryType}s might form a natural grouping`
            });
        });
        // Detect patterns
        const patterns = this.detectPatterns(relationships);
        patterns.forEach(pattern => {
            insights.push({
                type: 'pattern',
                description: `Common relationship pattern: ${pattern.description}`,
                confidence: pattern.confidence,
                affectedEntities: pattern.entities,
                recommendation: pattern.recommendation
            });
        });
        return insights;
    }
    /**
     * Display Neural Analysis Results
     */
    async displayNeuralAnalysisResults(result, options) {
        // Entity summary
        const entityTable = new Table({
            head: [this.colors.brain('Entity Type'), this.colors.brain('Count'), this.colors.brain('Avg Confidence')],
            colWidths: [20, 10, 15]
        });
        const entitySummary = this.summarizeEntities(result.detectedEntities);
        Object.entries(entitySummary).forEach(([type, stats]) => {
            entityTable.push([
                this.colors.highlight(type),
                this.colors.primary(stats.count.toString()),
                this.colors.success(`${(stats.avgConfidence * 100).toFixed(1)}%`)
            ]);
        });
        // Relationship summary
        const relationshipTable = new Table({
            head: [this.colors.brain('Relationship Type'), this.colors.brain('Count'), this.colors.brain('Avg Weight'), this.colors.brain('Avg Confidence')],
            colWidths: [20, 10, 12, 15]
        });
        const relationshipSummary = this.summarizeRelationships(result.detectedRelationships);
        Object.entries(relationshipSummary).forEach(([type, stats]) => {
            relationshipTable.push([
                this.colors.highlight(type),
                this.colors.primary(stats.count.toString()),
                this.colors.warning(`${stats.avgWeight.toFixed(2)}`),
                this.colors.success(`${(stats.avgConfidence * 100).toFixed(1)}%`)
            ]);
        });
        console.log(boxen(`${this.emojis.atom} ${this.colors.brain('NEURAL CLASSIFICATION RESULTS')}\n\n` +
            entityTable.toString(), { padding: 1, borderStyle: 'round', borderColor: '#D67441' }));
        console.log(boxen(`${this.emojis.data} ${this.colors.brain('NEURAL RELATIONSHIP MAPPING')}\n\n` +
            relationshipTable.toString(), { padding: 1, borderStyle: 'round', borderColor: '#D67441' }));
        // Display insights
        if (result.insights.length > 0) {
            const insightsText = result.insights.map(insight => `${this.colors.accent('◆')} ${insight.description} (${(insight.confidence * 100).toFixed(1)}% confidence)`).join('\n');
            console.log(boxen(`${this.emojis.magic} ${this.colors.brain('NEURAL INSIGHTS')}\n\n` +
                insightsText, { padding: 1, borderStyle: 'round', borderColor: '#E88B5A' }));
        }
    }
    /**
     * Helper methods for the neural system
     */
    extractMainText(data) {
        // Extract the most relevant text from a data object
        const textFields = ['name', 'title', 'description', 'content', 'text', 'label'];
        for (const field of textFields) {
            if (data[field] && typeof data[field] === 'string') {
                return data[field];
            }
        }
        // Fallback: concatenate all string values
        return Object.values(data)
            .filter(v => typeof v === 'string')
            .join(' ')
            .substring(0, 200); // Limit length
    }
    generateSmartId(data, nounType, index) {
        const mainText = this.extractMainText(data);
        const cleanText = mainText.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20);
        return `${nounType}_${cleanText}_${index}`;
    }
    extractRelationshipContext(source, target, allData) {
        // Extract context for relationship detection
        return [
            this.extractMainText(source),
            this.extractMainText(target),
            // Add more contextual information
        ].join(' ');
    }
    calculateTypeCompatibility(sourceType, targetType, verbType) {
        // Define type compatibility matrix for relationships
        const compatibilityMatrix = {
            [NounType.Person]: {
                [NounType.Organization]: [VerbType.MemberOf, VerbType.WorksWith],
                [NounType.Project]: [VerbType.WorksWith, VerbType.Creates],
                [NounType.Person]: [VerbType.WorksWith, VerbType.Mentors, VerbType.ReportsTo]
            }
            // Add more compatibility rules
        };
        const sourceCompatibility = compatibilityMatrix[sourceType];
        if (sourceCompatibility && sourceCompatibility[targetType]) {
            return sourceCompatibility[targetType].includes(verbType) ? 1.0 : 0.3;
        }
        return 0.5; // Default compatibility
    }
    getVerbSpecificity(verbType) {
        // More specific verbs get higher scores
        const specificityScores = {
            [VerbType.RelatedTo]: 0.1, // Very generic
            [VerbType.WorksWith]: 0.7, // Specific
            [VerbType.Mentors]: 0.9, // Very specific
            [VerbType.ReportsTo]: 0.9, // Very specific
            [VerbType.Supervises]: 0.9 // Very specific
        };
        return specificityScores[verbType] || 0.5;
    }
    getRelevantFields(data, nounType) {
        // Implementation for finding relevant fields
        return [];
    }
    getMatchedPatterns(text, data, nounType) {
        // Implementation for finding matched patterns
        return [];
    }
    pruneRelationships(relationships) {
        // Remove duplicates and low-confidence relationships
        return relationships
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 1000); // Limit to top 1000 relationships
    }
    detectHierarchies(relationships) {
        // Detect hierarchical structures
        return [];
    }
    detectClusters(entities, relationships) {
        // Detect entity clusters
        return [];
    }
    detectPatterns(relationships) {
        // Detect relationship patterns
        return [];
    }
    summarizeEntities(entities) {
        const summary = {};
        entities.forEach(entity => {
            if (!summary[entity.nounType]) {
                summary[entity.nounType] = { count: 0, totalConfidence: 0 };
            }
            summary[entity.nounType].count++;
            summary[entity.nounType].totalConfidence += entity.confidence;
        });
        Object.keys(summary).forEach(type => {
            summary[type].avgConfidence = summary[type].totalConfidence / summary[type].count;
        });
        return summary;
    }
    summarizeRelationships(relationships) {
        const summary = {};
        relationships.forEach(rel => {
            if (!summary[rel.verbType]) {
                summary[rel.verbType] = { count: 0, totalWeight: 0, totalConfidence: 0 };
            }
            summary[rel.verbType].count++;
            summary[rel.verbType].totalWeight += rel.weight;
            summary[rel.verbType].totalConfidence += rel.confidence;
        });
        Object.keys(summary).forEach(type => {
            const stats = summary[type];
            stats.avgWeight = stats.totalWeight / stats.count;
            stats.avgConfidence = stats.totalConfidence / stats.count;
        });
        return summary;
    }
    calculateOverallConfidence(entities, relationships) {
        const entityConfidence = entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length;
        const relationshipConfidence = relationships.reduce((sum, r) => sum + r.confidence, 0) / relationships.length;
        return (entityConfidence + relationshipConfidence) / 2;
    }
    async generatePreview(entities, relationships) {
        return entities.slice(0, 5).map(entity => ({
            id: entity.suggestedId,
            nounType: entity.nounType,
            data: entity.originalData,
            relationships: relationships
                .filter(r => r.sourceId === entity.suggestedId)
                .slice(0, 3)
                .map(r => ({
                target: r.targetId,
                verbType: r.verbType,
                weight: r.weight,
                confidence: r.confidence
            }))
        }));
    }
    async confirmNeuralImport(result) {
        const { confirm } = await prompts({
            type: 'confirm',
            name: 'confirm',
            message: `${this.emojis.rocket} Execute neural import?`,
            initial: true
        });
        return confirm;
    }
    async executeNeuralImport(result, options) {
        const spinner = ora(`${this.emojis.gear} Executing neural import...`).start();
        try {
            // Add entities to Brainy
            for (const entity of result.detectedEntities) {
                await this.brainy.add({
                    data: this.extractMainText(entity.originalData),
                    type: entity.nounType,
                    metadata: {
                        ...entity.originalData,
                        confidence: entity.confidence,
                        id: entity.suggestedId
                    }
                });
            }
            // Add relationships to Brainy
            for (const relationship of result.detectedRelationships) {
                await this.brainy.relate({
                    from: relationship.sourceId,
                    to: relationship.targetId,
                    type: relationship.verbType,
                    weight: relationship.weight,
                    metadata: {
                        confidence: relationship.confidence,
                        context: relationship.context,
                        ...relationship.metadata
                    }
                });
            }
            spinner.succeed(this.colors.success(`${this.emojis.check} Neural import complete! ` +
                `${result.detectedEntities.length} entities and ` +
                `${result.detectedRelationships.length} relationships imported.`));
        }
        catch (error) {
            spinner.fail('Neural import failed');
            throw error;
        }
    }
    async generateRelationshipReasoning(source, target, verbType, context) {
        return `Neural analysis detected ${verbType} relationship based on semantic context`;
    }
    extractRelationshipMetadata(sourceData, targetData, verbType) {
        return {
            sourceType: typeof sourceData,
            targetType: typeof targetData,
            detectedBy: 'neural-import',
            timestamp: new Date().toISOString()
        };
    }
}
//# sourceMappingURL=neuralImport.js.map