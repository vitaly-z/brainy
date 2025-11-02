# Natural Language Queries with Brainy

> **Current Status**: Basic natural language support with 220+ patterns. Advanced NLP features coming in Q1 2025.

Brainy's `find()` method understands natural language, allowing you to query your data using plain English instead of complex query syntax.

## Overview

The natural language processing (NLP) system is powered by 220+ pre-computed patterns that understand common query intents, temporal expressions, numeric comparisons, and domain-specific terminology.

## What Works Today

The current NLP implementation supports:
- ✅ Basic pattern matching (220+ patterns)
- ✅ Simple temporal expressions ("recent", "today", "last week")
- ✅ Common query intents ("find", "show", "search")
- ✅ Domain keywords recognition
- ⚠️ Limited entity extraction
- ⚠️ Basic numeric comparisons

## Basic Usage

```typescript
import { Brainy } from 'brainy'

const brain = new Brainy()
await brain.init()

// Simply ask in natural language
const results = await brain.find("show me recent articles about AI")
```

## Supported Query Types

### ✅ Currently Working
These query patterns are supported today.

### ⚠️ Basic Support
These work with limitations.

### 🚧 Coming Soon
Planned for future releases.

### Temporal Queries ⚠️ Basic Support

```typescript
// Relative time expressions
await brain.find("documents from last week")
await brain.find("posts created yesterday")
await brain.find("data from the past 30 days")

// Specific dates and ranges
await brain.find("articles published in Q3 2024")
await brain.find("reports from January to March")
await brain.find("meetings scheduled for tomorrow")

// Named periods
await brain.find("quarterly reports from this year")
await brain.find("summer vacation photos")
await brain.find("holiday sales data")
```

### Numeric Filters ⚠️ Basic Support

```typescript
// Comparisons
await brain.find("products with price under $100")
await brain.find("articles with more than 1000 views")
await brain.find("employees with salary above 75000")

// Ranges
await brain.find("items priced between $50 and $200")
await brain.find("posts with 10 to 50 likes")
await brain.find("companies with 100-500 employees")

// Percentages and metrics
await brain.find("stocks with growth over 20%")
await brain.find("projects with completion above 80%")
await brain.find("products with 5 star ratings")
```

### Entity and Relationship Queries 🚧 Coming Soon

```typescript
// People and organizations
await brain.find("articles by John Smith")
await brain.find("employees at TechCorp")
await brain.find("papers from Stanford University")

// Relationships
await brain.find("documents related to Project X")
await brain.find("products similar to iPhone")
await brain.find("people who work with Sarah")

// Ownership and attribution
await brain.find("repos owned by user123")
await brain.find("designs created by the marketing team")
await brain.find("patents filed by Apple")
```

### Combined Complex Queries 🚧 Coming Soon

```typescript
// Multiple conditions
await brain.find("verified research papers about machine learning from 2024 with high citations")

// Business queries
await brain.find("quarterly financial reports from Q2 2024 with revenue over 10M")

// Content queries  
await brain.find("popular blog posts by tech influencers published this month about AI")

// E-commerce queries
await brain.find("electronics under $500 with 4+ star reviews and free shipping")

// Academic queries
await brain.find("peer-reviewed papers on quantum computing published in Nature after 2020")
```

## How It Works

### 1. Pattern Matching
The NLP system first matches your query against 220+ pre-built patterns to identify:
- Query intent (search, filter, aggregate)
- Temporal expressions
- Numeric comparisons
- Entity mentions
- Relationship indicators

### 2. Entity Extraction
Named entities are extracted and classified:
- People names
- Organization names
- Product names
- Locations
- Dates and times

### 3. Intent Classification
The query intent is determined:
- **Search**: Finding similar items
- **Filter**: Applying specific criteria
- **Aggregate**: Grouping or summarizing
- **Navigate**: Following relationships

### 4. Query Construction
The natural language is converted to a structured Triple Intelligence query:

```typescript
// Input: "recent AI papers with high citations"
// Output:
{
  like: "AI papers",
  where: {
    type: "paper",
    citations: { $gte: 100 },
    published: { $gte: "2024-01-01" }
  },
  boost: "recent"
}
```

### 5. Execution
The structured query is executed using Triple Intelligence, combining:
- Vector similarity search
- Metadata filtering
- Graph traversal

## Advanced Features

### Contextual Understanding 🚧 Coming Soon

```typescript
// Brainy understands context and synonyms
await brain.find("latest ML research") // Understands ML = Machine Learning
await brain.find("top rated items")    // Understands top = high score/rating
await brain.find("trending topics")    // Understands trending = recent + popular
```

### Fuzzy Matching 🚧 Coming Soon

```typescript
// Handles typos and variations
await brain.find("articals about blockchian") // Still finds blockchain articles
await brain.find("Jon Smith papers")          // Matches "John Smith"
```

### Domain-Specific Understanding ⚠️ Basic Support

```typescript
// Tech domain
await brain.find("repos with MIT license")
await brain.find("APIs with OAuth support")
await brain.find("npm packages with zero dependencies")

// Business domain
await brain.find("SaaS companies with ARR over 1M")
await brain.find("startups in Series A")
await brain.find("B2B products with enterprise pricing")

// Academic domain
await brain.find("papers with h-index above 50")
await brain.find("journals with impact factor over 10")
await brain.find("conferences with double-blind review")
```

## Fallback to Structured Queries

When natural language isn't sufficient, you can always use structured queries:

```typescript
// Structured query for precise control
const results = await brain.find({
  $and: [
    { $vector: { $similar: "neural networks", threshold: 0.8 } },
    { category: "research" },
    { year: { $gte: 2023 } },
    { $or: [
      { author: "LeCun" },
      { author: "Hinton" },
      { author: "Bengio" }
    ]}
  ],
  limit: 50
})
```

## Performance Tips

1. **Be specific**: More specific queries execute faster
2. **Use proper nouns**: Names and specific terms improve accuracy
3. **Include time frames**: Temporal filters reduce search space
4. **Specify limits**: Always include reasonable result limits

## Examples by Use Case

### Customer Support
```typescript
await brain.find("urgent tickets from VIP customers today")
await brain.find("unresolved issues older than 3 days")
await brain.find("positive feedback about product X this month")
```

### Content Management
```typescript
await brain.find("draft posts scheduled for next week")
await brain.find("published articles needing review")
await brain.find("videos with over 10k views")
```

### E-commerce
```typescript
await brain.find("best selling products in electronics")
await brain.find("items with low stock under 10 units")
await brain.find("orders from California pending shipping")
```

### Analytics
```typescript
await brain.find("user sessions longer than 5 minutes yesterday")
await brain.find("conversion events from mobile users")
await brain.find("page views for /pricing in the last hour")
```

## Limitations

While powerful, the NLP system has some limitations:

1. **Complex logic**: Very complex boolean logic may require structured queries
2. **Ambiguity**: Ambiguous queries may not parse as expected
3. **Domain terms**: Highly specialized terminology may need training
4. **Languages**: Currently optimized for English queries

## Best Practices

1. **Start simple**: Begin with simple queries and add complexity
2. **Test understanding**: Use explain mode to see how queries are interpreted
3. **Provide feedback**: Help improve the system by reporting misunderstood queries
4. **Combine approaches**: Use NLP for exploration, structured for precision

## Next Steps

- [Triple Intelligence Architecture](../architecture/triple-intelligence.md)
- [API Reference](../api/README.md)