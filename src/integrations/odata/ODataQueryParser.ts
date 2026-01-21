/**
 * OData Query Parser
 *
 * Lightweight parser for OData query parameters without heavy dependencies.
 * Supports $filter, $select, $orderby, $top, $skip, $count, $search, $expand.
 */

import { ODataQueryOptions } from '../core/types.js'

/**
 * Parse OData filter expression to a structured filter object
 *
 * Supports:
 * - eq, ne, gt, ge, lt, le comparisons
 * - and, or logical operators
 * - contains(), startswith(), endswith() string functions
 * - Parentheses for grouping
 *
 * @param filter OData $filter string
 * @returns Parsed filter object for query execution
 */
export function parseFilter(filter: string): any {
  if (!filter || filter.trim() === '') {
    return null
  }

  // Tokenize
  const tokens = tokenize(filter)

  // Parse expression
  return parseExpression(tokens, 0).result
}

/**
 * Parse OData $orderby specification
 */
export function parseOrderBy(
  orderby: string
): Array<{ field: string; direction: 'asc' | 'desc' }> {
  if (!orderby || orderby.trim() === '') {
    return []
  }

  return orderby.split(',').map((part) => {
    const trimmed = part.trim()
    const parts = trimmed.split(/\s+/)
    return {
      field: parts[0],
      direction: (parts[1]?.toLowerCase() as 'asc' | 'desc') || 'asc'
    }
  })
}

/**
 * Parse OData $select specification
 */
export function parseSelect(select: string): string[] {
  if (!select || select.trim() === '') {
    return []
  }

  return select.split(',').map((s) => s.trim())
}

/**
 * Parse OData $expand specification
 */
export function parseExpand(expand: string): string[] {
  if (!expand || expand.trim() === '') {
    return []
  }

  return expand.split(',').map((s) => s.trim())
}

/**
 * Parse full OData query string to options object
 */
export function parseODataQuery(queryString: string): ODataQueryOptions {
  const params = new URLSearchParams(queryString)
  const options: ODataQueryOptions = {}

  // $filter
  const filter = params.get('$filter')
  if (filter) {
    options.filter = filter
  }

  // $select
  const select = params.get('$select')
  if (select) {
    options.select = parseSelect(select)
  }

  // $orderby
  const orderby = params.get('$orderby')
  if (orderby) {
    options.orderBy = parseOrderBy(orderby)
  }

  // $top
  const top = params.get('$top')
  if (top) {
    options.top = parseInt(top, 10)
  }

  // $skip
  const skip = params.get('$skip')
  if (skip) {
    options.skip = parseInt(skip, 10)
  }

  // $expand
  const expand = params.get('$expand')
  if (expand) {
    options.expand = parseExpand(expand)
  }

  // $count
  const count = params.get('$count')
  if (count === 'true') {
    options.count = true
  }

  // $search
  const search = params.get('$search')
  if (search) {
    options.search = search
  }

  return options
}

/**
 * Convert OData options to Brainy FindParams
 */
export function odataToFindParams(options: ODataQueryOptions): any {
  const findParams: any = {}

  // Top/Skip -> Limit/Offset
  if (options.top !== undefined) {
    findParams.limit = options.top
  }
  if (options.skip !== undefined) {
    findParams.offset = options.skip
  }

  // OrderBy
  if (options.orderBy && options.orderBy.length > 0) {
    findParams.orderBy = options.orderBy[0].field
    findParams.order = options.orderBy[0].direction
  }

  // Search -> Query
  if (options.search) {
    findParams.query = options.search
  }

  // Filter -> Where (simplified)
  if (options.filter) {
    const parsed = parseFilter(options.filter)
    if (parsed) {
      findParams.where = filterToWhere(parsed)
    }
  }

  return findParams
}

/**
 * Apply OData filter to an array of entities
 */
export function applyFilter<T extends Record<string, any>>(
  entities: T[],
  filter: string
): T[] {
  if (!filter) return entities

  const parsed = parseFilter(filter)
  if (!parsed) return entities

  return entities.filter((entity) => evaluateFilter(entity, parsed))
}

/**
 * Apply OData select to transform entities
 */
export function applySelect<T extends Record<string, any>>(
  entities: T[],
  select: string[]
): Partial<T>[] {
  if (!select || select.length === 0) return entities

  return entities.map((entity) => {
    const result: Partial<T> = {}
    for (const field of select) {
      if (field in entity) {
        result[field as keyof T] = entity[field]
      }
    }
    return result
  })
}

/**
 * Apply OData orderby to sort entities
 */
export function applyOrderBy<T extends Record<string, any>>(
  entities: T[],
  orderBy: Array<{ field: string; direction: 'asc' | 'desc' }>
): T[] {
  if (!orderBy || orderBy.length === 0) return entities

  return [...entities].sort((a, b) => {
    for (const { field, direction } of orderBy) {
      const aVal = getNestedValue(a, field)
      const bVal = getNestedValue(b, field)

      let cmp = 0
      if (aVal === bVal) {
        cmp = 0
      } else if (aVal === null || aVal === undefined) {
        cmp = 1
      } else if (bVal === null || bVal === undefined) {
        cmp = -1
      } else if (typeof aVal === 'string' && typeof bVal === 'string') {
        cmp = aVal.localeCompare(bVal)
      } else {
        cmp = aVal < bVal ? -1 : 1
      }

      if (cmp !== 0) {
        return direction === 'desc' ? -cmp : cmp
      }
    }
    return 0
  })
}

/**
 * Apply top/skip pagination
 */
export function applyPagination<T>(
  entities: T[],
  top?: number,
  skip?: number
): T[] {
  let result = entities

  if (skip !== undefined && skip > 0) {
    result = result.slice(skip)
  }

  if (top !== undefined && top > 0) {
    result = result.slice(0, top)
  }

  return result
}

// Private helpers

type Token = {
  type:
    | 'identifier'
    | 'string'
    | 'number'
    | 'boolean'
    | 'null'
    | 'operator'
    | 'function'
    | 'lparen'
    | 'rparen'
    | 'comma'
  value: string
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < input.length) {
    // Skip whitespace
    if (/\s/.test(input[i])) {
      i++
      continue
    }

    // String literal
    if (input[i] === "'") {
      let str = ''
      i++
      while (i < input.length && input[i] !== "'") {
        if (input[i] === "'" && input[i + 1] === "'") {
          str += "'"
          i += 2
        } else {
          str += input[i]
          i++
        }
      }
      i++ // Skip closing quote
      tokens.push({ type: 'string', value: str })
      continue
    }

    // Number
    if (/\d/.test(input[i]) || (input[i] === '-' && /\d/.test(input[i + 1]))) {
      let num = ''
      while (i < input.length && /[\d.\-]/.test(input[i])) {
        num += input[i]
        i++
      }
      tokens.push({ type: 'number', value: num })
      continue
    }

    // Parentheses
    if (input[i] === '(') {
      tokens.push({ type: 'lparen', value: '(' })
      i++
      continue
    }
    if (input[i] === ')') {
      tokens.push({ type: 'rparen', value: ')' })
      i++
      continue
    }

    // Comma
    if (input[i] === ',') {
      tokens.push({ type: 'comma', value: ',' })
      i++
      continue
    }

    // Identifier or keyword
    if (/[a-zA-Z_]/.test(input[i])) {
      let ident = ''
      while (i < input.length && /[a-zA-Z0-9_./]/.test(input[i])) {
        ident += input[i]
        i++
      }

      const lower = ident.toLowerCase()

      // Operators
      if (['eq', 'ne', 'gt', 'ge', 'lt', 'le', 'and', 'or', 'not'].includes(lower)) {
        tokens.push({ type: 'operator', value: lower })
      }
      // Boolean
      else if (lower === 'true' || lower === 'false') {
        tokens.push({ type: 'boolean', value: lower })
      }
      // Null
      else if (lower === 'null') {
        tokens.push({ type: 'null', value: 'null' })
      }
      // Functions
      else if (
        ['contains', 'startswith', 'endswith', 'tolower', 'toupper', 'length', 'trim', 'substring'].includes(
          lower
        )
      ) {
        tokens.push({ type: 'function', value: lower })
      }
      // Identifier (field name)
      else {
        tokens.push({ type: 'identifier', value: ident })
      }
      continue
    }

    // Unknown character, skip
    i++
  }

  return tokens
}

function parseExpression(
  tokens: Token[],
  pos: number
): { result: any; pos: number } {
  return parseOr(tokens, pos)
}

function parseOr(
  tokens: Token[],
  pos: number
): { result: any; pos: number } {
  let { result: left, pos: nextPos } = parseAnd(tokens, pos)

  while (nextPos < tokens.length && tokens[nextPos]?.value === 'or') {
    nextPos++ // Skip 'or'
    const { result: right, pos: newPos } = parseAnd(tokens, nextPos)
    left = { or: [left, right] }
    nextPos = newPos
  }

  return { result: left, pos: nextPos }
}

function parseAnd(
  tokens: Token[],
  pos: number
): { result: any; pos: number } {
  let { result: left, pos: nextPos } = parsePrimary(tokens, pos)

  while (nextPos < tokens.length && tokens[nextPos]?.value === 'and') {
    nextPos++ // Skip 'and'
    const { result: right, pos: newPos } = parsePrimary(tokens, nextPos)
    left = { and: [left, right] }
    nextPos = newPos
  }

  return { result: left, pos: nextPos }
}

function parsePrimary(
  tokens: Token[],
  pos: number
): { result: any; pos: number } {
  if (pos >= tokens.length) {
    return { result: null, pos }
  }

  const token = tokens[pos]

  // Parenthesized expression
  if (token.type === 'lparen') {
    const { result, pos: endPos } = parseExpression(tokens, pos + 1)
    // Skip rparen
    return { result, pos: endPos + 1 }
  }

  // Function call
  if (token.type === 'function') {
    return parseFunction(tokens, pos)
  }

  // Not operator
  if (token.value === 'not') {
    const { result, pos: endPos } = parsePrimary(tokens, pos + 1)
    return { result: { not: result }, pos: endPos }
  }

  // Comparison: identifier operator value
  if (token.type === 'identifier') {
    const field = token.value
    pos++

    if (pos >= tokens.length || tokens[pos].type !== 'operator') {
      return { result: { field, exists: true }, pos }
    }

    const op = tokens[pos].value
    pos++

    if (pos >= tokens.length) {
      return { result: { field, op, value: null }, pos }
    }

    const valueToken = tokens[pos]
    let value: any

    switch (valueToken.type) {
      case 'string':
        value = valueToken.value
        break
      case 'number':
        value = parseFloat(valueToken.value)
        break
      case 'boolean':
        value = valueToken.value === 'true'
        break
      case 'null':
        value = null
        break
      default:
        value = valueToken.value
    }

    return { result: { field, op, value }, pos: pos + 1 }
  }

  return { result: null, pos: pos + 1 }
}

function parseFunction(
  tokens: Token[],
  pos: number
): { result: any; pos: number } {
  const funcName = tokens[pos].value
  pos++ // Skip function name

  if (tokens[pos]?.type !== 'lparen') {
    return { result: null, pos }
  }
  pos++ // Skip '('

  const args: any[] = []

  while (pos < tokens.length && tokens[pos]?.type !== 'rparen') {
    if (tokens[pos].type === 'comma') {
      pos++
      continue
    }

    if (tokens[pos].type === 'identifier') {
      args.push({ field: tokens[pos].value })
      pos++
    } else if (tokens[pos].type === 'string') {
      args.push({ value: tokens[pos].value })
      pos++
    } else if (tokens[pos].type === 'number') {
      args.push({ value: parseFloat(tokens[pos].value) })
      pos++
    } else {
      pos++
    }
  }

  pos++ // Skip ')'

  return { result: { func: funcName, args }, pos }
}

function evaluateFilter(entity: Record<string, any>, filter: any): boolean {
  if (!filter) return true

  // Logical operators
  if (filter.and) {
    return filter.and.every((f: any) => evaluateFilter(entity, f))
  }
  if (filter.or) {
    return filter.or.some((f: any) => evaluateFilter(entity, f))
  }
  if (filter.not) {
    return !evaluateFilter(entity, filter.not)
  }

  // Function
  if (filter.func) {
    return evaluateFunction(entity, filter.func, filter.args)
  }

  // Comparison
  if (filter.field && filter.op) {
    const fieldValue = getNestedValue(entity, filter.field)
    return compareValues(fieldValue, filter.op, filter.value)
  }

  return true
}

function evaluateFunction(
  entity: Record<string, any>,
  func: string,
  args: any[]
): boolean {
  if (args.length < 2) return false

  const fieldValue = args[0].field
    ? String(getNestedValue(entity, args[0].field) ?? '')
    : ''
  const searchValue = args[1].value ?? ''

  switch (func) {
    case 'contains':
      return fieldValue.toLowerCase().includes(searchValue.toLowerCase())
    case 'startswith':
      return fieldValue.toLowerCase().startsWith(searchValue.toLowerCase())
    case 'endswith':
      return fieldValue.toLowerCase().endsWith(searchValue.toLowerCase())
    default:
      return false
  }
}

function compareValues(fieldValue: any, op: string, filterValue: any): boolean {
  // Handle null comparisons
  if (filterValue === null) {
    switch (op) {
      case 'eq':
        return fieldValue === null || fieldValue === undefined
      case 'ne':
        return fieldValue !== null && fieldValue !== undefined
      default:
        return false
    }
  }

  // Null field value
  if (fieldValue === null || fieldValue === undefined) {
    return op === 'ne'
  }

  // Type coercion for comparisons
  let fv = fieldValue
  let cv = filterValue

  if (typeof filterValue === 'number' && typeof fieldValue === 'string') {
    fv = parseFloat(fieldValue)
  }
  if (typeof filterValue === 'string' && typeof fieldValue === 'number') {
    cv = parseFloat(filterValue)
  }

  switch (op) {
    case 'eq':
      return fv === cv || (typeof fv === 'string' && fv.toLowerCase() === String(cv).toLowerCase())
    case 'ne':
      return fv !== cv
    case 'gt':
      return fv > cv
    case 'ge':
      return fv >= cv
    case 'lt':
      return fv < cv
    case 'le':
      return fv <= cv
    default:
      return false
  }
}

function getNestedValue(obj: Record<string, any>, path: string): any {
  const parts = path.split(/[./]/)
  let value: any = obj

  for (const part of parts) {
    if (value === null || value === undefined) return undefined
    value = value[part]
  }

  return value
}

function filterToWhere(filter: any): any {
  if (!filter) return {}

  // Simple comparison
  if (filter.field && filter.op && filter.op === 'eq') {
    return { [filter.field]: filter.value }
  }

  // For more complex filters, return as-is for storage adapter to handle
  return filter
}
