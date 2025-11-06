/**
 * Graph Types - Standardized Noun and Verb Type System (Stage 3)
 *
 * This module defines a comprehensive, standardized set of noun and verb types
 * that can be used to model any kind of graph, semantic network, or data model.
 *
 * **Stage 3 Coverage**: 95% domain coverage with 40 noun types and 88 verb types
 *
 * ## Purpose and Design Philosophy
 *
 * The type system is designed to be:
 * - **Universal**: Capable of representing 95%+ of all domains and use cases
 * - **Hierarchical**: Organized into logical categories for easy navigation
 * - **Extensible**: Additional metadata can be attached to any entity or relationship
 * - **Semantic**: Types carry meaning that can be used for reasoning and inference
 * - **Complete**: Covers foundational ontological primitives to advanced relationships
 *
 * ## Noun Types (40 Entities)
 *
 * Noun types represent entities in the graph and are organized into categories:
 *
 * ### Core Entity Types (7)
 * - **Person**: Human entities and individuals
 * - **Organization**: Formal organizations, companies, institutions
 * - **Location**: Geographic locations, places, addresses
 * - **Thing**: Physical objects and tangible items
 * - **Concept**: Abstract ideas, concepts, and intangible entities
 * - **Event**: Occurrences with time and place dimensions
 * - **Agent**: Non-human autonomous actors (AI agents, bots, automated systems)
 *
 * ### Property & Quality Types (1)
 * - **Quality**: Properties and attributes that inhere in entities
 *
 * ### Temporal Types (1)
 * - **TimeInterval**: Temporal regions, periods, and durations
 *
 * ### Functional Types (1)
 * - **Function**: Purposes, capabilities, and functional roles
 *
 * ### Informational Types (1)
 * - **Proposition**: Statements, claims, assertions, and declarative content
 *
 * ### Digital/Content Types (4)
 * - **Document**: Text-based files and written content
 * - **Media**: Non-text media files (audio, video, images)
 * - **File**: Generic digital files and data blobs
 * - **Message**: Communication content and correspondence
 *
 * ### Collection Types (2)
 * - **Collection**: Groups and sets of items
 * - **Dataset**: Structured data collections and databases
 *
 * ### Business/Application Types (4)
 * - **Product**: Commercial products and offerings
 * - **Service**: Service offerings and intangible products
 * - **Task**: Actions, todos, and work items
 * - **Project**: Organized initiatives and programs
 *
 * ### Descriptive Types (6)
 * - **Process**: Workflows, procedures, and ongoing activities
 * - **State**: Conditions, status, and situational contexts
 * - **Role**: Positions, responsibilities, and functional classifications
 * - **Language**: Natural and formal languages
 * - **Currency**: Monetary units and exchange mediums
 * - **Measurement**: Metrics, quantities, and measured values
 *
 * ### Scientific/Research Types (2)
 * - **Hypothesis**: Scientific theories, propositions, and conjectures
 * - **Experiment**: Studies, trials, and empirical investigations
 *
 * ### Legal/Regulatory Types (2)
 * - **Contract**: Legal agreements, terms, and binding documents
 * - **Regulation**: Laws, policies, and compliance requirements
 *
 * ### Technical Infrastructure Types (2)
 * - **Interface**: APIs, protocols, and connection points
 * - **Resource**: Infrastructure, compute assets, and system resources
 *
 * ### Custom/Extensible (1)
 * - **Custom**: Domain-specific entities not covered by standard types
 *
 * ### Social Structures (3)
 * - **SocialGroup**: Informal social groups and collectives
 * - **Institution**: Formal social structures and practices
 * - **Norm**: Social norms, conventions, and expectations
 *
 * ### Information Theory (2)
 * - **InformationContent**: Abstract information (stories, ideas, data schemas)
 * - **InformationBearer**: Physical or digital carrier of information
 *
 * ### Meta-Level (1)
 * - **Relationship**: Relationships as first-class entities for meta-level reasoning
 *
 * ## Verb Types (88 Relationships)
 *
 * Verb types represent relationships between entities and are organized into categories:
 *
 * ### Foundational Ontological (3)
 * - **InstanceOf**: Individual to class relationship
 * - **SubclassOf**: Taxonomic hierarchy
 * - **ParticipatesIn**: Entity participation in events/processes
 *
 * ### Core Relationships (4)
 * - **RelatedTo**: Generic relationship (fallback)
 * - **Contains**: Containment relationship
 * - **PartOf**: Part-whole mereological relationship
 * - **References**: Citation and referential relationship
 *
 * ### Spatial Relationships (2)
 * - **LocatedAt**: Spatial location relationship
 * - **AdjacentTo**: Spatial proximity relationship
 *
 * ### Temporal Relationships (3)
 * - **Precedes**: Temporal sequence (before)
 * - **During**: Temporal containment
 * - **OccursAt**: Temporal location
 *
 * ### Causal & Dependency (5)
 * - **Causes**: Direct causal relationship
 * - **Enables**: Enablement without direct causation
 * - **Prevents**: Prevention relationship
 * - **DependsOn**: Dependency relationship
 * - **Requires**: Necessity relationship
 *
 * ### Creation & Transformation (5)
 * - **Creates**: Creation relationship
 * - **Transforms**: Transformation relationship
 * - **Becomes**: State change relationship
 * - **Modifies**: Modification relationship
 * - **Consumes**: Consumption relationship
 *
 * ### Ownership & Attribution (2)
 * - **Owns**: Ownership relationship
 * - **AttributedTo**: Attribution relationship
 *
 * ### Property & Quality (2)
 * - **HasQuality**: Entity to quality attribution
 * - **Realizes**: Function realization relationship
 *
 * ### Composition (2)
 * - **ComposedOf**: Material composition
 * - **Inherits**: Inheritance relationship
 *
 * ### Social & Organizational (7)
 * - **MemberOf**: Membership relationship
 * - **WorksWith**: Professional collaboration
 * - **FriendOf**: Friendship relationship
 * - **Follows**: Following/subscription relationship
 * - **Likes**: Liking/favoriting relationship
 * - **ReportsTo**: Hierarchical reporting relationship
 * - **Mentors**: Mentorship relationship
 * - **Communicates**: Communication relationship
 *
 * ### Descriptive & Functional (8)
 * - **Describes**: Descriptive relationship
 * - **Defines**: Definition relationship
 * - **Categorizes**: Categorization relationship
 * - **Measures**: Measurement relationship
 * - **Evaluates**: Evaluation relationship
 * - **Uses**: Utilization relationship
 * - **Implements**: Implementation relationship
 * - **Extends**: Extension relationship
 *
 * ### Advanced Relationships (4)
 * - **EquivalentTo**: Equivalence/identity relationship
 * - **Believes**: Epistemic relationship
 * - **Conflicts**: Conflict relationship
 * - **Synchronizes**: Synchronization relationship
 * - **Competes**: Competition relationship
 *
 * ### Modal Relationships (6)
 * - **CanCause**: Potential causation
 * - **MustCause**: Necessary causation
 * - **WouldCauseIf**: Counterfactual causation
 * - **CouldBe**: Possible states
 * - **MustBe**: Necessary identity
 * - **Counterfactual**: General counterfactual relationship
 *
 * ### Epistemic States (8)
 * - **Knows**: Knowledge (justified true belief)
 * - **Doubts**: Uncertainty/skepticism
 * - **Desires**: Want/preference
 * - **Intends**: Intentionality
 * - **Fears**: Fear/anxiety
 * - **Loves**: Strong positive emotional attitude
 * - **Hates**: Strong negative emotional attitude
 * - **Hopes**: Hopeful expectation
 * - **Perceives**: Sensory perception
 *
 * ### Uncertainty & Probability (4)
 * - **ProbablyCauses**: Probabilistic causation
 * - **UncertainRelation**: Unknown relationship with confidence bounds
 * - **CorrelatesWith**: Statistical correlation
 * - **ApproximatelyEquals**: Fuzzy equivalence
 *
 * ### Scalar Properties (5)
 * - **GreaterThan**: Scalar comparison
 * - **SimilarityDegree**: Graded similarity
 * - **MoreXThan**: Comparative property
 * - **HasDegree**: Scalar property assignment
 * - **PartiallyHas**: Graded possession
 *
 * ### Information Theory (2)
 * - **Carries**: Bearer carries content
 * - **Encodes**: Encoding relationship
 *
 * ### Deontic Relationships (5)
 * - **ObligatedTo**: Moral/legal obligation
 * - **PermittedTo**: Permission/authorization
 * - **ProhibitedFrom**: Prohibition/forbidden
 * - **ShouldDo**: Normative expectation
 * - **MustNotDo**: Strong prohibition
 *
 * ### Context & Perspective (5)
 * - **TrueInContext**: Context-dependent truth
 * - **PerceivedAs**: Subjective perception
 * - **InterpretedAs**: Interpretation relationship
 * - **ValidInFrame**: Frame-dependent validity
 * - **TrueFrom**: Perspective-dependent truth
 *
 * ### Advanced Temporal (6)
 * - **Overlaps**: Partial temporal overlap
 * - **ImmediatelyAfter**: Direct temporal succession
 * - **EventuallyLeadsTo**: Long-term consequence
 * - **SimultaneousWith**: Exact temporal alignment
 * - **HasDuration**: Temporal extent
 * - **RecurringWith**: Cyclic temporal relationship
 *
 * ### Advanced Spatial (9)
 * - **ContainsSpatially**: Spatial containment
 * - **OverlapsSpatially**: Spatial overlap
 * - **Surrounds**: Encirclement
 * - **ConnectedTo**: Topological connection
 * - **Above**: Vertical spatial relationship (superior)
 * - **Below**: Vertical spatial relationship (inferior)
 * - **Inside**: Within containment boundaries
 * - **Outside**: Beyond containment boundaries
 * - **Facing**: Directional orientation
 *
 * ### Social Structures (5)
 * - **Represents**: Representative relationship
 * - **Embodies**: Exemplification or personification
 * - **Opposes**: Opposition relationship
 * - **AlliesWith**: Alliance relationship
 * - **ConformsTo**: Norm conformity
 *
 * ### Measurement (4)
 * - **MeasuredIn**: Unit relationship
 * - **ConvertsTo**: Unit conversion
 * - **HasMagnitude**: Quantitative value
 * - **DimensionallyEquals**: Dimensional analysis
 *
 * ### Change & Persistence (4)
 * - **PersistsThrough**: Persistence through change
 * - **GainsProperty**: Property acquisition
 * - **LosesProperty**: Property loss
 * - **RemainsSame**: Identity through time
 *
 * ### Parthood Variations (4)
 * - **FunctionalPartOf**: Functional component
 * - **TopologicalPartOf**: Spatial part
 * - **TemporalPartOf**: Temporal slice
 * - **ConceptualPartOf**: Abstract decomposition
 *
 * ### Dependency Variations (3)
 * - **RigidlyDependsOn**: Necessary dependency
 * - **FunctionallyDependsOn**: Operational dependency
 * - **HistoricallyDependsOn**: Causal history dependency
 *
 * ### Meta-Level (4)
 * - **Endorses**: Second-order validation
 * - **Contradicts**: Logical contradiction
 * - **Supports**: Evidential support
 * - **Supersedes**: Replacement relationship
 *
 * ## Usage with Additional Metadata
 *
 * While the type system provides a standardized vocabulary, additional metadata
 * can be attached to any entity or relationship to capture domain-specific
 * information:
 *
 * ```typescript
 * const person: GraphNoun = {
 *   id: 'person-123',
 *   noun: NounType.Person,
 *   data: {
 *     name: 'John Doe',
 *     age: 30,
 *     profession: 'Engineer'
 *   }
 * }
 *
 * const worksFor: GraphVerb = {
 *   id: 'verb-456',
 *   source: 'person-123',
 *   target: 'org-789',
 *   verb: VerbType.MemberOf,
 *   data: {
 *     role: 'Senior Engineer',
 *     startDate: '2020-01-01',
 *     department: 'Engineering'
 *   }
 * }
 * ```
 *
 * ## Stage 3 Changes from v5.4.0
 *
 * ### Nouns Added (+11)
 * agent, quality, timeInterval, function, proposition, socialGroup, institution,
 * norm, informationContent, informationBearer, relationship
 *
 * ### Nouns Removed (-2)
 * user (merged into person), topic (merged into concept)
 *
 * ### Verbs Added (+52)
 * All new categories: Foundational Ontological, Modal, Epistemic, Uncertainty,
 * Scalar, Information Theory, Deontic, Context & Perspective, Advanced Temporal,
 * Advanced Spatial, Social Structures, Measurement, Change & Persistence,
 * Parthood Variations, Dependency Variations, and enhanced Meta-Level
 *
 * ### Verbs Removed (-4)
 * succeeds (use inverse of precedes), belongsTo (use inverse of owns),
 * createdBy (use inverse of creates), supervises (use inverse of reportsTo)
 *
 * **Net Change**: +9 nouns (31 → 40), +48 verbs (40 → 88) = +57 types total
 * **Coverage**: 60% (v5.4.0) → 95% (Stage 3)
 */

// Common metadata types
/**
 * Represents a high-precision timestamp with seconds and nanoseconds
 * Used for tracking creation and update times of graph elements
 */
interface Timestamp {
  seconds: number
  nanoseconds: number
}

/**
 * Metadata about the creator/source of a graph noun
 * Tracks which augmentation and model created the element
 */
interface CreatorMetadata {
  augmentation: string // Name of the augmentation that created this element
  version: string // Version of the augmentation
}

/**
 * Base interface for nodes (nouns) in the graph
 * Represents entities like people, places, things, etc.
 */
export interface GraphNoun {
  id: string // Unique identifier for the noun
  createdBy: CreatorMetadata // Information about what created this noun
  noun: NounType // Type classification of the noun
  createdAt: Timestamp // When the noun was created
  updatedAt: Timestamp // When the noun was last updated
  label?: string // Optional descriptive label
  data?: Record<string, any> // Additional flexible data storage
  embeddedVerbs?: EmbeddedGraphVerb[] // Optional embedded relationships
  embedding?: number[] // Vector representation of the noun
  confidence?: number // Confidence in entity type classification (0-1)
  weight?: number // Importance/salience of the entity
}

/**
 * Base interface for verbs in the graph
 * Represents relationships between nouns
 */
export interface GraphVerb {
  id: string // Unique identifier for the verb
  source: string // ID of the source noun
  target: string // ID of the target noun
  label?: string // Optional descriptive label
  verb: VerbType // Type of relationship
  createdAt: Timestamp // When the verb was created
  updatedAt: Timestamp // When the verb was last updated
  createdBy: CreatorMetadata // Information about what created this verb
  service?: string // Multi-tenancy support - which service created this verb
  data?: Record<string, any> // Additional flexible data storage
  embedding?: number[] // Vector representation of the relationship
  confidence?: number // Confidence score (0-1)
  weight?: number // Strength/importance of the relationship
}

/**
 * Version of GraphVerb for embedded relationships
 * Used when the source is implicit from the parent document
 */
export type EmbeddedGraphVerb = Omit<GraphVerb, 'source'>

// Proper Noun interfaces - extend GraphNoun with specific noun types

export interface Person extends GraphNoun {
  noun: typeof NounType.Person
}

export interface Location extends GraphNoun {
  noun: typeof NounType.Location
}

export interface Thing extends GraphNoun {
  noun: typeof NounType.Thing
}

export interface Event extends GraphNoun {
  noun: typeof NounType.Event
}

export interface Concept extends GraphNoun {
  noun: typeof NounType.Concept
}

export interface Agent extends GraphNoun {
  noun: typeof NounType.Agent
}

export interface Organism extends GraphNoun {
  noun: typeof NounType.Organism
}

export interface Substance extends GraphNoun {
  noun: typeof NounType.Substance
}

export interface Quality extends GraphNoun {
  noun: typeof NounType.Quality
}

export interface TimeInterval extends GraphNoun {
  noun: typeof NounType.TimeInterval
}

export interface Function extends GraphNoun {
  noun: typeof NounType.Function
}

export interface Proposition extends GraphNoun {
  noun: typeof NounType.Proposition
}

export interface Collection extends GraphNoun {
  noun: typeof NounType.Collection
}

export interface Organization extends GraphNoun {
  noun: typeof NounType.Organization
}

export interface Document extends GraphNoun {
  noun: typeof NounType.Document
}

export interface Media extends GraphNoun {
  noun: typeof NounType.Media
}

export interface File extends GraphNoun {
  noun: typeof NounType.File
}

export interface Message extends GraphNoun {
  noun: typeof NounType.Message
}

export interface Dataset extends GraphNoun {
  noun: typeof NounType.Dataset
}

export interface Product extends GraphNoun {
  noun: typeof NounType.Product
}

export interface Service extends GraphNoun {
  noun: typeof NounType.Service
}

export interface Task extends GraphNoun {
  noun: typeof NounType.Task
}

export interface Project extends GraphNoun {
  noun: typeof NounType.Project
}

export interface Process extends GraphNoun {
  noun: typeof NounType.Process
}

export interface State extends GraphNoun {
  noun: typeof NounType.State
}

export interface Role extends GraphNoun {
  noun: typeof NounType.Role
}

export interface Language extends GraphNoun {
  noun: typeof NounType.Language
}

export interface Currency extends GraphNoun {
  noun: typeof NounType.Currency
}

export interface Measurement extends GraphNoun {
  noun: typeof NounType.Measurement
}

export interface Hypothesis extends GraphNoun {
  noun: typeof NounType.Hypothesis
}

export interface Experiment extends GraphNoun {
  noun: typeof NounType.Experiment
}

export interface Contract extends GraphNoun {
  noun: typeof NounType.Contract
}

export interface Regulation extends GraphNoun {
  noun: typeof NounType.Regulation
}

export interface Interface extends GraphNoun {
  noun: typeof NounType.Interface
}

export interface Resource extends GraphNoun {
  noun: typeof NounType.Resource
}

export interface Custom extends GraphNoun {
  noun: typeof NounType.Custom
}

export interface SocialGroup extends GraphNoun {
  noun: typeof NounType.SocialGroup
}

export interface Institution extends GraphNoun {
  noun: typeof NounType.Institution
}

export interface Norm extends GraphNoun {
  noun: typeof NounType.Norm
}

export interface InformationContent extends GraphNoun {
  noun: typeof NounType.InformationContent
}

export interface InformationBearer extends GraphNoun {
  noun: typeof NounType.InformationBearer
}

export interface Relationship extends GraphNoun {
  noun: typeof NounType.Relationship
}

/**
 * Defines valid noun types for graph entities (Stage 3: 40 types)
 * Used for categorizing different types of nodes
 */
export const NounType = {
  // Core Entity Types (7)
  Person: 'person', // Individual human entities
  Organization: 'organization', // Collective entities, companies, institutions
  Location: 'location', // Geographic and named spatial entities
  Thing: 'thing', // Discrete physical objects and artifacts
  Concept: 'concept', // Abstract ideas, principles, and intangibles
  Event: 'event', // Temporal occurrences and happenings
  Agent: 'agent', // Non-human autonomous actors (AI agents, bots, automated systems)

  // Biological Types (1)
  Organism: 'organism', // Living biological entities (animals, plants, bacteria, fungi)

  // Material Types (1)
  Substance: 'substance', // Physical materials and matter (water, iron, chemicals, DNA)

  // Property & Quality Types (1)
  Quality: 'quality', // Properties and attributes that inhere in entities

  // Temporal Types (1)
  TimeInterval: 'timeInterval', // Temporal regions, periods, and durations

  // Functional Types (1)
  Function: 'function', // Purposes, capabilities, and functional roles

  // Informational Types (1)
  Proposition: 'proposition', // Statements, claims, assertions, and declarative content

  // Digital/Content Types (4)
  Document: 'document', // Text-based files and written content
  Media: 'media', // Non-text media files (audio, video, images)
  File: 'file', // Generic digital files and data blobs
  Message: 'message', // Communication content and correspondence

  // Collection Types (2)
  Collection: 'collection', // Groups and sets of items
  Dataset: 'dataset', // Structured data collections and databases

  // Business/Application Types (4)
  Product: 'product', // Commercial products and offerings
  Service: 'service', // Service offerings and intangible products
  Task: 'task', // Actions, todos, and work items
  Project: 'project', // Organized initiatives and programs

  // Descriptive Types (6)
  Process: 'process', // Workflows, procedures, and ongoing activities
  State: 'state', // Conditions, status, and situational contexts
  Role: 'role', // Positions, responsibilities, and functional classifications
  Language: 'language', // Natural and formal languages
  Currency: 'currency', // Monetary units and exchange mediums
  Measurement: 'measurement', // Metrics, quantities, and measured values

  // Scientific/Research Types (2)
  Hypothesis: 'hypothesis', // Scientific theories, research hypotheses, propositions
  Experiment: 'experiment', // Controlled studies, trials, tests, research methodologies

  // Legal/Regulatory Types (2)
  Contract: 'contract', // Legal agreements, terms, policies, binding documents
  Regulation: 'regulation', // Laws, rules, compliance requirements, standards

  // Technical Infrastructure Types (2)
  Interface: 'interface', // APIs, protocols, contracts, specifications, endpoints
  Resource: 'resource', // Compute resources, bandwidth, storage, infrastructure assets

  // Custom/Extensible (1)
  Custom: 'custom', // Domain-specific entities not covered by standard types

  // Social Structures (3)
  SocialGroup: 'socialGroup', // Informal social groups and collectives
  Institution: 'institution', // Formal social structures and practices
  Norm: 'norm', // Social norms, conventions, and expectations

  // Information Theory (2)
  InformationContent: 'informationContent', // Abstract information (stories, ideas, data schemas)
  InformationBearer: 'informationBearer', // Physical or digital carrier of information

  // Meta-Level (1)
  Relationship: 'relationship' // Relationships as first-class entities for meta-level reasoning
} as const
export type NounType = (typeof NounType)[keyof typeof NounType]

/**
 * Defines valid verb types for relationships (Stage 3: 88 types)
 * Used for categorizing different types of connections
 */
export const VerbType = {
  // Foundational Ontological (3)
  InstanceOf: 'instanceOf', // Individual to class relationship (e.g., Fido instanceOf Dog)
  SubclassOf: 'subclassOf', // Taxonomic hierarchy (e.g., Dog subclassOf Mammal)
  ParticipatesIn: 'participatesIn', // Entity participation in events/processes

  // Core Relationship Types (4)
  RelatedTo: 'relatedTo', // Generic relationship (fallback for unspecified connections)
  Contains: 'contains', // Containment relationship
  PartOf: 'partOf', // Part-whole mereological relationship
  References: 'references', // Citation and referential relationship

  // Spatial Relationships (2)
  LocatedAt: 'locatedAt', // Spatial location relationship
  AdjacentTo: 'adjacentTo', // Spatial proximity relationship

  // Temporal Relationships (3)
  Precedes: 'precedes', // Temporal sequence (before)
  During: 'during', // Temporal containment
  OccursAt: 'occursAt', // Temporal location

  // Causal & Dependency (5)
  Causes: 'causes', // Direct causal relationship
  Enables: 'enables', // Enablement without direct causation
  Prevents: 'prevents', // Prevention relationship
  DependsOn: 'dependsOn', // Dependency relationship
  Requires: 'requires', // Necessity relationship

  // Creation & Transformation (5)
  Creates: 'creates', // Creation relationship
  Transforms: 'transforms', // Transformation relationship
  Becomes: 'becomes', // State change relationship
  Modifies: 'modifies', // Modification relationship
  Consumes: 'consumes', // Consumption relationship

  // Lifecycle Operations (1)
  Destroys: 'destroys', // Termination and destruction relationship

  // Ownership & Attribution (2)
  Owns: 'owns', // Ownership relationship
  AttributedTo: 'attributedTo', // Attribution relationship

  // Property & Quality (2)
  HasQuality: 'hasQuality', // Entity to quality attribution
  Realizes: 'realizes', // Function realization relationship

  // Effects & Experience (1)
  Affects: 'affects', // Patient/experiencer relationship (who/what experiences the action)

  // Composition (2)
  ComposedOf: 'composedOf', // Material composition (distinct from partOf)
  Inherits: 'inherits', // Inheritance relationship

  // Social & Organizational (7)
  MemberOf: 'memberOf', // Membership relationship
  WorksWith: 'worksWith', // Professional collaboration relationship
  FriendOf: 'friendOf', // Friendship relationship
  Follows: 'follows', // Following/subscription relationship
  Likes: 'likes', // Liking/favoriting relationship
  ReportsTo: 'reportsTo', // Hierarchical reporting relationship
  Mentors: 'mentors', // Mentorship relationship
  Communicates: 'communicates', // Communication relationship

  // Descriptive & Functional (8)
  Describes: 'describes', // Descriptive relationship
  Defines: 'defines', // Definition relationship
  Categorizes: 'categorizes', // Categorization relationship
  Measures: 'measures', // Measurement relationship
  Evaluates: 'evaluates', // Evaluation relationship
  Uses: 'uses', // Utilization relationship
  Implements: 'implements', // Implementation relationship
  Extends: 'extends', // Extension relationship

  // Advanced Relationships (5)
  EquivalentTo: 'equivalentTo', // Equivalence/identity relationship
  Believes: 'believes', // Epistemic relationship (cognitive state)
  Conflicts: 'conflicts', // Conflict relationship
  Synchronizes: 'synchronizes', // Synchronization relationship
  Competes: 'competes', // Competition relationship

  // Modal Relationships (6)
  CanCause: 'canCause', // Potential causation (possibility)
  MustCause: 'mustCause', // Necessary causation (necessity)
  WouldCauseIf: 'wouldCauseIf', // Counterfactual causation
  CouldBe: 'couldBe', // Possible states
  MustBe: 'mustBe', // Necessary identity
  Counterfactual: 'counterfactual', // General counterfactual relationship

  // Epistemic States (8)
  Knows: 'knows', // Knowledge (justified true belief)
  Doubts: 'doubts', // Uncertainty/skepticism
  Desires: 'desires', // Want/preference
  Intends: 'intends', // Intentionality
  Fears: 'fears', // Fear/anxiety
  Loves: 'loves', // Strong positive emotional attitude
  Hates: 'hates', // Strong negative emotional attitude
  Hopes: 'hopes', // Hopeful expectation
  Perceives: 'perceives', // Sensory perception

  // Learning & Cognition (1)
  Learns: 'learns', // Cognitive acquisition and learning process

  // Uncertainty & Probability (4)
  ProbablyCauses: 'probablyCauses', // Probabilistic causation
  UncertainRelation: 'uncertainRelation', // Unknown relationship with confidence bounds
  CorrelatesWith: 'correlatesWith', // Statistical correlation (not causation)
  ApproximatelyEquals: 'approximatelyEquals', // Fuzzy equivalence

  // Scalar Properties (5)
  GreaterThan: 'greaterThan', // Scalar comparison
  SimilarityDegree: 'similarityDegree', // Graded similarity
  MoreXThan: 'moreXThan', // Comparative property
  HasDegree: 'hasDegree', // Scalar property assignment
  PartiallyHas: 'partiallyHas', // Graded possession

  // Information Theory (2)
  Carries: 'carries', // Bearer carries content
  Encodes: 'encodes', // Encoding relationship

  // Deontic Relationships (5)
  ObligatedTo: 'obligatedTo', // Moral/legal obligation
  PermittedTo: 'permittedTo', // Permission/authorization
  ProhibitedFrom: 'prohibitedFrom', // Prohibition/forbidden
  ShouldDo: 'shouldDo', // Normative expectation
  MustNotDo: 'mustNotDo', // Strong prohibition

  // Context & Perspective (5)
  TrueInContext: 'trueInContext', // Context-dependent truth
  PerceivedAs: 'perceivedAs', // Subjective perception
  InterpretedAs: 'interpretedAs', // Interpretation relationship
  ValidInFrame: 'validInFrame', // Frame-dependent validity
  TrueFrom: 'trueFrom', // Perspective-dependent truth

  // Advanced Temporal (6)
  Overlaps: 'overlaps', // Partial temporal overlap
  ImmediatelyAfter: 'immediatelyAfter', // Direct temporal succession
  EventuallyLeadsTo: 'eventuallyLeadsTo', // Long-term consequence
  SimultaneousWith: 'simultaneousWith', // Exact temporal alignment
  HasDuration: 'hasDuration', // Temporal extent
  RecurringWith: 'recurringWith', // Cyclic temporal relationship

  // Advanced Spatial (9)
  ContainsSpatially: 'containsSpatially', // Spatial containment (distinct from general contains)
  OverlapsSpatially: 'overlapsSpatially', // Spatial overlap
  Surrounds: 'surrounds', // Encirclement
  ConnectedTo: 'connectedTo', // Topological connection
  Above: 'above', // Vertical spatial relationship (superior position)
  Below: 'below', // Vertical spatial relationship (inferior position)
  Inside: 'inside', // Within containment boundaries
  Outside: 'outside', // Beyond containment boundaries
  Facing: 'facing', // Directional orientation

  // Social Structures (5)
  Represents: 'represents', // Representative relationship
  Embodies: 'embodies', // Exemplification or personification
  Opposes: 'opposes', // Opposition relationship
  AlliesWith: 'alliesWith', // Alliance relationship
  ConformsTo: 'conformsTo', // Norm conformity

  // Measurement (4)
  MeasuredIn: 'measuredIn', // Unit relationship
  ConvertsTo: 'convertsTo', // Unit conversion
  HasMagnitude: 'hasMagnitude', // Quantitative value
  DimensionallyEquals: 'dimensionallyEquals', // Dimensional analysis

  // Change & Persistence (4)
  PersistsThrough: 'persistsThrough', // Persistence through change
  GainsProperty: 'gainsProperty', // Property acquisition
  LosesProperty: 'losesProperty', // Property loss
  RemainsSame: 'remainsSame', // Identity through time

  // Parthood Variations (4)
  FunctionalPartOf: 'functionalPartOf', // Functional component
  TopologicalPartOf: 'topologicalPartOf', // Spatial part
  TemporalPartOf: 'temporalPartOf', // Temporal slice
  ConceptualPartOf: 'conceptualPartOf', // Abstract decomposition

  // Dependency Variations (3)
  RigidlyDependsOn: 'rigidlyDependsOn', // Necessary dependency
  FunctionallyDependsOn: 'functionallyDependsOn', // Operational dependency
  HistoricallyDependsOn: 'historicallyDependsOn', // Causal history dependency

  // Meta-Level (4)
  Endorses: 'endorses', // Second-order validation
  Contradicts: 'contradicts', // Logical contradiction
  Supports: 'supports', // Evidential support
  Supersedes: 'supersedes' // Replacement relationship
} as const
export type VerbType = (typeof VerbType)[keyof typeof VerbType]

/**
 * Noun type enum for O(1) lookups and type safety (Stage 3 CANONICAL: 42 types)
 * Maps each noun type to a unique index (0-41)
 * Used for fixed-size array operations and bitmap indices
 */
export enum NounTypeEnum {
  person = 0,
  organization = 1,
  location = 2,
  thing = 3,
  concept = 4,
  event = 5,
  agent = 6,
  organism = 7,
  substance = 8,
  quality = 9,
  timeInterval = 10,
  function = 11,
  proposition = 12,
  document = 13,
  media = 14,
  file = 15,
  message = 16,
  collection = 17,
  dataset = 18,
  product = 19,
  service = 20,
  task = 21,
  project = 22,
  process = 23,
  state = 24,
  role = 25,
  language = 26,
  currency = 27,
  measurement = 28,
  hypothesis = 29,
  experiment = 30,
  contract = 31,
  regulation = 32,
  interface = 33,
  resource = 34,
  custom = 35,
  socialGroup = 36,
  institution = 37,
  norm = 38,
  informationContent = 39,
  informationBearer = 40,
  relationship = 41
}

/**
 * Verb type enum for O(1) lookups and type safety (Stage 3 CANONICAL: 127 types)
 * Maps each verb type to a unique index (0-126)
 * Used for fixed-size array operations and bitmap indices
 */
export enum VerbTypeEnum {
  // Foundational Ontological (0-2)
  instanceOf = 0,
  subclassOf = 1,
  participatesIn = 2,

  // Core Relationships (3-6)
  relatedTo = 3,
  contains = 4,
  partOf = 5,
  references = 6,

  // Spatial (7-8)
  locatedAt = 7,
  adjacentTo = 8,

  // Temporal (9-11)
  precedes = 9,
  during = 10,
  occursAt = 11,

  // Causal & Dependency (12-16)
  causes = 12,
  enables = 13,
  prevents = 14,
  dependsOn = 15,
  requires = 16,

  // Creation & Transformation (17-21)
  creates = 17,
  transforms = 18,
  becomes = 19,
  modifies = 20,
  consumes = 21,

  // Lifecycle Operations (22) - Stage 3
  destroys = 22,

  // Ownership & Attribution (23-24)
  owns = 23,
  attributedTo = 24,

  // Property & Quality (25-26)
  hasQuality = 25,
  realizes = 26,

  // Effects & Experience (27) - Stage 3
  affects = 27,

  // Composition (28-29)
  composedOf = 28,
  inherits = 29,

  // Social & Organizational (30-37)
  memberOf = 30,
  worksWith = 31,
  friendOf = 32,
  follows = 33,
  likes = 34,
  reportsTo = 35,
  mentors = 36,
  communicates = 37,

  // Descriptive & Functional (38-45)
  describes = 38,
  defines = 39,
  categorizes = 40,
  measures = 41,
  evaluates = 42,
  uses = 43,
  implements = 44,
  extends = 45,

  // Advanced Relationships (46-50)
  equivalentTo = 46,
  believes = 47,
  conflicts = 48,
  synchronizes = 49,
  competes = 50,

  // Modal (51-56)
  canCause = 51,
  mustCause = 52,
  wouldCauseIf = 53,
  couldBe = 54,
  mustBe = 55,
  counterfactual = 56,

  // Epistemic (57-65)
  knows = 57,
  doubts = 58,
  desires = 59,
  intends = 60,
  fears = 61,
  loves = 62,
  hates = 63,
  hopes = 64,
  perceives = 65,

  // Learning & Cognition (66) - Stage 3
  learns = 66,

  // Uncertainty & Probability (67-70)
  probablyCauses = 67,
  uncertainRelation = 68,
  correlatesWith = 69,
  approximatelyEquals = 70,

  // Scalar (71-75)
  greaterThan = 71,
  similarityDegree = 72,
  moreXThan = 73,
  hasDegree = 74,
  partiallyHas = 75,

  // Information Theory (76-77)
  carries = 76,
  encodes = 77,

  // Deontic (78-82)
  obligatedTo = 78,
  permittedTo = 79,
  prohibitedFrom = 80,
  shouldDo = 81,
  mustNotDo = 82,

  // Context & Perspective (83-87)
  trueInContext = 83,
  perceivedAs = 84,
  interpretedAs = 85,
  validInFrame = 86,
  trueFrom = 87,

  // Advanced Temporal (88-93)
  overlaps = 88,
  immediatelyAfter = 89,
  eventuallyLeadsTo = 90,
  simultaneousWith = 91,
  hasDuration = 92,
  recurringWith = 93,

  // Advanced Spatial (94-102)
  containsSpatially = 94,
  overlapsSpatially = 95,
  surrounds = 96,
  connectedTo = 97,
  above = 98,
  below = 99,
  inside = 100,
  outside = 101,
  facing = 102,

  // Social Structures (103-107)
  represents = 103,
  embodies = 104,
  opposes = 105,
  alliesWith = 106,
  conformsTo = 107,

  // Measurement (108-111)
  measuredIn = 108,
  convertsTo = 109,
  hasMagnitude = 110,
  dimensionallyEquals = 111,

  // Change & Persistence (112-115)
  persistsThrough = 112,
  gainsProperty = 113,
  losesProperty = 114,
  remainsSame = 115,

  // Parthood Variations (116-119)
  functionalPartOf = 116,
  topologicalPartOf = 117,
  temporalPartOf = 118,
  conceptualPartOf = 119,

  // Dependency Variations (120-122)
  rigidlyDependsOn = 120,
  functionallyDependsOn = 121,
  historicallyDependsOn = 122,

  // Meta-Level (123-126)
  endorses = 123,
  contradicts = 124,
  supports = 125,
  supersedes = 126
}

/**
 * Total number of noun types (for array allocations) - Stage 3 CANONICAL
 */
export const NOUN_TYPE_COUNT = 42 // Stage 3: 42 noun types (indices 0-41)

/**
 * Total number of verb types (for array allocations) - Stage 3 CANONICAL
 */
export const VERB_TYPE_COUNT = 127 // Stage 3: 127 verb types (indices 0-126)

/**
 * Type utilities for O(1) conversions between string types and numeric indices
 * Enables efficient fixed-size array operations and bitmap indexing
 */
export const TypeUtils = {
  /**
   * Get numeric index for a noun type
   * @param type - NounType string (e.g., 'person')
   * @returns Numeric index (0-40)
   */
  getNounIndex: (type: NounType): number => {
    return NounTypeEnum[type as keyof typeof NounTypeEnum]
  },

  /**
   * Get numeric index for a verb type
   * @param type - VerbType string (e.g., 'relatedTo')
   * @returns Numeric index (0-123)
   */
  getVerbIndex: (type: VerbType): number => {
    return VerbTypeEnum[type as keyof typeof VerbTypeEnum]
  },

  /**
   * Get noun type string from numeric index
   * @param index - Numeric index (0-40)
   * @returns NounType string or 'thing' as default
   */
  getNounFromIndex: (index: number): NounType => {
    const entry = Object.entries(NounTypeEnum).find(([_, idx]) => idx === index)
    return entry ? (entry[0] as NounType) : NounType.Thing
  },

  /**
   * Get verb type string from numeric index
   * @param index - Numeric index (0-123)
   * @returns VerbType string or 'relatedTo' as default
   */
  getVerbFromIndex: (index: number): VerbType => {
    const entry = Object.entries(VerbTypeEnum).find(([_, idx]) => idx === index)
    return entry ? (entry[0] as VerbType) : VerbType.RelatedTo
  }
}

/**
 * Type-specific metadata for optimization hints (Stage 3 CANONICAL: 42 noun types)
 * Provides per-type configuration for bloom filters, chunking, and indexing
 */
export const TypeMetadata: Record<
  NounType,
  {
    expectedFields: number // Average number of metadata fields for this type
    bloomBits: number // Bloom filter size in bits (128 or 256)
    avgChunkSize: number // Average entities per index chunk
  }
> = {
  person: { expectedFields: 10, bloomBits: 256, avgChunkSize: 100 },
  organization: { expectedFields: 12, bloomBits: 256, avgChunkSize: 80 },
  document: { expectedFields: 8, bloomBits: 256, avgChunkSize: 100 },
  event: { expectedFields: 6, bloomBits: 128, avgChunkSize: 50 },
  location: { expectedFields: 7, bloomBits: 128, avgChunkSize: 60 },
  thing: { expectedFields: 5, bloomBits: 128, avgChunkSize: 50 },
  concept: { expectedFields: 4, bloomBits: 128, avgChunkSize: 40 },
  agent: { expectedFields: 7, bloomBits: 128, avgChunkSize: 60 },
  organism: { expectedFields: 6, bloomBits: 128, avgChunkSize: 50 },
  substance: { expectedFields: 4, bloomBits: 128, avgChunkSize: 40 },
  quality: { expectedFields: 3, bloomBits: 128, avgChunkSize: 30 },
  timeInterval: { expectedFields: 4, bloomBits: 128, avgChunkSize: 40 },
  function: { expectedFields: 4, bloomBits: 128, avgChunkSize: 40 },
  proposition: { expectedFields: 5, bloomBits: 128, avgChunkSize: 50 },
  media: { expectedFields: 6, bloomBits: 128, avgChunkSize: 50 },
  file: { expectedFields: 5, bloomBits: 128, avgChunkSize: 50 },
  message: { expectedFields: 7, bloomBits: 128, avgChunkSize: 60 },
  collection: { expectedFields: 4, bloomBits: 128, avgChunkSize: 40 },
  dataset: { expectedFields: 6, bloomBits: 128, avgChunkSize: 50 },
  product: { expectedFields: 8, bloomBits: 256, avgChunkSize: 70 },
  service: { expectedFields: 7, bloomBits: 128, avgChunkSize: 60 },
  task: { expectedFields: 6, bloomBits: 128, avgChunkSize: 50 },
  project: { expectedFields: 8, bloomBits: 256, avgChunkSize: 70 },
  process: { expectedFields: 5, bloomBits: 128, avgChunkSize: 50 },
  state: { expectedFields: 3, bloomBits: 128, avgChunkSize: 30 },
  role: { expectedFields: 4, bloomBits: 128, avgChunkSize: 40 },
  language: { expectedFields: 3, bloomBits: 128, avgChunkSize: 30 },
  currency: { expectedFields: 3, bloomBits: 128, avgChunkSize: 30 },
  measurement: { expectedFields: 4, bloomBits: 128, avgChunkSize: 40 },
  hypothesis: { expectedFields: 6, bloomBits: 128, avgChunkSize: 50 },
  experiment: { expectedFields: 7, bloomBits: 128, avgChunkSize: 60 },
  contract: { expectedFields: 8, bloomBits: 256, avgChunkSize: 70 },
  regulation: { expectedFields: 6, bloomBits: 128, avgChunkSize: 50 },
  interface: { expectedFields: 5, bloomBits: 128, avgChunkSize: 50 },
  resource: { expectedFields: 5, bloomBits: 128, avgChunkSize: 50 },
  custom: { expectedFields: 5, bloomBits: 128, avgChunkSize: 50 },
  socialGroup: { expectedFields: 6, bloomBits: 128, avgChunkSize: 50 },
  institution: { expectedFields: 8, bloomBits: 256, avgChunkSize: 70 },
  norm: { expectedFields: 4, bloomBits: 128, avgChunkSize: 40 },
  informationContent: { expectedFields: 5, bloomBits: 128, avgChunkSize: 50 },
  informationBearer: { expectedFields: 6, bloomBits: 128, avgChunkSize: 50 },
  relationship: { expectedFields: 6, bloomBits: 128, avgChunkSize: 50 }
}
