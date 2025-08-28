/**
 * Universal Display Augmentation - Smart Field Patterns
 * 
 * Intelligent field detection patterns for mapping user data to display fields
 * Uses semantic understanding and common naming conventions
 */

import type { FieldPattern, FieldComputationContext } from './types.js'
import { NounType, VerbType } from '../../types/graphTypes.js'

/**
 * Universal field patterns that work across all data types
 * Ordered by confidence level (highest first)
 */
export const UNIVERSAL_FIELD_PATTERNS: FieldPattern[] = [
  // Title/Name Patterns (Highest Priority)
  {
    fields: ['name', 'title', 'displayName', 'label', 'heading'],
    displayField: 'title',
    confidence: 0.95
  },
  {
    fields: ['firstName', 'lastName', 'fullName', 'realName'],
    displayField: 'title',
    confidence: 0.9,
    applicableTypes: [NounType.Person, NounType.User],
    transform: (value: any, context: FieldComputationContext) => {
      const { metadata } = context
      if (metadata.firstName && metadata.lastName) {
        return `${metadata.firstName} ${metadata.lastName}`.trim()
      }
      return String(value || '')
    }
  },
  {
    fields: ['companyName', 'organizationName', 'orgName', 'businessName'],
    displayField: 'title',
    confidence: 0.9,
    applicableTypes: [NounType.Organization]
  },
  {
    fields: ['filename', 'fileName', 'documentTitle', 'docName'],
    displayField: 'title',
    confidence: 0.85,
    applicableTypes: [NounType.Document, NounType.File, NounType.Media]
  },
  {
    fields: ['projectName', 'projectTitle', 'initiative'],
    displayField: 'title',
    confidence: 0.9,
    applicableTypes: [NounType.Project]
  },
  {
    fields: ['taskName', 'taskTitle', 'action', 'todo'],
    displayField: 'title',
    confidence: 0.85,
    applicableTypes: [NounType.Task]
  },
  {
    fields: ['subject', 'topic', 'headline', 'caption'],
    displayField: 'title',
    confidence: 0.8
  },
  
  // Description Patterns (High Priority)
  {
    fields: ['description', 'summary', 'overview', 'details'],
    displayField: 'description',
    confidence: 0.9
  },
  {
    fields: ['bio', 'biography', 'profile', 'about'],
    displayField: 'description',
    confidence: 0.85,
    applicableTypes: [NounType.Person, NounType.User]
  },
  {
    fields: ['content', 'text', 'body', 'message'],
    displayField: 'description',
    confidence: 0.8
  },
  {
    fields: ['abstract', 'excerpt', 'snippet', 'preview'],
    displayField: 'description',
    confidence: 0.75
  },
  {
    fields: ['notes', 'comments', 'remarks', 'observations'],
    displayField: 'description',
    confidence: 0.7
  },
  
  // Type Patterns (Medium Priority)
  {
    fields: ['type', 'category', 'classification', 'kind'],
    displayField: 'type',
    confidence: 0.9
  },
  {
    fields: ['nounType', 'entityType', 'objectType'],
    displayField: 'type',
    confidence: 0.95
  },
  {
    fields: ['role', 'position', 'jobTitle', 'occupation'],
    displayField: 'type',
    confidence: 0.8,
    applicableTypes: [NounType.Person, NounType.User],
    transform: (value: any) => String(value || 'Person')
  },
  {
    fields: ['industry', 'sector', 'domain', 'field'],
    displayField: 'type',
    confidence: 0.7,
    applicableTypes: [NounType.Organization]
  },
  
  // Tag Patterns (Medium Priority)
  {
    fields: ['tags', 'keywords', 'labels', 'categories'],
    displayField: 'tags',
    confidence: 0.85
  },
  {
    fields: ['topics', 'subjects', 'themes'],
    displayField: 'tags',
    confidence: 0.8
  }
]

/**
 * Type-specific field patterns for enhanced detection
 * Used when we know the specific type of the entity
 */
export const TYPE_SPECIFIC_PATTERNS: Record<string, FieldPattern[]> = {
  [NounType.Person]: [
    {
      fields: ['email', 'emailAddress', 'contactEmail'],
      displayField: 'description',
      confidence: 0.7,
      transform: (value: any, context: FieldComputationContext) => {
        const { metadata } = context
        const role = metadata.role || metadata.jobTitle || metadata.position
        const company = metadata.company || metadata.organization || metadata.employer
        
        const parts = []
        if (role) parts.push(role)
        if (company) parts.push(`at ${company}`)
        if (parts.length === 0 && value) parts.push(`Contact: ${value}`)
        
        return parts.join(' ') || 'Person'
      }
    },
    {
      fields: ['phone', 'phoneNumber', 'mobile', 'cell'],
      displayField: 'tags',
      confidence: 0.6
    }
  ],
  
  [NounType.Organization]: [
    {
      fields: ['website', 'url', 'homepage', 'domain'],
      displayField: 'description',
      confidence: 0.7,
      transform: (value: any, context: FieldComputationContext) => {
        const { metadata } = context
        const industry = metadata.industry || metadata.sector
        const location = metadata.location || metadata.city || metadata.country
        
        const parts = []
        if (industry) parts.push(industry)
        parts.push('organization')
        if (location) parts.push(`in ${location}`)
        
        return parts.join(' ')
      }
    },
    {
      fields: ['employees', 'size', 'headcount'],
      displayField: 'tags',
      confidence: 0.6
    }
  ],
  
  [NounType.Project]: [
    {
      fields: ['status', 'phase', 'stage', 'state'],
      displayField: 'description',
      confidence: 0.8,
      transform: (value: any, context: FieldComputationContext) => {
        const { metadata } = context
        const status = String(value || 'active').toLowerCase()
        const budget = metadata.budget || metadata.cost
        const lead = metadata.lead || metadata.manager || metadata.owner
        
        const parts = []
        parts.push(status.charAt(0).toUpperCase() + status.slice(1))
        if (metadata.description) parts.push('project')
        if (lead) parts.push(`led by ${lead}`)
        if (budget) parts.push(`($${parseInt(String(budget)).toLocaleString()} budget)`)
        
        return parts.join(' ')
      }
    }
  ],
  
  [NounType.Document]: [
    {
      fields: ['author', 'creator', 'writer'],
      displayField: 'description',
      confidence: 0.7,
      transform: (value: any, context: FieldComputationContext) => {
        const { metadata } = context
        const docType = metadata.type || metadata.category || 'document'
        const date = metadata.date || metadata.created || metadata.published
        
        const parts = []
        if (docType) parts.push(docType)
        if (value) parts.push(`by ${value}`)
        if (date) {
          const dateStr = new Date(date).toLocaleDateString()
          parts.push(`(${dateStr})`)
        }
        
        return parts.join(' ')
      }
    }
  ],
  
  [NounType.Task]: [
    {
      fields: ['priority', 'urgency', 'importance'],
      displayField: 'tags',
      confidence: 0.7
    }
  ]
}

/**
 * Get field patterns for a specific entity type
 * @param entityType The type of entity (noun or verb)
 * @param specificType Optional specific noun/verb type
 * @returns Array of applicable field patterns
 */
export function getFieldPatterns(entityType: 'noun' | 'verb', specificType?: string): FieldPattern[] {
  const patterns = [...UNIVERSAL_FIELD_PATTERNS]
  
  if (entityType === 'noun' && specificType && TYPE_SPECIFIC_PATTERNS[specificType]) {
    patterns.unshift(...TYPE_SPECIFIC_PATTERNS[specificType])
  }
  
  return patterns.sort((a, b) => b.confidence - a.confidence)
}

/**
 * Priority fields for different entity types (for AI analysis)
 * Used by the IntelligentTypeMatcher and neural processing
 */
export const TYPE_PRIORITY_FIELDS: Record<string, string[]> = {
  [NounType.Person]: [
    'name', 'firstName', 'lastName', 'fullName', 'displayName',
    'email', 'role', 'jobTitle', 'position', 'title',
    'bio', 'description', 'about', 'profile',
    'company', 'organization', 'employer'
  ],
  
  [NounType.Organization]: [
    'name', 'companyName', 'organizationName', 'title',
    'industry', 'sector', 'domain', 'type',
    'description', 'about', 'summary',
    'location', 'city', 'country', 'headquarters',
    'website', 'url'
  ],
  
  [NounType.Project]: [
    'name', 'projectName', 'title', 'projectTitle',
    'description', 'summary', 'overview', 'goal',
    'status', 'phase', 'stage', 'state',
    'lead', 'manager', 'owner', 'team',
    'budget', 'timeline', 'deadline'
  ],
  
  [NounType.Document]: [
    'title', 'filename', 'name', 'subject',
    'content', 'text', 'body', 'summary',
    'author', 'creator', 'writer',
    'type', 'category', 'format',
    'date', 'created', 'published'
  ],
  
  [NounType.Task]: [
    'title', 'name', 'taskName', 'action',
    'description', 'details', 'notes',
    'status', 'state', 'priority',
    'assignee', 'owner', 'responsible',
    'due', 'deadline', 'dueDate'
  ],
  
  [NounType.Event]: [
    'name', 'title', 'eventName',
    'description', 'details', 'summary',
    'startDate', 'endDate', 'date', 'time',
    'location', 'venue', 'address',
    'organizer', 'host', 'creator'
  ],
  
  [NounType.Product]: [
    'name', 'productName', 'title',
    'description', 'summary', 'features',
    'price', 'cost', 'value',
    'category', 'type', 'brand',
    'manufacturer', 'vendor'
  ]
}

/**
 * Get priority fields for intelligent analysis
 * @param entityType The type of entity
 * @param specificType Optional specific type
 * @returns Array of priority field names
 */
export function getPriorityFields(entityType: 'noun' | 'verb', specificType?: string): string[] {
  if (entityType === 'noun' && specificType && TYPE_PRIORITY_FIELDS[specificType]) {
    return TYPE_PRIORITY_FIELDS[specificType]
  }
  
  // Default priority fields for any entity
  return [
    'name', 'title', 'label', 'displayName',
    'description', 'summary', 'about', 'details',
    'type', 'category', 'kind', 'classification',
    'tags', 'keywords', 'labels'
  ]
}

/**
 * Smart field value extraction with type-aware processing
 * @param data The data object to extract from
 * @param pattern The field pattern to apply
 * @param context The computation context
 * @returns The extracted and processed field value
 */
export function extractFieldValue(
  data: any, 
  pattern: FieldPattern, 
  context: FieldComputationContext
): any {
  // Find the first matching field
  let value: any = null
  let matchedField: string | null = null
  
  for (const field of pattern.fields) {
    if (data[field] !== undefined && data[field] !== null && data[field] !== '') {
      value = data[field]
      matchedField = field
      break
    }
  }
  
  if (value === null) return null
  
  // Apply transformation if provided
  if (pattern.transform) {
    try {
      return pattern.transform(value, context)
    } catch (error) {
      console.warn(`Field transformation error for ${matchedField}:`, error)
      return String(value)
    }
  }
  
  // Default processing based on display field type
  switch (pattern.displayField) {
    case 'title':
    case 'description':
    case 'type':
      return String(value)
      
    case 'tags':
      if (Array.isArray(value)) return value
      if (typeof value === 'string') {
        return value.split(/[,;]\s*|\s+/).filter(Boolean)
      }
      return [String(value)]
      
    default:
      return value
  }
}

/**
 * Calculate confidence score for field detection
 * @param pattern The field pattern
 * @param context The computation context
 * @param value The extracted value
 * @returns Confidence score (0-1)
 */
export function calculateFieldConfidence(
  pattern: FieldPattern,
  context: FieldComputationContext,
  value: any
): number {
  let confidence = pattern.confidence
  
  // Boost confidence if type matches
  if (pattern.applicableTypes && context.typeResult) {
    if (pattern.applicableTypes.includes(context.typeResult.type)) {
      confidence = Math.min(1.0, confidence + 0.1)
    }
  }
  
  // Reduce confidence for empty or very short values
  if (typeof value === 'string') {
    if (value.length < 2) {
      confidence *= 0.5
    } else if (value.length < 5) {
      confidence *= 0.8
    }
  }
  
  // Reduce confidence for generic values
  const genericValues = ['unknown', 'n/a', 'null', 'undefined', 'default']
  if (typeof value === 'string' && genericValues.includes(value.toLowerCase())) {
    confidence *= 0.3
  }
  
  return Math.max(0, Math.min(1, confidence))
}