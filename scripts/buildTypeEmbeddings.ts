#!/usr/bin/env node

/**
 * Build embedded type embeddings with pre-computed vectors
 * Generates embeddings for all 31 NounTypes + 40 VerbTypes
 * NO runtime computation, NO external files needed!
 */

import { TransformerEmbedding } from '../src/utils/embedding.js'
import * as fs from 'fs/promises'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { NounType, VerbType } from '../src/types/graphTypes.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Type descriptions for semantic matching
 * Copied from BrainyTypes for consistency
 */
const NOUN_TYPE_DESCRIPTIONS: Record<string, string> = {
  // Core Entity Types
  [NounType.Person]: 'person human individual user employee customer citizen member author creator agent actor participant',
  [NounType.Organization]: 'organization company business corporation institution agency department team group committee board',
  [NounType.Location]: 'location place address city country region area zone coordinate position site venue building',
  [NounType.Thing]: 'thing object item product device equipment tool instrument asset artifact material physical tangible',
  [NounType.Concept]: 'concept idea theory principle philosophy belief value abstract intangible notion thought',
  [NounType.Event]: 'event occurrence incident activity happening meeting conference celebration milestone timestamp date',

  // Digital/Content Types
  [NounType.Document]: 'document file report article paper text pdf word contract agreement record documentation',
  [NounType.Media]: 'media image photo video audio music podcast multimedia graphic visualization animation',
  [NounType.File]: 'file digital data binary code script program software archive package bundle',
  [NounType.Message]: 'message email chat communication notification alert announcement broadcast transmission',
  [NounType.Content]: 'content information data text material resource publication post blog webpage',

  // Collection Types
  [NounType.Collection]: 'collection group set list array category folder directory catalog inventory database',
  [NounType.Dataset]: 'dataset data table spreadsheet database records statistics metrics measurements analysis',

  // Business/Application Types
  [NounType.Product]: 'product item merchandise offering service feature application software solution package',
  [NounType.Service]: 'service offering subscription support maintenance utility function capability',
  [NounType.User]: 'user account profile member subscriber customer client participant identity credentials',
  [NounType.Task]: 'task action todo item job assignment duty responsibility activity step procedure',
  [NounType.Project]: 'project initiative program campaign effort endeavor plan scheme venture undertaking',

  // Descriptive Types
  [NounType.Process]: 'process workflow procedure method algorithm sequence pipeline operation routine protocol',
  [NounType.State]: 'state status condition phase stage mode situation circumstance configuration setting',
  [NounType.Role]: 'role position title function responsibility duty job capacity designation authority',
  [NounType.Topic]: 'subject topic theme category tag keyword area domain field discipline specialty',
  [NounType.Language]: 'language dialect locale tongue vernacular communication speech linguistics vocabulary',
  [NounType.Currency]: 'currency money dollar euro pound yen bitcoin payment financial monetary unit',
  [NounType.Measurement]: 'measurement metric quantity value amount size dimension weight height volume distance',

  // Scientific/Research Types
  [NounType.Hypothesis]: 'hypothesis theory proposition thesis assumption premise conjecture speculation prediction',
  [NounType.Experiment]: 'experiment test trial study research investigation analysis observation examination',

  // Legal/Regulatory Types
  [NounType.Contract]: 'contract agreement deal treaty pact covenant license terms conditions policy',
  [NounType.Regulation]: 'regulation law rule policy standard compliance requirement guideline ordinance statute',

  // Technical Infrastructure Types
  [NounType.Interface]: 'interface API endpoint protocol specification contract schema definition connection',
  [NounType.Resource]: 'resource infrastructure server database storage compute memory bandwidth capacity asset'
}

const VERB_TYPE_DESCRIPTIONS: Record<string, string> = {
  // Core Relationship Types
  [VerbType.RelatedTo]: 'related connected associated linked correlated relevant pertinent applicable',
  [VerbType.Contains]: 'contains includes holds stores encompasses comprises consists incorporates',
  [VerbType.PartOf]: 'part component element member piece portion section segment constituent',
  [VerbType.LocatedAt]: 'located situated positioned placed found exists resides occupies',
  [VerbType.References]: 'references cites mentions points links refers quotes sources',

  // Temporal/Causal Types
  [VerbType.Precedes]: 'precedes before earlier prior previous antecedent preliminary foregoing',
  [VerbType.Succeeds]: 'succeeds follows after later subsequent next ensuing succeeding',
  [VerbType.Causes]: 'causes triggers induces produces generates results influences affects',
  [VerbType.DependsOn]: 'depends requires needs relies necessitates contingent prerequisite',
  [VerbType.Requires]: 'requires needs demands necessitates mandates obliges compels entails',

  // Creation/Transformation Types
  [VerbType.Creates]: 'creates makes produces generates builds constructs forms establishes',
  [VerbType.Transforms]: 'transforms converts changes modifies alters transitions morphs evolves',
  [VerbType.Becomes]: 'becomes turns evolves transforms changes transitions develops grows',
  [VerbType.Modifies]: 'modifies changes updates alters edits revises adjusts adapts',
  [VerbType.Consumes]: 'consumes uses utilizes depletes expends absorbs takes processes',

  // Ownership/Attribution Types
  [VerbType.Owns]: 'owns possesses holds controls manages administers governs maintains',
  [VerbType.AttributedTo]: 'attributed credited assigned ascribed authored written composed',
  [VerbType.CreatedBy]: 'created made produced generated built developed authored written',
  [VerbType.BelongsTo]: 'belongs property possession part member affiliate associated owned',

  // Social/Organizational Types
  [VerbType.MemberOf]: 'member participant affiliate associate belongs joined enrolled registered',
  [VerbType.WorksWith]: 'works collaborates cooperates partners teams assists helps supports',
  [VerbType.FriendOf]: 'friend companion buddy pal acquaintance associate connection relationship',
  [VerbType.Follows]: 'follows subscribes tracks monitors watches observes trails pursues',
  [VerbType.Likes]: 'likes enjoys appreciates favors prefers admires values endorses',
  [VerbType.ReportsTo]: 'reports answers subordinate accountable responsible supervised managed',
  [VerbType.Supervises]: 'supervises manages oversees directs leads controls guides administers',
  [VerbType.Mentors]: 'mentors teaches guides coaches instructs trains advises counsels',
  [VerbType.Communicates]: 'communicates talks speaks messages contacts interacts corresponds exchanges',

  // Descriptive/Functional Types
  [VerbType.Describes]: 'describes explains details documents specifies outlines depicts characterizes',
  [VerbType.Defines]: 'defines specifies establishes determines sets declares identifies designates',
  [VerbType.Categorizes]: 'categorizes classifies groups sorts organizes arranges labels tags',
  [VerbType.Measures]: 'measures quantifies gauges assesses evaluates calculates determines counts',
  [VerbType.Evaluates]: 'evaluates assesses analyzes reviews examines appraises judges rates',
  [VerbType.Uses]: 'uses utilizes employs applies operates handles manipulates exploits',
  [VerbType.Implements]: 'implements executes realizes performs accomplishes carries delivers completes',
  [VerbType.Extends]: 'extends expands enhances augments amplifies broadens enlarges develops',

  // Enhanced Relationships
  [VerbType.Inherits]: 'inherits derives extends receives obtains acquires succeeds legacy',
  [VerbType.Conflicts]: 'conflicts contradicts opposes clashes disputes disagrees incompatible inconsistent',
  [VerbType.Synchronizes]: 'synchronizes coordinates aligns harmonizes matches corresponds parallels coincides',
  [VerbType.Competes]: 'competes rivals contends contests challenges opposes vies struggles'
}

async function buildTypeEmbeddings() {
  console.log('🧠 Building embedded type embeddings for Brainy...')

  // Count types
  const nounTypes = Object.keys(NOUN_TYPE_DESCRIPTIONS)
  const verbTypes = Object.keys(VERB_TYPE_DESCRIPTIONS)
  console.log(`📊 Processing ${nounTypes.length} noun types and ${verbTypes.length} verb types...`)

  // Initialize TransformerEmbedding for embedding (one-time only!)
  const embedder = new TransformerEmbedding({
    verbose: true,
    localFilesOnly: false // Allow downloading models during build
  })

  await embedder.init()
  console.log('✅ TransformerEmbedding initialized')

  // Generate noun type embeddings
  const nounEmbeddings = new Map<string, number[]>()
  console.log('📝 Generating noun type embeddings...')

  for (const [type, description] of Object.entries(NOUN_TYPE_DESCRIPTIONS)) {
    try {
      const embedding = await embedder.embed(description)
      if (embedding && Array.isArray(embedding)) {
        nounEmbeddings.set(type, embedding)
        console.log(`  ✓ ${type}`)
      }
    } catch (error) {
      console.warn(`  ⚠️  Failed to embed noun type: ${type}`)
    }
  }

  // Generate verb type embeddings
  const verbEmbeddings = new Map<string, number[]>()
  console.log('📝 Generating verb type embeddings...')

  for (const [type, description] of Object.entries(VERB_TYPE_DESCRIPTIONS)) {
    try {
      const embedding = await embedder.embed(description)
      if (embedding && Array.isArray(embedding)) {
        verbEmbeddings.set(type, embedding)
        console.log(`  ✓ ${type}`)
      }
    } catch (error) {
      console.warn(`  ⚠️  Failed to embed verb type: ${type}`)
    }
  }

  console.log(`✅ Generated ${nounEmbeddings.size} noun embeddings and ${verbEmbeddings.size} verb embeddings`)

  // Get embedding dimension
  const embeddingDim = nounEmbeddings.size > 0 ?
    Array.from(nounEmbeddings.values())[0]?.length ?? 384 :
    384

  // Convert to compact binary format
  const totalTypes = nounTypes.length + verbTypes.length
  const totalFloats = totalTypes * embeddingDim
  const buffer = new ArrayBuffer(totalFloats * 4)
  const view = new DataView(buffer)

  let offset = 0

  // Pack noun embeddings
  for (const type of nounTypes) {
    const embedding = nounEmbeddings.get(type) || new Array(embeddingDim).fill(0)
    for (let i = 0; i < embeddingDim; i++) {
      view.setFloat32(offset, embedding[i], true) // little-endian
      offset += 4
    }
  }

  // Pack verb embeddings
  for (const type of verbTypes) {
    const embedding = verbEmbeddings.get(type) || new Array(embeddingDim).fill(0)
    for (let i = 0; i < embeddingDim; i++) {
      view.setFloat32(offset, embedding[i], true) // little-endian
      offset += 4
    }
  }

  // Convert to base64
  const uint8 = new Uint8Array(buffer)
  const base64 = Buffer.from(uint8).toString('base64')

  // Generate TypeScript file
  const tsContent = `/**
 * 🧠 BRAINY EMBEDDED TYPE EMBEDDINGS
 *
 * AUTO-GENERATED - DO NOT EDIT
 * Generated: ${new Date().toISOString()}
 * Noun Types: ${nounTypes.length}
 * Verb Types: ${verbTypes.length}
 *
 * This file contains pre-computed embeddings for all NounTypes and VerbTypes.
 * No runtime computation needed, instant availability!
 */

import { NounType, VerbType } from '../types/graphTypes.js'
import { Vector } from '../coreTypes.js'

// Type metadata
export const TYPE_METADATA = {
  nounTypes: ${nounTypes.length},
  verbTypes: ${verbTypes.length},
  totalTypes: ${totalTypes},
  embeddingDimensions: ${embeddingDim},
  generatedAt: "${new Date().toISOString()}",
  sizeBytes: {
    embeddings: ${buffer.byteLength},
    base64: ${base64.length}
  }
}

// All noun types in order
const NOUN_TYPE_ORDER: NounType[] = ${JSON.stringify(nounTypes)}

// All verb types in order
const VERB_TYPE_ORDER: VerbType[] = ${JSON.stringify(verbTypes)}

// Pre-computed embeddings (${(base64.length / 1024).toFixed(1)}KB base64)
const EMBEDDINGS_BASE64 = "${base64}"

// Decode embeddings at startup (happens once, <10ms)
function decodeEmbeddings(): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    // Node.js environment
    return Buffer.from(EMBEDDINGS_BASE64, 'base64')
  } else if (typeof atob !== 'undefined') {
    // Browser environment
    const binaryString = atob(EMBEDDINGS_BASE64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes
  }
  return new Uint8Array(0)
}

// Cached decoded embeddings
let decodedEmbeddings: Uint8Array | null = null

/**
 * Get noun type embeddings as a Map for fast lookup
 * This is called once and cached
 */
export function getNounTypeEmbeddings(): Map<NounType, Vector> {
  if (!decodedEmbeddings) {
    decodedEmbeddings = decodeEmbeddings()
  }

  const embeddings = new Map<NounType, Vector>()
  const view = new DataView(decodedEmbeddings.buffer)
  const embeddingSize = ${embeddingDim}

  NOUN_TYPE_ORDER.forEach((type, index) => {
    const offset = index * embeddingSize * 4
    const embedding = new Float32Array(embeddingSize)

    for (let i = 0; i < embeddingSize; i++) {
      embedding[i] = view.getFloat32(offset + i * 4, true)
    }

    embeddings.set(type, Array.from(embedding))
  })

  return embeddings
}

/**
 * Get verb type embeddings as a Map for fast lookup
 * This is called once and cached
 */
export function getVerbTypeEmbeddings(): Map<VerbType, Vector> {
  if (!decodedEmbeddings) {
    decodedEmbeddings = decodeEmbeddings()
  }

  const embeddings = new Map<VerbType, Vector>()
  const view = new DataView(decodedEmbeddings.buffer)
  const embeddingSize = ${embeddingDim}

  // Verb embeddings start after noun embeddings
  const verbStartOffset = ${nounTypes.length} * embeddingSize * 4

  VERB_TYPE_ORDER.forEach((type, index) => {
    const offset = verbStartOffset + index * embeddingSize * 4
    const embedding = new Float32Array(embeddingSize)

    for (let i = 0; i < embeddingSize; i++) {
      embedding[i] = view.getFloat32(offset + i * 4, true)
    }

    embeddings.set(type, Array.from(embedding))
  })

  return embeddings
}

// Import logging
import { prodLog } from '../utils/logger.js'
prodLog.info(\`🧠 Brainy Type Embeddings loaded: \${TYPE_METADATA.nounTypes} nouns, \${TYPE_METADATA.verbTypes} verbs, \${(TYPE_METADATA.sizeBytes.embeddings / 1024).toFixed(1)}KB\`)
`

  // Write the TypeScript file
  const outputPath = path.join(__dirname, '..', 'src', 'neural', 'embeddedTypeEmbeddings.ts')
  await fs.writeFile(outputPath, tsContent)

  // Report statistics
  console.log(`
✅ EMBEDDED TYPE EMBEDDINGS BUILT SUCCESSFULLY!
================================================
Noun Types: ${nounTypes.length}
Verb Types: ${verbTypes.length}
Total Types: ${totalTypes}
Embedding Dimensions: ${embeddingDim}

File sizes:
  Embeddings binary: ${(buffer.byteLength / 1024).toFixed(1)} KB
  Base64 encoded: ${(base64.length / 1024).toFixed(1)} KB

Output: ${outputPath}

Type embeddings are now embedded directly in Brainy!
No runtime computation needed, instant availability.
`)
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  buildTypeEmbeddings().catch(console.error)
}

export { buildTypeEmbeddings }
