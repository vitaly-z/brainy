/**
 * Build Keyword Embeddings - Generate pre-computed embeddings for all keywords
 *
 * Extracts keywords from TypeInferenceSystem, adds strategic synonyms,
 * and generates semantic embeddings for fast type inference.
 *
 * Output: src/neural/embeddedKeywordEmbeddings.ts (~2-3MB)
 * Runtime: ~60-90 seconds (one-time build cost)
 */

import { TransformerEmbedding } from '../src/utils/embedding.js'
import { NounType, VerbType } from '../src/types/graphTypes.js'
import { writeFileSync } from 'fs'
import { prodLog } from '../src/utils/logger.js'

interface KeywordDefinition {
  keyword: string
  type: NounType | VerbType
  typeCategory: 'noun' | 'verb'
  confidence: number
  isCanonical: boolean
}

/**
 * Extract and expand keywords with synonyms (NOUNS + VERBS)
 */
function buildExpandedKeywordList(): KeywordDefinition[] {
  const keywords: KeywordDefinition[] = []

  // Helper to add noun keywords
  const addNoun = (words: string[], type: NounType, confidence: number, isCanonical = true) => {
    for (const word of words) {
      keywords.push({ keyword: word, type, typeCategory: 'noun', confidence, isCanonical })
    }
  }

  // Helper to add verb keywords
  const addVerb = (words: string[], type: VerbType, confidence: number, isCanonical = true) => {
    for (const word of words) {
      keywords.push({ keyword: word, type, typeCategory: 'verb', confidence, isCanonical })
    }
  }

  // Legacy alias for noun keywords
  const add = addNoun

  // ========== Person Type ==========
  // Core professional roles (canonical)
  add(['person', 'people', 'individual', 'human'], NounType.Person, 0.95, true)
  add(['employee', 'worker', 'staff', 'personnel'], NounType.Person, 0.90, true)

  // Engineering & Tech
  add(['engineer', 'developer', 'programmer', 'architect', 'designer', 'technician'], NounType.Person, 0.95, true)
  add(['coder', 'techie'], NounType.Person, 0.85, false) // Synonyms

  // Medical
  add(['doctor', 'physician', 'surgeon', 'nurse', 'therapist'], NounType.Person, 0.95, true)
  add(['cardiologist', 'oncologist', 'neurologist', 'psychiatrist', 'psychologist'], NounType.Person, 0.90, true)
  add(['radiologist', 'pathologist', 'anesthesiologist', 'dermatologist'], NounType.Person, 0.90, true)
  add(['pediatrician', 'obstetrician', 'gynecologist', 'ophthalmologist'], NounType.Person, 0.90, true)
  add(['dentist', 'orthodontist', 'pharmacist', 'paramedic', 'emt'], NounType.Person, 0.90, true)
  add(['medic', 'practitioner', 'clinician'], NounType.Person, 0.85, false) // Medical synonyms

  // Management & Leadership
  add(['manager', 'director', 'executive', 'leader', 'supervisor', 'coordinator'], NounType.Person, 0.95, true)
  add(['ceo', 'cto', 'cfo', 'coo', 'vp', 'president', 'founder', 'owner'], NounType.Person, 0.95, true)

  // Professional services
  add(['analyst', 'consultant', 'specialist', 'expert', 'professional'], NounType.Person, 0.90, true)
  add(['lawyer', 'attorney', 'judge', 'paralegal'], NounType.Person, 0.95, true)
  add(['accountant', 'auditor', 'banker', 'trader', 'broker'], NounType.Person, 0.90, true)
  add(['advisor', 'counselor'], NounType.Person, 0.85, false)

  // Education & Research
  add(['teacher', 'professor', 'instructor', 'educator', 'tutor'], NounType.Person, 0.95, true)
  add(['student', 'pupil', 'learner', 'trainee', 'intern'], NounType.Person, 0.90, true)
  add(['researcher', 'scientist', 'scholar', 'academic'], NounType.Person, 0.95, true)

  // Creative professions
  add(['artist', 'musician', 'painter', 'sculptor', 'performer'], NounType.Person, 0.90, true)
  add(['author', 'writer', 'journalist', 'editor', 'reporter'], NounType.Person, 0.90, true)

  // Sales & Marketing
  add(['salesperson', 'marketer', 'recruiter', 'agent'], NounType.Person, 0.85, true)

  // Social relationships
  add(['friend', 'colleague', 'coworker', 'teammate', 'partner'], NounType.Person, 0.85, true)
  add(['customer', 'client', 'vendor', 'supplier', 'contractor'], NounType.Person, 0.85, true)
  add(['mentor', 'mentee', 'coach', 'volunteer', 'activist', 'advocate', 'supporter'], NounType.Person, 0.80, true)

  // Demographics
  add(['male', 'female', 'adult', 'child', 'teen', 'senior', 'junior'], NounType.Person, 0.75, true)

  // Multi-word professions (important for semantic matching)
  add(['software engineer', 'software developer', 'web developer'], NounType.Person, 0.95, true)
  add(['data scientist', 'data engineer', 'machine learning engineer', 'ml engineer'], NounType.Person, 0.95, true)
  add(['product manager', 'project manager', 'engineering manager'], NounType.Person, 0.95, true)
  add(['ux designer', 'ui designer', 'graphic designer'], NounType.Person, 0.90, true)
  add(['medical doctor', 'registered nurse', 'healthcare worker'], NounType.Person, 0.90, false)

  // ========== Organization Type ==========
  add(['organization', 'company', 'business', 'corporation', 'enterprise'], NounType.Organization, 0.95, true)
  add(['firm', 'agency', 'bureau', 'office', 'department'], NounType.Organization, 0.90, true)
  add(['startup', 'venture', 'subsidiary', 'branch', 'division'], NounType.Organization, 0.90, true)
  add(['institution', 'foundation', 'association', 'society', 'club'], NounType.Organization, 0.90, true)
  add(['nonprofit', 'ngo', 'charity', 'trust', 'federation'], NounType.Organization, 0.90, true)
  add(['government', 'ministry', 'administration', 'authority'], NounType.Organization, 0.90, true)
  add(['university', 'college', 'school', 'academy', 'institute'], NounType.Organization, 0.90, true)
  add(['hospital', 'clinic', 'medical center'], NounType.Organization, 0.90, true)
  add(['bank', 'credit union'], NounType.Organization, 0.90, true)
  add(['manufacturer', 'factory', 'plant', 'facility'], NounType.Organization, 0.85, true)
  add(['retailer', 'store', 'shop', 'outlet', 'chain'], NounType.Organization, 0.85, true)
  add(['restaurant', 'hotel', 'resort', 'casino'], NounType.Organization, 0.85, true)
  add(['publisher', 'studio', 'gallery', 'museum', 'library'], NounType.Organization, 0.85, true)
  add(['lab', 'laboratory', 'research center'], NounType.Organization, 0.85, true)
  add(['team', 'squad', 'crew', 'group', 'committee'], NounType.Organization, 0.80, true)

  // Organization synonyms
  add(['corp', 'inc', 'llc', 'ltd'], NounType.Organization, 0.85, false)

  // ========== Location Type ==========
  add(['location', 'place', 'area', 'region', 'zone', 'district'], NounType.Location, 0.90, true)
  add(['city', 'town', 'village', 'municipality', 'metro'], NounType.Location, 0.95, true)
  add(['country', 'nation', 'state', 'province', 'territory'], NounType.Location, 0.95, true)
  add(['county', 'parish', 'prefecture', 'canton'], NounType.Location, 0.85, true)
  add(['continent', 'island', 'peninsula', 'archipelago'], NounType.Location, 0.90, true)
  add(['street', 'road', 'avenue', 'boulevard', 'lane', 'drive'], NounType.Location, 0.85, true)
  add(['address', 'building', 'structure', 'tower', 'complex'], NounType.Location, 0.85, true)
  add(['headquarters', 'hq', 'campus', 'site'], NounType.Location, 0.85, true)
  add(['center', 'venue', 'space', 'room'], NounType.Location, 0.80, true)
  add(['warehouse', 'depot', 'terminal', 'station', 'port'], NounType.Location, 0.85, true)
  add(['park', 'garden', 'plaza', 'square', 'mall'], NounType.Location, 0.85, true)
  add(['neighborhood', 'suburb', 'downtown', 'uptown'], NounType.Location, 0.80, true)
  add(['north', 'south', 'east', 'west', 'central'], NounType.Location, 0.70, true)
  add(['coastal', 'inland', 'urban', 'rural', 'remote'], NounType.Location, 0.70, true)

  // Common cities (for better semantic matching)
  add(['san francisco', 'new york', 'los angeles', 'chicago', 'boston'], NounType.Location, 0.95, true)
  add(['seattle', 'austin', 'denver', 'portland', 'miami'], NounType.Location, 0.95, true)
  add(['london', 'paris', 'berlin', 'tokyo', 'beijing'], NounType.Location, 0.95, true)
  add(['silicon valley', 'bay area', 'new york city', 'washington dc'], NounType.Location, 0.95, true)

  // ========== Document Type ==========
  add(['document', 'file', 'text', 'writing', 'manuscript'], NounType.Document, 0.95, true)
  add(['report', 'summary', 'brief', 'overview', 'analysis'], NounType.Document, 0.90, true)
  add(['article', 'essay', 'paper', 'publication', 'journal'], NounType.Document, 0.90, true)
  add(['book', 'ebook', 'novel', 'chapter', 'volume'], NounType.Document, 0.90, true)
  add(['manual', 'guide', 'handbook', 'reference', 'documentation'], NounType.Document, 0.90, true)
  add(['tutorial', 'walkthrough', 'instructions'], NounType.Document, 0.85, true)
  add(['specification', 'spec', 'standard', 'protocol'], NounType.Document, 0.85, true)
  add(['proposal', 'pitch', 'presentation', 'slide', 'deck'], NounType.Document, 0.85, true)
  add(['contract', 'agreement', 'license', 'terms', 'policy'], NounType.Document, 0.90, true)
  add(['invoice', 'receipt', 'statement', 'bill', 'voucher'], NounType.Document, 0.85, true)
  add(['form', 'application', 'survey', 'questionnaire'], NounType.Document, 0.85, true)
  add(['transcript', 'minutes', 'record', 'log', 'entry'], NounType.Document, 0.85, true)
  add(['note', 'memo', 'message', 'email', 'letter'], NounType.Document, 0.85, true)
  add(['whitepaper', 'thesis', 'dissertation', 'abstract'], NounType.Document, 0.90, true)
  add(['readme', 'changelog', 'wiki'], NounType.Document, 0.85, true)
  add(['cv', 'resume', 'portfolio', 'profile'], NounType.Document, 0.85, true)

  // Document synonyms
  add(['doc', 'docs', 'howto'], NounType.Document, 0.80, false)

  // ========== Media Type ==========
  add(['media', 'multimedia', 'content'], NounType.Media, 0.90, true)
  add(['image', 'photo', 'picture', 'photograph', 'illustration'], NounType.Media, 0.90, true)
  add(['graphic', 'icon', 'logo', 'banner', 'thumbnail'], NounType.Media, 0.85, true)
  add(['video', 'movie', 'film', 'clip', 'recording'], NounType.Media, 0.90, true)
  add(['animation', 'gif', 'stream', 'broadcast'], NounType.Media, 0.85, true)
  add(['audio', 'sound', 'music', 'song', 'track', 'album'], NounType.Media, 0.90, true)
  add(['podcast', 'episode', 'audiobook'], NounType.Media, 0.85, true)
  add(['screenshot', 'asset', 'resource', 'attachment'], NounType.Media, 0.80, true)

  // ========== Concept Type ==========
  add(['concept', 'idea', 'notion', 'theory', 'principle'], NounType.Concept, 0.90, true)
  add(['philosophy', 'ideology', 'belief', 'doctrine'], NounType.Concept, 0.85, true)
  add(['topic', 'subject', 'theme', 'matter', 'issue'], NounType.Concept, 0.85, true)
  add(['category', 'classification', 'taxonomy', 'domain'], NounType.Concept, 0.80, true)
  add(['field', 'discipline', 'specialty'], NounType.Concept, 0.85, true)
  add(['technology', 'tech', 'innovation', 'invention'], NounType.Concept, 0.90, true)
  add(['science', 'scientific', 'research'], NounType.Concept, 0.90, true)

  // Scientific domains
  add(['mathematics', 'math', 'statistics', 'algebra', 'calculus'], NounType.Concept, 0.85, true)
  add(['physics', 'quantum', 'mechanics', 'thermodynamics'], NounType.Concept, 0.85, true)
  add(['chemistry', 'biology', 'genetics', 'neuroscience'], NounType.Concept, 0.85, true)
  add(['engineering', 'architecture', 'design'], NounType.Concept, 0.85, true)

  // Computer science
  add(['computer science', 'programming', 'algorithm'], NounType.Concept, 0.90, true)
  add(['artificial intelligence', 'machine learning', 'deep learning'], NounType.Concept, 0.95, true)
  add(['ai', 'ml'], NounType.Concept, 0.90, true)
  add(['data science', 'analytics', 'big data'], NounType.Concept, 0.90, true)
  add(['natural language processing', 'computer vision'], NounType.Concept, 0.90, true)

  // Humanities
  add(['history', 'literature', 'poetry', 'fiction'], NounType.Concept, 0.85, true)
  add(['art', 'music', 'sports'], NounType.Concept, 0.85, true)
  add(['politics', 'economics', 'psychology', 'sociology'], NounType.Concept, 0.85, true)
  add(['religion', 'spiritual', 'philosophy'], NounType.Concept, 0.85, true)

  // ========== Event Type ==========
  add(['event', 'occasion', 'happening', 'occurrence'], NounType.Event, 0.90, true)
  add(['meeting', 'conference', 'summit', 'convention'], NounType.Event, 0.90, true)
  add(['seminar', 'symposium', 'forum', 'workshop'], NounType.Event, 0.90, true)
  add(['training', 'bootcamp', 'course', 'webinar'], NounType.Event, 0.85, true)
  add(['presentation', 'talk', 'lecture', 'session', 'class'], NounType.Event, 0.85, true)
  add(['party', 'celebration', 'gathering', 'ceremony'], NounType.Event, 0.85, true)
  add(['festival', 'carnival', 'fair', 'exhibition'], NounType.Event, 0.85, true)
  add(['concert', 'performance', 'show'], NounType.Event, 0.85, true)
  add(['game', 'match', 'tournament', 'championship', 'race'], NounType.Event, 0.85, true)
  add(['launch', 'release', 'premiere', 'debut', 'announcement'], NounType.Event, 0.85, true)

  // ========== Product Type ==========
  add(['product', 'item', 'goods', 'merchandise', 'commodity'], NounType.Product, 0.90, true)
  add(['offering', 'solution', 'package', 'bundle'], NounType.Product, 0.85, true)
  add(['software', 'app', 'application', 'program', 'tool'], NounType.Product, 0.90, true)
  add(['platform', 'system', 'framework', 'library'], NounType.Product, 0.85, true)
  add(['device', 'gadget', 'machine', 'equipment'], NounType.Product, 0.85, true)
  add(['hardware', 'component', 'part', 'accessory'], NounType.Product, 0.85, true)
  add(['vehicle', 'car', 'automobile', 'truck', 'bike'], NounType.Product, 0.85, true)
  add(['phone', 'smartphone', 'mobile', 'tablet'], NounType.Product, 0.90, true)
  add(['computer', 'laptop', 'desktop', 'pc', 'mac'], NounType.Product, 0.90, true)
  add(['watch', 'wearable', 'tracker', 'monitor'], NounType.Product, 0.85, true)
  add(['camera', 'lens', 'sensor', 'scanner'], NounType.Product, 0.85, true)

  // ========== Service Type ==========
  add(['service', 'support', 'assistance'], NounType.Service, 0.90, true)
  add(['consulting', 'advisory', 'guidance'], NounType.Service, 0.85, true)
  add(['maintenance', 'repair', 'installation', 'setup'], NounType.Service, 0.85, true)
  add(['hosting', 'cloud', 'saas', 'paas', 'iaas'], NounType.Service, 0.85, true)
  add(['delivery', 'shipping', 'logistics', 'transport'], NounType.Service, 0.85, true)
  add(['subscription', 'membership', 'plan'], NounType.Service, 0.85, true)
  add(['training', 'education', 'coaching', 'mentoring'], NounType.Service, 0.85, true)
  add(['healthcare', 'medical', 'dental', 'therapy'], NounType.Service, 0.85, true)
  add(['legal', 'accounting', 'financial', 'insurance'], NounType.Service, 0.85, true)
  add(['marketing', 'advertising', 'promotion'], NounType.Service, 0.85, true)

  // ========== User Type ==========
  add(['user', 'account', 'profile', 'identity'], NounType.Person, 0.90, true)
  add(['username', 'login', 'credential'], NounType.Person, 0.85, true)
  add(['subscriber', 'follower', 'fan', 'supporter'], NounType.Person, 0.85, true)
  add(['member', 'participant', 'contributor', 'author'], NounType.Person, 0.85, true)
  add(['viewer', 'reader', 'listener', 'watcher'], NounType.Person, 0.80, true)
  add(['player', 'gamer', 'competitor'], NounType.Person, 0.80, true)
  add(['guest', 'visitor', 'attendee'], NounType.Person, 0.80, true)

  // ========== Task & Project Types ==========
  add(['task', 'todo', 'action', 'activity', 'job'], NounType.Task, 0.85, true)
  add(['assignment', 'duty', 'work'], NounType.Task, 0.85, true)
  add(['ticket', 'issue', 'bug', 'defect', 'problem'], NounType.Task, 0.85, true)
  add(['feature', 'enhancement', 'improvement', 'request'], NounType.Task, 0.85, true)
  add(['project', 'program', 'initiative'], NounType.Project, 0.90, true)
  add(['campaign', 'drive', 'venture'], NounType.Project, 0.85, true)
  add(['plan', 'strategy', 'roadmap'], NounType.Project, 0.85, true)
  add(['milestone', 'deliverable', 'objective', 'goal'], NounType.Project, 0.85, true)
  add(['sprint', 'iteration', 'cycle', 'phase'], NounType.Project, 0.80, true)

  // ========== Other Types ==========
  add(['process', 'procedure', 'method', 'approach'], NounType.Process, 0.80, true)
  add(['workflow', 'pipeline', 'sequence'], NounType.Process, 0.80, true)
  add(['algorithm', 'logic', 'routine', 'operation'], NounType.Process, 0.75, true)

  add(['collection', 'set', 'group', 'batch'], NounType.Collection, 0.80, true)
  add(['list', 'array', 'series'], NounType.Collection, 0.80, true)
  add(['dataset', 'data', 'database'], NounType.Collection, 0.85, true)
  add(['repository', 'archive', 'library'], NounType.Collection, 0.80, true)

  add(['state', 'status', 'condition'], NounType.State, 0.75, true)
  add(['active', 'inactive', 'pending', 'completed'], NounType.State, 0.70, true)

  add(['role', 'position', 'title'], NounType.Role, 0.80, true)
  add(['permission', 'access', 'privilege'], NounType.Role, 0.75, true)

  add(['hypothesis', 'theory', 'conjecture'], NounType.Hypothesis, 0.85, true)
  add(['experiment', 'study', 'trial', 'test'], NounType.Experiment, 0.85, true)
  add(['regulation', 'rule', 'law', 'statute'], NounType.Regulation, 0.85, true)
  add(['interface', 'api', 'endpoint'], NounType.Interface, 0.85, true)
  add(['resource', 'asset', 'capacity'], NounType.Resource, 0.80, true)

  // ==================== VERB TYPES ====================
  // Now add all 40 VerbTypes with keywords and synonyms

  console.log('\n  Adding verb keywords...')

  // ========== Core Relationship Types ==========
  addVerb(['related to', 'related', 'connected to', 'associated with', 'linked to'], VerbType.RelatedTo, 0.90, true)
  addVerb(['connection', 'association', 'link', 'relationship'], VerbType.RelatedTo, 0.85, false)

  addVerb(['contains', 'includes', 'has', 'comprises', 'encompasses'], VerbType.Contains, 0.95, true)
  addVerb(['holding', 'containing', 'including'], VerbType.Contains, 0.85, false)

  addVerb(['part of', 'belongs to', 'component of', 'element of', 'member of'], VerbType.PartOf, 0.95, true)
  addVerb(['within', 'inside', 'subset of'], VerbType.PartOf, 0.85, false)

  addVerb(['located at', 'positioned at', 'situated at', 'found at', 'based at'], VerbType.LocatedAt, 0.95, true)
  addVerb(['location', 'position', 'whereabouts'], VerbType.LocatedAt, 0.85, false)

  addVerb(['references', 'cites', 'refers to', 'mentions', 'points to'], VerbType.References, 0.95, true)
  addVerb(['citation', 'reference', 'pointer'], VerbType.References, 0.85, false)

  // ========== Temporal/Causal Types ==========
  addVerb(['precedes', 'comes before', 'happens before', 'leads to', 'prior to'], VerbType.Precedes, 0.90, true)
  addVerb(['preceding', 'earlier than', 'before'], VerbType.Precedes, 0.85, false)

  addVerb(['succeeds', 'comes after', 'follows', 'happens after', 'subsequent to'], VerbType.Precedes, 0.90, true)
  addVerb(['succeeding', 'later than', 'after'], VerbType.Precedes, 0.85, false)

  addVerb(['causes', 'results in', 'leads to', 'brings about', 'triggers'], VerbType.Causes, 0.95, true)
  addVerb(['influences', 'affects', 'impacts', 'produces'], VerbType.Causes, 0.90, true)
  addVerb(['causation', 'consequence', 'effect'], VerbType.Causes, 0.85, false)

  addVerb(['depends on', 'relies on', 'contingent on', 'conditional on'], VerbType.DependsOn, 0.95, true)
  addVerb(['dependency', 'reliance', 'dependence'], VerbType.DependsOn, 0.85, false)

  addVerb(['requires', 'needs', 'necessitates', 'demands', 'calls for'], VerbType.Requires, 0.95, true)
  addVerb(['requirement', 'necessity', 'prerequisite'], VerbType.Requires, 0.85, false)

  // ========== Creation/Transformation Types ==========
  addVerb(['creates', 'makes', 'builds', 'produces', 'generates'], VerbType.Creates, 0.95, true)
  addVerb(['constructs', 'develops', 'crafts', 'forms'], VerbType.Creates, 0.90, true)
  addVerb(['creation', 'production', 'generation'], VerbType.Creates, 0.85, false)

  addVerb(['transforms', 'converts', 'changes', 'morphs', 'alters'], VerbType.Transforms, 0.95, true)
  addVerb(['transformation', 'conversion', 'metamorphosis'], VerbType.Transforms, 0.85, false)

  addVerb(['becomes', 'turns into', 'evolves into', 'transitions to'], VerbType.Becomes, 0.95, true)
  addVerb(['becoming', 'transition', 'evolution'], VerbType.Becomes, 0.85, false)

  addVerb(['modifies', 'updates', 'changes', 'edits', 'adjusts'], VerbType.Modifies, 0.95, true)
  addVerb(['alters', 'amends', 'revises', 'tweaks'], VerbType.Modifies, 0.90, true)
  addVerb(['modification', 'update', 'change'], VerbType.Modifies, 0.85, false)

  addVerb(['consumes', 'uses up', 'depletes', 'exhausts', 'drains'], VerbType.Consumes, 0.95, true)
  addVerb(['consumption', 'usage', 'depletion'], VerbType.Consumes, 0.85, false)

  // ========== Ownership/Attribution Types ==========
  addVerb(['owns', 'possesses', 'holds', 'controls', 'has'], VerbType.Owns, 0.95, true)
  addVerb(['ownership', 'possession', 'control'], VerbType.Owns, 0.85, false)

  addVerb(['attributed to', 'credited to', 'ascribed to', 'assigned to'], VerbType.AttributedTo, 0.95, true)
  addVerb(['attribution', 'credit', 'acknowledgment'], VerbType.AttributedTo, 0.85, false)

  addVerb(['created by', 'made by', 'built by', 'authored by', 'developed by'], VerbType.Creates, 0.95, true)
  addVerb(['creator', 'author', 'maker'], VerbType.Creates, 0.85, false)

  addVerb(['belongs to', 'owned by', 'property of', 'part of'], VerbType.Owns, 0.95, true)
  addVerb(['belonging', 'membership'], VerbType.Owns, 0.85, false)

  // ========== Social/Organizational Types ==========
  addVerb(['member of', 'belongs to', 'affiliated with', 'part of'], VerbType.MemberOf, 0.95, true)
  addVerb(['works for', 'employed by', 'serves'], VerbType.MemberOf, 0.90, true)
  addVerb(['membership', 'affiliation'], VerbType.MemberOf, 0.85, false)

  addVerb(['works with', 'collaborates with', 'partners with', 'cooperates with'], VerbType.WorksWith, 0.95, true)
  addVerb(['teams with', 'joins forces with'], VerbType.WorksWith, 0.90, true)
  addVerb(['collaboration', 'partnership', 'cooperation'], VerbType.WorksWith, 0.85, false)

  addVerb(['friend of', 'friends with', 'befriends', 'friendly with'], VerbType.FriendOf, 0.95, true)
  addVerb(['friendship', 'companionship'], VerbType.FriendOf, 0.85, false)

  addVerb(['follows', 'tracks', 'monitors', 'subscribes to', 'watches'], VerbType.Follows, 0.95, true)
  addVerb(['following', 'follower', 'subscriber'], VerbType.Follows, 0.85, false)

  addVerb(['likes', 'enjoys', 'prefers', 'favors', 'appreciates'], VerbType.Likes, 0.95, true)
  addVerb(['fond of', 'partial to'], VerbType.Likes, 0.90, true)

  addVerb(['reports to', 'answers to', 'subordinate to', 'under'], VerbType.ReportsTo, 0.95, true)
  addVerb(['reporting', 'subordination'], VerbType.ReportsTo, 0.85, false)

  addVerb(['supervises', 'manages', 'oversees', 'directs', 'leads'], VerbType.ReportsTo, 0.95, true)
  addVerb(['supervision', 'management', 'oversight'], VerbType.ReportsTo, 0.85, false)

  addVerb(['mentors', 'coaches', 'guides', 'advises', 'teaches'], VerbType.Mentors, 0.95, true)
  addVerb(['mentorship', 'coaching', 'guidance'], VerbType.Mentors, 0.85, false)

  addVerb(['communicates with', 'talks to', 'corresponds with', 'exchanges with'], VerbType.Communicates, 0.95, true)
  addVerb(['speaks with', 'chats with', 'discusses with'], VerbType.Communicates, 0.90, true)
  addVerb(['communication', 'correspondence', 'dialogue'], VerbType.Communicates, 0.85, false)

  // ========== Descriptive/Functional Types ==========
  addVerb(['describes', 'explains', 'details', 'characterizes', 'portrays'], VerbType.Describes, 0.95, true)
  addVerb(['depicts', 'illustrates', 'outlines'], VerbType.Describes, 0.90, true)
  addVerb(['description', 'explanation', 'account'], VerbType.Describes, 0.85, false)

  addVerb(['defines', 'specifies', 'determines', 'establishes', 'sets'], VerbType.Defines, 0.95, true)
  addVerb(['definition', 'specification', 'determination'], VerbType.Defines, 0.85, false)

  addVerb(['categorizes', 'classifies', 'groups', 'sorts', 'organizes'], VerbType.Categorizes, 0.95, true)
  addVerb(['categorization', 'classification', 'taxonomy'], VerbType.Categorizes, 0.85, false)

  addVerb(['measures', 'quantifies', 'gauges', 'assesses', 'evaluates'], VerbType.Measures, 0.95, true)
  addVerb(['measurement', 'quantification', 'assessment'], VerbType.Measures, 0.85, false)

  addVerb(['evaluates', 'assesses', 'judges', 'appraises', 'reviews'], VerbType.Evaluates, 0.95, true)
  addVerb(['rates', 'scores', 'critiques'], VerbType.Evaluates, 0.90, true)
  addVerb(['evaluation', 'assessment', 'appraisal'], VerbType.Evaluates, 0.85, false)

  addVerb(['uses', 'utilizes', 'employs', 'applies', 'leverages'], VerbType.Uses, 0.95, true)
  addVerb(['usage', 'utilization', 'application'], VerbType.Uses, 0.85, false)

  addVerb(['implements', 'executes', 'realizes', 'enacts', 'carries out'], VerbType.Implements, 0.95, true)
  addVerb(['implementation', 'execution', 'realization'], VerbType.Implements, 0.85, false)

  addVerb(['extends', 'expands', 'broadens', 'enlarges', 'builds on'], VerbType.Extends, 0.95, true)
  addVerb(['enhances', 'augments', 'amplifies'], VerbType.Extends, 0.90, true)
  addVerb(['extension', 'expansion', 'enhancement'], VerbType.Extends, 0.85, false)

  // ========== Enhanced Relationship Types ==========
  addVerb(['inherits', 'derives from', 'inherits from', 'descended from'], VerbType.Inherits, 0.95, true)
  addVerb(['inheritance', 'derivation', 'legacy'], VerbType.Inherits, 0.85, false)

  addVerb(['conflicts with', 'contradicts', 'opposes', 'clashes with'], VerbType.Conflicts, 0.95, true)
  addVerb(['disagrees with', 'incompatible with'], VerbType.Conflicts, 0.90, true)
  addVerb(['conflict', 'contradiction', 'opposition'], VerbType.Conflicts, 0.85, false)

  addVerb(['synchronizes with', 'coordinates with', 'syncs with', 'aligns with'], VerbType.Synchronizes, 0.95, true)
  addVerb(['synchronization', 'coordination', 'alignment'], VerbType.Synchronizes, 0.85, false)

  addVerb(['competes with', 'rivals', 'contests', 'vies with'], VerbType.Competes, 0.95, true)
  addVerb(['competition', 'rivalry', 'contest'], VerbType.Competes, 0.85, false)

  return keywords
}

/**
 * Main build function
 */
async function buildKeywordEmbeddings() {
  console.log('🔨 Building Keyword Embeddings for Semantic Type Inference\n')
  console.log('='.repeat(70))

  // Step 1: Build keyword list
  console.log('\n📝 Step 1: Building expanded keyword dictionary...')
  const keywords = buildExpandedKeywordList()

  const canonical = keywords.filter(k => k.isCanonical).length
  const synonyms = keywords.filter(k => !k.isCanonical).length

  console.log(`✅ Generated ${keywords.length} keywords (${canonical} canonical, ${synonyms} synonyms)`)

  // Step 2: Initialize embedder
  console.log('\n🎯 Step 2: Initializing TransformerEmbedding model...')
  const embedder = new TransformerEmbedding({ verbose: true })
  await embedder.init()
  console.log('✅ Embedder initialized')

  // Step 3: Generate embeddings
  console.log(`\n🚀 Step 3: Generating embeddings for ${keywords.length} keywords...`)
  console.log('(This may take 60-90 seconds)\n')

  const embeddings = []
  let processed = 0
  const startTime = Date.now()

  for (const def of keywords) {
    const embedding = await embedder.embed(def.keyword)

    embeddings.push({
      keyword: def.keyword,
      type: def.type,
      typeCategory: def.typeCategory,
      confidence: def.confidence,
      isCanonical: def.isCanonical,
      embedding: Array.from(embedding)
    })

    processed++
    if (processed % 50 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      const rate = (processed / (Date.now() - startTime) * 1000).toFixed(1)
      const eta = ((keywords.length - processed) / parseFloat(rate)).toFixed(0)
      console.log(`  Progress: ${processed}/${keywords.length} (${(processed/keywords.length*100).toFixed(1)}%) - ${rate}/sec - ETA: ${eta}s`)
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\n✅ All embeddings generated in ${totalTime}s`)

  // Step 4: Generate TypeScript file
  console.log('\n📄 Step 4: Writing embeddedKeywordEmbeddings.ts...')

  const sizeKB = (embeddings.length * 384 * 4 / 1024).toFixed(1)
  const sizeMB = (parseFloat(sizeKB) / 1024).toFixed(2)

  // Calculate stats
  const nounKeywords = embeddings.filter(e => e.typeCategory === 'noun').length
  const verbKeywords = embeddings.filter(e => e.typeCategory === 'verb').length
  const canonicalKeywords = embeddings.filter(e => e.isCanonical).length
  const synonymKeywords = embeddings.filter(e => !e.isCanonical).length

  const output = `/**
 * Pre-computed Keyword Embeddings for Unified Semantic Type Inference
 *
 * Generated by: scripts/buildKeywordEmbeddings.ts
 * Generated on: ${new Date().toISOString()}
 * Total keywords: ${embeddings.length} (${nounKeywords} nouns + ${verbKeywords} verbs)
 * Canonical: ${canonicalKeywords}, Synonyms: ${synonymKeywords}
 * Embedding dimension: 384
 * Total size: ${sizeMB}MB
 *
 * This file contains pre-computed semantic embeddings for ALL type inference keywords.
 * Supports unified noun + verb semantic inference via SemanticTypeInference.
 * Used for O(log n) semantic matching via HNSW index.
 */

import { NounType, VerbType } from '../types/graphTypes.js'
import { Vector } from '../coreTypes.js'

export interface KeywordEmbedding {
  keyword: string
  type: NounType | VerbType
  typeCategory: 'noun' | 'verb'
  confidence: number
  isCanonical: boolean
  embedding: Vector
}

// Use 'any' type to avoid TypeScript union complexity issues with 1050+ literal types
const KEYWORD_EMBEDDINGS: any = ${JSON.stringify(embeddings, null, 2)}

export function getKeywordEmbeddings(): KeywordEmbedding[] {
  return KEYWORD_EMBEDDINGS
}

export function getKeywordCount(): number {
  return KEYWORD_EMBEDDINGS.length
}

export function getNounKeywordCount(): number {
  return ${nounKeywords}
}

export function getVerbKeywordCount(): number {
  return ${verbKeywords}
}

export function getEmbeddingDimension(): number {
  return 384
}
`

  writeFileSync('src/neural/embeddedKeywordEmbeddings.ts', output, 'utf-8')

  console.log(`✅ Generated src/neural/embeddedKeywordEmbeddings.ts`)
  console.log(`   Total keywords: ${embeddings.length} (${nounKeywords} nouns + ${verbKeywords} verbs)`)
  console.log(`   Canonical: ${canonicalKeywords}, Synonyms: ${synonymKeywords}`)
  console.log(`   Size: ${sizeMB}MB (${sizeKB}KB)`)

  console.log('\n' + '='.repeat(70))
  console.log('✅ Keyword embeddings build complete!')
  console.log('='.repeat(70))

  return embeddings.length
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  buildKeywordEmbeddings()
    .then(count => {
      console.log(`\n🎉 Success! Generated embeddings for ${count} keywords.`)
      process.exit(0)
    })
    .catch(error => {
      console.error('\n❌ Build failed:', error.message)
      console.error(error.stack)
      process.exit(1)
    })
}

export { buildKeywordEmbeddings }
