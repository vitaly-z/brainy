/**
 * OData Integration Module
 *
 * Provides OData 4.0 REST API for Excel, Power BI, and BI tools.
 */

export { ODataIntegration, type ODataConfig } from './ODataIntegration.js'
export {
  parseODataQuery,
  parseFilter,
  parseOrderBy,
  parseSelect,
  parseExpand,
  odataToFindParams,
  applyFilter,
  applySelect,
  applyOrderBy,
  applyPagination
} from './ODataQueryParser.js'
export {
  generateEdmx,
  generateMetadataJson,
  generateServiceDocument
} from './EdmxGenerator.js'
