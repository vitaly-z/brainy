/**
 * Graph Types - Standardized Noun and Verb Type System
 *
 * This module defines a comprehensive, standardized set of noun and verb types
 * that can be used to model any kind of graph, semantic network, or data model.
 *
 * ## Purpose and Design Philosophy
 *
 * The type system is designed to be:
 * - **Universal**: Capable of representing any domain or use case
 * - **Hierarchical**: Organized into logical categories for easy navigation
 * - **Extensible**: Additional metadata can be attached to any entity or relationship
 * - **Semantic**: Types carry meaning that can be used for reasoning and inference
 *
 * ## Noun Types (Entities)
 *
 * Noun types represent entities in the graph and are organized into categories:
 *
 * ### Core Entity Types
 * - **Person**: Human entities and individuals
 * - **Organization**: Formal organizations, companies, institutions
 * - **Location**: Geographic locations, places, addresses
 * - **Thing**: Physical objects and tangible items
 * - **Concept**: Abstract ideas, concepts, and intangible entities
 * - **Event**: Occurrences with time and place dimensions
 *
 * ### Digital/Content Types
 * - **Document**: Text-based files and documents
 * - **Media**: Non-text media files (images, videos, audio)
 * - **File**: Generic digital files
 * - **Message**: Communication content
 * - **Content**: Generic content that doesn't fit other categories
 *
 * ### Collection Types
 * - **Collection**: Generic groupings of items
 * - **Dataset**: Structured collections of data
 *
 * ### Business/Application Types
 * - **Product**: Commercial products and offerings
 * - **Service**: Services and offerings
 * - **User**: User accounts and profiles
 * - **Task**: Actions, todos, and workflow items
 * - **Project**: Organized initiatives with goals and timelines
 *
 * ### Descriptive Types
 * - **Process**: Workflows, procedures, and sequences
 * - **State**: States, conditions, or statuses
 * - **Role**: Roles, positions, or responsibilities
 * - **Topic**: Subjects or themes
 * - **Language**: Languages or linguistic entities
 * - **Currency**: Currencies and monetary units
 * - **Measurement**: Measurements, metrics, or quantities
 *
 * ## Verb Types (Relationships)
 *
 * Verb types represent relationships between entities and are organized into categories:
 *
 * ### Core Relationship Types
 * - **RelatedTo**: Generic relationship (default fallback)
 * - **Contains**: Containment relationship
 * - **PartOf**: Part-whole relationship
 * - **LocatedAt**: Spatial relationship
 * - **References**: Reference or citation relationship
 *
 * ### Temporal/Causal Types
 * - **Precedes/Succeeds**: Temporal sequence relationships
 * - **Causes**: Causal relationships
 * - **DependsOn**: Dependency relationships
 * - **Requires**: Necessity relationships
 *
 * ### Creation/Transformation Types
 * - **Creates**: Creation relationships
 * - **Transforms**: Transformation relationships
 * - **Becomes**: State change relationships
 * - **Modifies**: Modification relationships
 * - **Consumes**: Consumption relationships
 *
 * ### Ownership/Attribution Types
 * - **Owns**: Ownership relationships
 * - **AttributedTo**: Attribution or authorship
 * - **CreatedBy**: Creation attribution
 * - **BelongsTo**: Belonging relationships
 *
 * ### Social/Organizational Types
 * - **MemberOf**: Membership or affiliation
 * - **WorksWith**: Professional relationships
 * - **FriendOf**: Friendship relationships
 * - **Follows**: Following relationships
 * - **Likes**: Liking relationships
 * - **ReportsTo**: Reporting relationships
 * - **Supervises**: Supervisory relationships
 * - **Mentors**: Mentorship relationships
 * - **Communicates**: Communication relationships
 *
 * ### Descriptive/Functional Types
 * - **Describes**: Descriptive relationships
 * - **Defines**: Definition relationships
 * - **Categorizes**: Categorization relationships
 * - **Measures**: Measurement relationships
 * - **Evaluates**: Evaluation or assessment relationships
 * - **Uses**: Utilization relationships
 * - **Implements**: Implementation relationships
 * - **Extends**: Extension relationships
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
 * ## Modeling Different Graph Types
 *
 * This type system can model various graph structures:
 *
 * ### Knowledge Graphs
 * Use Person, Organization, Location, Concept entities with semantic relationships
 * like AttributedTo, LocatedAt, RelatedTo
 *
 * ### Social Networks
 * Use Person, User entities with social relationships like FriendOf, Follows,
 * WorksWith, Communicates
 *
 * ### Content Networks
 * Use Document, Media, Content entities with relationships like References,
 * CreatedBy, Contains, Categorizes
 *
 * ### Business Process Models
 * Use Task, Process, Role entities with relationships like Precedes, Requires,
 * DependsOn, Transforms
 *
 * ### Organizational Charts
 * Use Person, Role, Organization entities with relationships like ReportsTo,
 * Supervises, MemberOf
 *
 * The flexibility of this system allows it to represent any domain while
 * maintaining semantic consistency and enabling powerful graph operations
 * and reasoning capabilities.
 */
/**
 * Represents a high-precision timestamp with seconds and nanoseconds
 * Used for tracking creation and update times of graph elements
 */
interface Timestamp {
    seconds: number;
    nanoseconds: number;
}
/**
 * Metadata about the creator/source of a graph noun
 * Tracks which augmentation and model created the element
 */
interface CreatorMetadata {
    augmentation: string;
    version: string;
}
/**
 * Base interface for nodes (nouns) in the graph
 * Represents entities like people, places, things, etc.
 */
export interface GraphNoun {
    id: string;
    createdBy: CreatorMetadata;
    noun: NounType;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    label?: string;
    data?: Record<string, any>;
    embeddedVerbs?: EmbeddedGraphVerb[];
    embedding?: number[];
}
/**
 * Base interface for verbs in the graph
 * Represents relationships between nouns
 */
export interface GraphVerb {
    id: string;
    source: string;
    target: string;
    label?: string;
    verb: VerbType;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    createdBy: CreatorMetadata;
    data?: Record<string, any>;
    embedding?: number[];
    confidence?: number;
    weight?: number;
}
/**
 * Version of GraphVerb for embedded relationships
 * Used when the source is implicit from the parent document
 */
export type EmbeddedGraphVerb = Omit<GraphVerb, 'source'>;
/**
 * Represents a person entity in the graph
 */
export interface Person extends GraphNoun {
    noun: typeof NounType.Person;
}
/**
 * Represents a physical location in the graph
 */
export interface Location extends GraphNoun {
    noun: typeof NounType.Location;
}
/**
 * Represents a physical or virtual object in the graph
 */
export interface Thing extends GraphNoun {
    noun: typeof NounType.Thing;
}
/**
 * Represents an event or occurrence in the graph
 */
export interface Event extends GraphNoun {
    noun: typeof NounType.Event;
}
/**
 * Represents an abstract concept or idea in the graph
 */
export interface Concept extends GraphNoun {
    noun: typeof NounType.Concept;
}
export interface Collection extends GraphNoun {
    noun: typeof NounType.Collection;
}
export interface Organization extends GraphNoun {
    noun: typeof NounType.Organization;
}
export interface Document extends GraphNoun {
    noun: typeof NounType.Document;
}
export interface Media extends GraphNoun {
    noun: typeof NounType.Media;
}
export interface File extends GraphNoun {
    noun: typeof NounType.File;
}
export interface Message extends GraphNoun {
    noun: typeof NounType.Message;
}
export interface Dataset extends GraphNoun {
    noun: typeof NounType.Dataset;
}
export interface Product extends GraphNoun {
    noun: typeof NounType.Product;
}
export interface Service extends GraphNoun {
    noun: typeof NounType.Service;
}
export interface User extends GraphNoun {
    noun: typeof NounType.User;
}
export interface Task extends GraphNoun {
    noun: typeof NounType.Task;
}
export interface Project extends GraphNoun {
    noun: typeof NounType.Project;
}
export interface Process extends GraphNoun {
    noun: typeof NounType.Process;
}
export interface State extends GraphNoun {
    noun: typeof NounType.State;
}
export interface Role extends GraphNoun {
    noun: typeof NounType.Role;
}
export interface Topic extends GraphNoun {
    noun: typeof NounType.Topic;
}
export interface Language extends GraphNoun {
    noun: typeof NounType.Language;
}
export interface Currency extends GraphNoun {
    noun: typeof NounType.Currency;
}
export interface Measurement extends GraphNoun {
    noun: typeof NounType.Measurement;
}
/**
 * Represents content (text, media, etc.) in the graph
 */
export interface Content extends GraphNoun {
    noun: typeof NounType.Content;
}
/**
 * Represents a scientific hypothesis or theory in the graph
 */
export interface Hypothesis extends GraphNoun {
    noun: typeof NounType.Hypothesis;
}
/**
 * Represents an experiment, study, or research trial in the graph
 */
export interface Experiment extends GraphNoun {
    noun: typeof NounType.Experiment;
}
/**
 * Represents a legal contract or agreement in the graph
 */
export interface Contract extends GraphNoun {
    noun: typeof NounType.Contract;
}
/**
 * Represents a regulation, law, or compliance requirement in the graph
 */
export interface Regulation extends GraphNoun {
    noun: typeof NounType.Regulation;
}
/**
 * Represents an interface, API, or protocol specification in the graph
 */
export interface Interface extends GraphNoun {
    noun: typeof NounType.Interface;
}
/**
 * Represents a computational or infrastructure resource in the graph
 */
export interface Resource extends GraphNoun {
    noun: typeof NounType.Resource;
}
/**
 * Defines valid noun types for graph entities
 * Used for categorizing different types of nodes
 */
export declare const NounType: {
    readonly Person: "person";
    readonly Organization: "organization";
    readonly Location: "location";
    readonly Thing: "thing";
    readonly Concept: "concept";
    readonly Event: "event";
    readonly Document: "document";
    readonly Media: "media";
    readonly File: "file";
    readonly Message: "message";
    readonly Content: "content";
    readonly Collection: "collection";
    readonly Dataset: "dataset";
    readonly Product: "product";
    readonly Service: "service";
    readonly User: "user";
    readonly Task: "task";
    readonly Project: "project";
    readonly Process: "process";
    readonly State: "state";
    readonly Role: "role";
    readonly Topic: "topic";
    readonly Language: "language";
    readonly Currency: "currency";
    readonly Measurement: "measurement";
    readonly Hypothesis: "hypothesis";
    readonly Experiment: "experiment";
    readonly Contract: "contract";
    readonly Regulation: "regulation";
    readonly Interface: "interface";
    readonly Resource: "resource";
};
export type NounType = (typeof NounType)[keyof typeof NounType];
/**
 * Defines valid verb types for relationships
 * Used for categorizing different types of connections
 */
export declare const VerbType: {
    readonly RelatedTo: "relatedTo";
    readonly Contains: "contains";
    readonly PartOf: "partOf";
    readonly LocatedAt: "locatedAt";
    readonly References: "references";
    readonly Precedes: "precedes";
    readonly Succeeds: "succeeds";
    readonly Causes: "causes";
    readonly DependsOn: "dependsOn";
    readonly Requires: "requires";
    readonly Creates: "creates";
    readonly Transforms: "transforms";
    readonly Becomes: "becomes";
    readonly Modifies: "modifies";
    readonly Consumes: "consumes";
    readonly Owns: "owns";
    readonly AttributedTo: "attributedTo";
    readonly CreatedBy: "createdBy";
    readonly BelongsTo: "belongsTo";
    readonly MemberOf: "memberOf";
    readonly WorksWith: "worksWith";
    readonly FriendOf: "friendOf";
    readonly Follows: "follows";
    readonly Likes: "likes";
    readonly ReportsTo: "reportsTo";
    readonly Supervises: "supervises";
    readonly Mentors: "mentors";
    readonly Communicates: "communicates";
    readonly Describes: "describes";
    readonly Defines: "defines";
    readonly Categorizes: "categorizes";
    readonly Measures: "measures";
    readonly Evaluates: "evaluates";
    readonly Uses: "uses";
    readonly Implements: "implements";
    readonly Extends: "extends";
    readonly Inherits: "inherits";
    readonly Conflicts: "conflicts";
    readonly Synchronizes: "synchronizes";
    readonly Competes: "competes";
};
export type VerbType = (typeof VerbType)[keyof typeof VerbType];
export {};
