#!/usr/bin/env node

/**
 * Build embedded type embeddings with pre-computed vectors
 * Stage 3 CANONICAL: Generates embeddings for all 42 NounTypes + 127 VerbTypes (169 total)
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
  // Core Entity Types (7)
  [NounType.Person]: 'person human individual employee customer citizen member author creator actor participant user profile',
  [NounType.Organization]: 'organization company business corporation institution agency department team group committee board',
  [NounType.Location]: 'location place address city country region area zone coordinate position site venue building',
  [NounType.Thing]: 'thing object item product device equipment tool instrument asset artifact material physical tangible',
  [NounType.Concept]: 'concept idea theory principle philosophy belief value abstract intangible notion thought topic theme',
  [NounType.Event]: 'event occurrence incident activity happening meeting conference celebration milestone timestamp date',
  [NounType.Agent]: 'agent bot AI automation system software autonomous intelligent assistant automated program',

  // Biological Types (1) - Stage 3
  [NounType.Organism]: 'organism animal plant bacteria fungi species living biological life creature being microorganism ecology biology',

  // Material Types (1) - Stage 3
  [NounType.Substance]: 'substance material matter chemical element compound liquid gas solid molecule atom chemistry physics',

  // Property & Quality Types (1)
  [NounType.Quality]: 'quality attribute property characteristic feature trait aspect dimension parameter variable',

  // Temporal Types (1)
  [NounType.TimeInterval]: 'timeInterval period duration span epoch era age phase stage interval window timeframe',

  // Functional Types (1)
  [NounType.Function]: 'function purpose role capability capacity utility service operation behavior method procedure',

  // Informational Types (1)
  [NounType.Proposition]: 'proposition statement claim assertion declaration fact truth belief hypothesis thesis',

  // Digital/Content Types (4)
  [NounType.Document]: 'document file report article paper text pdf word contract agreement record documentation',
  [NounType.Media]: 'media image photo video audio music podcast multimedia graphic visualization animation',
  [NounType.File]: 'file digital data binary code script program software archive package bundle',
  [NounType.Message]: 'message email chat communication notification alert announcement broadcast transmission',

  // Collection Types (2)
  [NounType.Collection]: 'collection group set list array category folder directory catalog inventory database',
  [NounType.Dataset]: 'dataset data table spreadsheet database records statistics metrics measurements analysis',

  // Business/Application Types (4)
  [NounType.Product]: 'product item merchandise offering service feature application software solution package',
  [NounType.Service]: 'service offering subscription support maintenance utility function capability',
  [NounType.Task]: 'task action todo item job assignment duty responsibility activity step procedure',
  [NounType.Project]: 'project initiative program campaign effort endeavor plan scheme venture undertaking',

  // Descriptive Types (6)
  [NounType.Process]: 'process workflow procedure method algorithm sequence pipeline operation routine protocol',
  [NounType.State]: 'state status condition phase stage mode situation circumstance configuration setting',
  [NounType.Role]: 'role position title function responsibility duty job capacity designation authority',
  [NounType.Language]: 'language dialect locale tongue vernacular communication speech linguistics vocabulary',
  [NounType.Currency]: 'currency money dollar euro pound yen bitcoin payment financial monetary unit',
  [NounType.Measurement]: 'measurement metric quantity value amount size dimension weight height volume distance',

  // Scientific/Research Types (2)
  [NounType.Hypothesis]: 'hypothesis theory proposition thesis assumption premise conjecture speculation prediction',
  [NounType.Experiment]: 'experiment test trial study research investigation analysis observation examination',

  // Legal/Regulatory Types (2)
  [NounType.Contract]: 'contract agreement deal treaty pact covenant license terms conditions policy',
  [NounType.Regulation]: 'regulation law rule policy standard compliance requirement guideline ordinance statute',

  // Technical Infrastructure Types (2)
  [NounType.Interface]: 'interface API endpoint protocol specification contract schema definition connection',
  [NounType.Resource]: 'resource infrastructure server database storage compute memory bandwidth capacity asset',

  // Custom/Extensible (1)
  [NounType.Custom]: 'custom specialized domain specific unique particular bespoke tailored proprietary extension',

  // Social Structures (3)
  [NounType.SocialGroup]: 'socialGroup community collective gathering tribe clan network circle cohort clique',
  [NounType.Institution]: 'institution establishment foundation organization structure framework system convention',
  [NounType.Norm]: 'norm convention standard rule expectation custom tradition practice guideline principle',

  // Information Theory (2)
  [NounType.InformationContent]: 'informationContent data knowledge meaning semantics message signal information abstract',
  [NounType.InformationBearer]: 'informationBearer medium carrier vehicle channel substrate document physical digital',

  // Meta-Level (1)
  [NounType.Relationship]: 'relationship connection association link bond tie relation interaction dependency'
}

const VERB_TYPE_DESCRIPTIONS: Record<string, string> = {
  // Foundational Ontological (3)
  [VerbType.InstanceOf]: 'instance type class category exemplar example specimen case member individual',
  [VerbType.SubclassOf]: 'subclass taxonomy hierarchy classification parent child inheritance specialization generalization',
  [VerbType.ParticipatesIn]: 'participates engages joins takes part involves contributes attends performs',

  // Core Relationship Types (4)
  [VerbType.RelatedTo]: 'related connected associated linked correlated relevant pertinent applicable',
  [VerbType.Contains]: 'contains includes holds stores encompasses comprises consists incorporates',
  [VerbType.PartOf]: 'part component element member piece portion section segment constituent',
  [VerbType.References]: 'references cites mentions points links refers quotes sources',

  // Spatial Relationships (2)
  [VerbType.LocatedAt]: 'located situated positioned placed found exists resides occupies',
  [VerbType.AdjacentTo]: 'adjacent neighboring next beside alongside bordering contiguous proximate near',

  // Temporal Relationships (3)
  [VerbType.Precedes]: 'precedes before earlier prior previous antecedent preliminary foregoing',
  [VerbType.During]: 'during while throughout within amid midst concurrent simultaneous',
  [VerbType.OccursAt]: 'occurs happens takes place transpires manifests appears arises',

  // Causal & Dependency (5)
  [VerbType.Causes]: 'causes triggers induces produces generates results influences affects',
  [VerbType.Enables]: 'enables facilitates allows permits empowers supports assists helps',
  [VerbType.Prevents]: 'prevents blocks stops hinders obstructs inhibits precludes avoids',
  [VerbType.DependsOn]: 'depends requires needs relies necessitates contingent prerequisite',
  [VerbType.Requires]: 'requires needs demands necessitates mandates obliges compels entails',

  // Creation & Transformation (5)
  [VerbType.Creates]: 'creates makes produces generates builds constructs forms establishes authors writes',
  [VerbType.Transforms]: 'transforms converts changes modifies alters transitions morphs evolves',
  [VerbType.Becomes]: 'becomes turns evolves transforms changes transitions develops grows',
  [VerbType.Modifies]: 'modifies changes updates alters edits revises adjusts adapts',
  [VerbType.Consumes]: 'consumes uses utilizes depletes expends absorbs takes processes',

  // Lifecycle Operations (1) - Stage 3
  [VerbType.Destroys]: 'destroys eliminates removes deletes terminates ends abolishes annihilates demolishes',

  // Ownership & Attribution (2)
  [VerbType.Owns]: 'owns possesses holds controls manages administers governs maintains',
  [VerbType.AttributedTo]: 'attributed credited assigned ascribed authored written composed',

  // Property & Quality (2)
  [VerbType.HasQuality]: 'hasQuality exhibits displays shows manifests demonstrates possesses embodies',
  [VerbType.Realizes]: 'realizes instantiates implements actualizes fulfills embodies manifests',

  // Effects & Experience (1) - Stage 3
  [VerbType.Affects]: 'affects impacts influences touches concerns involves experiences undergoes',

  // Composition (2)
  [VerbType.ComposedOf]: 'composed made formed constituted built constructed assembled created',
  [VerbType.Inherits]: 'inherits derives extends receives obtains acquires succeeds legacy',

  // Social & Organizational (7)
  [VerbType.MemberOf]: 'member participant affiliate associate belongs joined enrolled registered',
  [VerbType.WorksWith]: 'works collaborates cooperates partners teams assists helps supports',
  [VerbType.FriendOf]: 'friend companion buddy pal acquaintance associate connection relationship',
  [VerbType.Follows]: 'follows subscribes tracks monitors watches observes trails pursues',
  [VerbType.Likes]: 'likes enjoys appreciates favors prefers admires values endorses',
  [VerbType.ReportsTo]: 'reports answers subordinate accountable responsible supervised managed',
  [VerbType.Mentors]: 'mentors teaches guides coaches instructs trains advises counsels',
  [VerbType.Communicates]: 'communicates talks speaks messages contacts interacts corresponds exchanges',

  // Descriptive & Functional (8)
  [VerbType.Describes]: 'describes explains details documents specifies outlines depicts characterizes',
  [VerbType.Defines]: 'defines specifies establishes determines sets declares identifies designates',
  [VerbType.Categorizes]: 'categorizes classifies groups sorts organizes arranges labels tags',
  [VerbType.Measures]: 'measures quantifies gauges assesses evaluates calculates determines counts',
  [VerbType.Evaluates]: 'evaluates assesses analyzes reviews examines appraises judges rates',
  [VerbType.Uses]: 'uses utilizes employs applies operates handles manipulates exploits',
  [VerbType.Implements]: 'implements executes realizes performs accomplishes carries delivers completes',
  [VerbType.Extends]: 'extends expands enhances augments amplifies broadens enlarges develops',

  // Advanced Relationships (5)
  [VerbType.EquivalentTo]: 'equivalent equal same identical interchangeable synonymous matching comparable',
  [VerbType.Believes]: 'believes thinks considers judges supposes assumes presumes trusts',
  [VerbType.Conflicts]: 'conflicts contradicts opposes clashes disputes disagrees incompatible inconsistent',
  [VerbType.Synchronizes]: 'synchronizes coordinates aligns harmonizes matches corresponds parallels coincides',
  [VerbType.Competes]: 'competes rivals contends contests challenges opposes vies struggles',

  // Modal Relationships (6)
  [VerbType.CanCause]: 'can could might may possibly potentially perhaps maybe',
  [VerbType.MustCause]: 'must necessarily inevitably certainly surely definitely requires',
  [VerbType.WouldCauseIf]: 'would could should hypothetically counterfactual conditional if',
  [VerbType.CouldBe]: 'could might may possibly potentially perhaps maybe alternative',
  [VerbType.MustBe]: 'must necessarily inevitably certainly surely definitely essential',
  [VerbType.Counterfactual]: 'counterfactual hypothetical imaginary supposed assumed conditional alternative',

  // Epistemic States (8)
  [VerbType.Knows]: 'knows understands comprehends grasps aware cognizant familiar informed',
  [VerbType.Doubts]: 'doubts questions uncertain skeptical suspicious mistrustful hesitant unsure',
  [VerbType.Desires]: 'desires wants wishes hopes prefers seeks craves longs',
  [VerbType.Intends]: 'intends plans aims purposes means proposes designs aspires',
  [VerbType.Fears]: 'fears worries anxious concerned apprehensive dreads scared afraid',
  [VerbType.Loves]: 'loves adores cherishes treasures values appreciates devoted affectionate',
  [VerbType.Hates]: 'hates dislikes detests despises loathes abhors resents opposes',
  [VerbType.Hopes]: 'hopes wishes desires expects anticipates aspires yearns optimistic',
  [VerbType.Perceives]: 'perceives senses observes notices detects sees hears feels',

  // Learning & Cognition (1) - Stage 3
  [VerbType.Learns]: 'learns studies acquires masters discovers understands grasps absorbs educates trains',

  // Uncertainty & Probability (4)
  [VerbType.ProbablyCauses]: 'probably likely plausibly possibly perhaps maybe potentially',
  [VerbType.UncertainRelation]: 'uncertain unknown unclear ambiguous vague dubious questionable',
  [VerbType.CorrelatesWith]: 'correlates relates associates connects corresponds aligns linked',
  [VerbType.ApproximatelyEquals]: 'approximately roughly nearly about around close similar',

  // Scalar Properties (5)
  [VerbType.GreaterThan]: 'greater larger bigger more higher superior exceeds surpasses',
  [VerbType.SimilarityDegree]: 'similarity resemblance likeness correspondence analogy parallel comparable',
  [VerbType.MoreXThan]: 'more comparative greater higher increased additional extra',
  [VerbType.HasDegree]: 'degree extent level amount intensity magnitude measure',
  [VerbType.PartiallyHas]: 'partially somewhat partly incompletely fractionally moderately',

  // Information Theory (2)
  [VerbType.Carries]: 'carries bears conveys transmits transports holds contains delivers',
  [VerbType.Encodes]: 'encodes represents symbolizes signifies denotes expresses translates',

  // Deontic Relationships (5)
  [VerbType.ObligatedTo]: 'obligated required mandated compelled bound duty responsibility',
  [VerbType.PermittedTo]: 'permitted allowed authorized entitled licensed approved',
  [VerbType.ProhibitedFrom]: 'prohibited forbidden banned barred disallowed restricted',
  [VerbType.ShouldDo]: 'should ought expected advisable recommended desirable proper',
  [VerbType.MustNotDo]: 'mustNot forbidden prohibited banned disallowed illegal wrong',

  // Context & Perspective (5)
  [VerbType.TrueInContext]: 'true context situation circumstance condition setting environment',
  [VerbType.PerceivedAs]: 'perceived seen viewed regarded considered judged interpreted',
  [VerbType.InterpretedAs]: 'interpreted understood construed explained analyzed read',
  [VerbType.ValidInFrame]: 'valid applicable relevant appropriate suitable proper',
  [VerbType.TrueFrom]: 'true perspective viewpoint standpoint angle position outlook',

  // Advanced Temporal (6)
  [VerbType.Overlaps]: 'overlaps intersects coincides concurrent simultaneous parallel',
  [VerbType.ImmediatelyAfter]: 'immediately directly instantly promptly right after next',
  [VerbType.EventuallyLeadsTo]: 'eventually ultimately finally consequently results leads',
  [VerbType.SimultaneousWith]: 'simultaneous concurrent parallel synchronous coexisting together',
  [VerbType.HasDuration]: 'duration length period span time extent interval',
  [VerbType.RecurringWith]: 'recurring repeating cyclical periodic regular routine',

  // Advanced Spatial (9)
  [VerbType.ContainsSpatially]: 'contains encloses encompasses surrounds within inside',
  [VerbType.OverlapsSpatially]: 'overlaps intersects crosses coincides shared common',
  [VerbType.Surrounds]: 'surrounds encircles encompasses encloses rings borders',
  [VerbType.ConnectedTo]: 'connected joined linked attached bound tied',
  [VerbType.Above]: 'above over higher superior top upper overhead',
  [VerbType.Below]: 'below under lower inferior bottom beneath underneath',
  [VerbType.Inside]: 'inside within contained enclosed interior internal',
  [VerbType.Outside]: 'outside beyond external exterior outside peripheral',
  [VerbType.Facing]: 'facing toward directed oriented pointing aimed',

  // Social Structures (5)
  [VerbType.Represents]: 'represents symbolizes stands embodies exemplifies signifies',
  [VerbType.Embodies]: 'embodies personifies exemplifies incarnates manifests represents',
  [VerbType.Opposes]: 'opposes resists contests challenges contradicts against',
  [VerbType.AlliesWith]: 'allies partners cooperates collaborates joins teams',
  [VerbType.ConformsTo]: 'conforms complies obeys follows adheres respects',

  // Measurement (4)
  [VerbType.MeasuredIn]: 'measured quantified expressed units scale metric',
  [VerbType.ConvertsTo]: 'converts changes transforms translates exchanges switches',
  [VerbType.HasMagnitude]: 'magnitude size amount quantity value extent',
  [VerbType.DimensionallyEquals]: 'dimensional units measurement quantitative equivalent',

  // Change & Persistence (4)
  [VerbType.PersistsThrough]: 'persists continues endures remains survives lasts',
  [VerbType.GainsProperty]: 'gains acquires obtains receives gets attains',
  [VerbType.LosesProperty]: 'loses forfeits surrenders relinquishes drops sheds',
  [VerbType.RemainsSame]: 'remains stays unchanged constant stable persistent',

  // Parthood Variations (4)
  [VerbType.FunctionalPartOf]: 'functional operational working active component',
  [VerbType.TopologicalPartOf]: 'topological spatial geometric regional local',
  [VerbType.TemporalPartOf]: 'temporal time phase stage period epoch',
  [VerbType.ConceptualPartOf]: 'conceptual abstract logical theoretical notional',

  // Dependency Variations (3)
  [VerbType.RigidlyDependsOn]: 'rigidly strictly absolutely necessarily essentially',
  [VerbType.FunctionallyDependsOn]: 'functionally operationally practically pragmatically',
  [VerbType.HistoricallyDependsOn]: 'historically originally initially previously formerly',

  // Meta-Level (4)
  [VerbType.Endorses]: 'endorses approves supports validates confirms certifies',
  [VerbType.Contradicts]: 'contradicts opposes conflicts disagrees denies refutes',
  [VerbType.Supports]: 'supports validates confirms backs reinforces strengthens',
  [VerbType.Supersedes]: 'supersedes replaces overrides obsoletes deprecates succeeds'
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
