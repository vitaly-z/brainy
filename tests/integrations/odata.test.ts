/**
 * OData Integration Tests
 *
 * Tests for OData query parsing, EDMX generation, and filtering.
 */

import { describe, it, expect } from 'vitest'
import {
  parseODataQuery,
  parseFilter,
  parseOrderBy,
  parseSelect,
  applyFilter,
  applySelect,
  applyOrderBy,
  applyPagination
} from '../../src/integrations/odata/ODataQueryParser.js'
import {
  generateEdmx,
  generateMetadataJson,
  generateServiceDocument
} from '../../src/integrations/odata/EdmxGenerator.js'

describe('OData Query Parser', () => {
  describe('parseODataQuery', () => {
    it('should parse $top', () => {
      const options = parseODataQuery('$top=10')
      expect(options.top).toBe(10)
    })

    it('should parse $skip', () => {
      const options = parseODataQuery('$skip=20')
      expect(options.skip).toBe(20)
    })

    it('should parse $select', () => {
      const options = parseODataQuery('$select=Id,Type,Name')
      expect(options.select).toEqual(['Id', 'Type', 'Name'])
    })

    it('should parse $orderby', () => {
      const options = parseODataQuery('$orderby=CreatedAt desc')
      expect(options.orderBy).toEqual([
        { field: 'CreatedAt', direction: 'desc' }
      ])
    })

    it('should parse $count', () => {
      const options = parseODataQuery('$count=true')
      expect(options.count).toBe(true)
    })

    it('should parse $filter', () => {
      const options = parseODataQuery("$filter=Type eq 'person'")
      expect(options.filter).toBe("Type eq 'person'")
    })

    it('should parse $search', () => {
      const options = parseODataQuery('$search=machine learning')
      expect(options.search).toBe('machine learning')
    })

    it('should parse multiple options', () => {
      const options = parseODataQuery(
        '$top=10&$skip=20&$orderby=Name asc&$count=true'
      )
      expect(options.top).toBe(10)
      expect(options.skip).toBe(20)
      expect(options.orderBy).toEqual([{ field: 'Name', direction: 'asc' }])
      expect(options.count).toBe(true)
    })
  })

  describe('parseFilter', () => {
    it('should parse simple eq comparison', () => {
      const filter = parseFilter("Type eq 'person'")
      expect(filter).toEqual({
        field: 'Type',
        op: 'eq',
        value: 'person'
      })
    })

    it('should parse ne comparison', () => {
      const filter = parseFilter("Status ne 'deleted'")
      expect(filter).toEqual({
        field: 'Status',
        op: 'ne',
        value: 'deleted'
      })
    })

    it('should parse numeric comparisons', () => {
      const gtFilter = parseFilter('Weight gt 0.5')
      expect(gtFilter.op).toBe('gt')
      expect(gtFilter.value).toBe(0.5)

      const ltFilter = parseFilter('Count lt 100')
      expect(ltFilter.op).toBe('lt')
      expect(ltFilter.value).toBe(100)
    })

    it('should parse boolean values', () => {
      const filter = parseFilter('Active eq true')
      expect(filter.value).toBe(true)
    })

    it('should parse null values', () => {
      const filter = parseFilter('DeletedAt eq null')
      expect(filter.value).toBe(null)
    })

    it('should parse and expressions', () => {
      const filter = parseFilter("Type eq 'person' and Status eq 'active'")
      expect(filter).toEqual({
        and: [
          { field: 'Type', op: 'eq', value: 'person' },
          { field: 'Status', op: 'eq', value: 'active' }
        ]
      })
    })

    it('should parse or expressions', () => {
      const filter = parseFilter("Type eq 'person' or Type eq 'organization'")
      expect(filter).toEqual({
        or: [
          { field: 'Type', op: 'eq', value: 'person' },
          { field: 'Type', op: 'eq', value: 'organization' }
        ]
      })
    })

    it('should parse contains function', () => {
      const filter = parseFilter("contains(Name, 'John')")
      expect(filter).toEqual({
        func: 'contains',
        args: [{ field: 'Name' }, { value: 'John' }]
      })
    })

    it('should parse startswith function', () => {
      const filter = parseFilter("startswith(Email, 'admin')")
      expect(filter).toEqual({
        func: 'startswith',
        args: [{ field: 'Email' }, { value: 'admin' }]
      })
    })
  })

  describe('parseOrderBy', () => {
    it('should parse single field', () => {
      const orderBy = parseOrderBy('Name')
      expect(orderBy).toEqual([{ field: 'Name', direction: 'asc' }])
    })

    it('should parse with direction', () => {
      const orderBy = parseOrderBy('CreatedAt desc')
      expect(orderBy).toEqual([{ field: 'CreatedAt', direction: 'desc' }])
    })

    it('should parse multiple fields', () => {
      const orderBy = parseOrderBy('Type asc, CreatedAt desc')
      expect(orderBy).toEqual([
        { field: 'Type', direction: 'asc' },
        { field: 'CreatedAt', direction: 'desc' }
      ])
    })
  })

  describe('parseSelect', () => {
    it('should parse comma-separated fields', () => {
      const select = parseSelect('Id, Type, Name')
      expect(select).toEqual(['Id', 'Type', 'Name'])
    })
  })

  describe('applyFilter', () => {
    const testData = [
      { Id: '1', Type: 'person', Name: 'John Doe', Weight: 0.8 },
      { Id: '2', Type: 'person', Name: 'Jane Smith', Weight: 0.6 },
      { Id: '3', Type: 'organization', Name: 'Acme Corp', Weight: 0.9 },
      { Id: '4', Type: 'document', Name: 'Report', Weight: 0.5 }
    ]

    it('should filter by eq', () => {
      const result = applyFilter(testData, "Type eq 'person'")
      expect(result).toHaveLength(2)
      expect(result.every((r) => r.Type === 'person')).toBe(true)
    })

    it('should filter by gt', () => {
      const result = applyFilter(testData, 'Weight gt 0.7')
      expect(result).toHaveLength(2)
      expect(result.every((r) => r.Weight > 0.7)).toBe(true)
    })

    it('should filter with contains', () => {
      const result = applyFilter(testData, "contains(Name, 'Doe')")
      expect(result).toHaveLength(1)
      expect(result[0].Name).toBe('John Doe')
    })

    it('should filter with and', () => {
      const result = applyFilter(
        testData,
        "Type eq 'person' and Weight gt 0.7"
      )
      expect(result).toHaveLength(1)
      expect(result[0].Name).toBe('John Doe')
    })
  })

  describe('applySelect', () => {
    const testData = [
      { Id: '1', Type: 'person', Name: 'John', Extra: 'data' }
    ]

    it('should select specified fields only', () => {
      const result = applySelect(testData, ['Id', 'Name'])
      expect(result[0]).toHaveProperty('Id')
      expect(result[0]).toHaveProperty('Name')
      expect(result[0]).not.toHaveProperty('Type')
      expect(result[0]).not.toHaveProperty('Extra')
    })

    it('should return all fields if select is empty', () => {
      const result = applySelect(testData, [])
      expect(result[0]).toHaveProperty('Extra')
    })
  })

  describe('applyOrderBy', () => {
    const testData = [
      { Name: 'Charlie', Weight: 0.5 },
      { Name: 'Alice', Weight: 0.9 },
      { Name: 'Bob', Weight: 0.7 }
    ]

    it('should sort ascending by default', () => {
      const result = applyOrderBy(testData, [
        { field: 'Name', direction: 'asc' }
      ])
      expect(result[0].Name).toBe('Alice')
      expect(result[1].Name).toBe('Bob')
      expect(result[2].Name).toBe('Charlie')
    })

    it('should sort descending', () => {
      const result = applyOrderBy(testData, [
        { field: 'Weight', direction: 'desc' }
      ])
      expect(result[0].Weight).toBe(0.9)
      expect(result[2].Weight).toBe(0.5)
    })
  })

  describe('applyPagination', () => {
    const testData = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

    it('should apply top (limit)', () => {
      const result = applyPagination(testData, 3)
      expect(result).toEqual([1, 2, 3])
    })

    it('should apply skip (offset)', () => {
      const result = applyPagination(testData, undefined, 5)
      expect(result).toEqual([6, 7, 8, 9, 10])
    })

    it('should apply both top and skip', () => {
      const result = applyPagination(testData, 3, 2)
      expect(result).toEqual([3, 4, 5])
    })
  })
})

describe('EDMX Generator', () => {
  describe('generateEdmx', () => {
    it('should generate valid XML', () => {
      const xml = generateEdmx()
      expect(xml).toContain('<?xml version="1.0"')
      expect(xml).toContain('<edmx:Edmx')
      expect(xml).toContain('EntityType Name="Entity"')
    })

    it('should include entity properties', () => {
      const xml = generateEdmx()
      expect(xml).toContain('Property Name="Id"')
      expect(xml).toContain('Property Name="Type"')
      expect(xml).toContain('Property Name="CreatedAt"')
    })

    it('should include NounType enum', () => {
      const xml = generateEdmx()
      expect(xml).toContain('EnumType Name="NounType"')
      expect(xml).toContain('Member Name="person"')
    })

    it('should include relationships when enabled', () => {
      const xml = generateEdmx({ includeRelationships: true })
      expect(xml).toContain('EntityType Name="Relationship"')
      expect(xml).toContain('EnumType Name="VerbType"')
    })

    it('should exclude relationships when disabled', () => {
      const xml = generateEdmx({ includeRelationships: false })
      expect(xml).not.toContain('EntityType Name="Relationship"')
    })

    it('should use custom namespace', () => {
      const xml = generateEdmx({ namespace: 'MyApp' })
      expect(xml).toContain('Namespace="MyApp"')
    })
  })

  describe('generateMetadataJson', () => {
    it('should generate JSON metadata', () => {
      const metadata = generateMetadataJson()
      expect(metadata).toHaveProperty('$Version', '4.0')
      expect(metadata).toHaveProperty('Brainy')
    })
  })

  describe('generateServiceDocument', () => {
    it('should generate service document', () => {
      const doc = generateServiceDocument('http://localhost/odata')
      expect(doc).toHaveProperty('@odata.context')
      expect(doc).toHaveProperty('value')
      expect((doc as any).value).toContainEqual(
        expect.objectContaining({ name: 'Entities' })
      )
    })

    it('should include relationships when enabled', () => {
      const doc = generateServiceDocument('http://localhost/odata', {
        includeRelationships: true
      })
      expect((doc as any).value).toContainEqual(
        expect.objectContaining({ name: 'Relationships' })
      )
    })
  })
})
