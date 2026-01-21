/**
 * EDMX Metadata Generator
 *
 * Generates OData $metadata XML document describing the Brainy data model.
 * This allows tools like Excel Power Query and Power BI to discover the schema.
 */

import { NounType, VerbType } from '../../types/graphTypes.js'

/**
 * OData property type mapping
 */
interface PropertyDef {
  name: string
  type: string
  nullable: boolean
}

/**
 * Generate EDMX metadata XML for Brainy schema
 *
 * @param options Configuration options
 * @returns XML string
 */
export function generateEdmx(options?: {
  namespace?: string
  containerName?: string
  includeRelationships?: boolean
}): string {
  const namespace = options?.namespace ?? 'Brainy'
  const containerName = options?.containerName ?? 'BrainyContainer'
  const includeRelationships = options?.includeRelationships ?? true

  const entityProperties = getEntityProperties()
  const relationshipProperties = getRelationshipProperties()

  let xml = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:DataServices>
    <Schema Namespace="${namespace}" xmlns="http://docs.oasis-open.org/odata/ns/edm">

      <!-- Entity Type -->
      <EntityType Name="Entity">
        <Key>
          <PropertyRef Name="Id"/>
        </Key>
${entityProperties.map((p) => `        <Property Name="${p.name}" Type="${p.type}" Nullable="${p.nullable}"/>`).join('\n')}
      </EntityType>

${includeRelationships ? generateRelationshipType(relationshipProperties) : ''}

      <!-- Enum: NounType -->
      <EnumType Name="NounType">
${Object.values(NounType)
  .map((v, i) => `        <Member Name="${v}" Value="${i}"/>`)
  .join('\n')}
      </EnumType>

${includeRelationships ? generateVerbTypeEnum() : ''}

      <!-- Entity Container -->
      <EntityContainer Name="${containerName}">
        <EntitySet Name="Entities" EntityType="${namespace}.Entity"/>
${includeRelationships ? `        <EntitySet Name="Relationships" EntityType="${namespace}.Relationship"/>` : ''}
      </EntityContainer>

    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`

  return xml
}

/**
 * Generate JSON-based OData metadata (for modern clients)
 */
export function generateMetadataJson(options?: {
  namespace?: string
  includeRelationships?: boolean
}): object {
  const namespace = options?.namespace ?? 'Brainy'
  const includeRelationships = options?.includeRelationships ?? true

  const entityProps = getEntityProperties()
  const relProps = getRelationshipProperties()

  const schema: any = {
    $Version: '4.0',
    [`${namespace}`]: {
      Entity: {
        $Kind: 'EntityType',
        $Key: ['Id'],
        ...Object.fromEntries(
          entityProps.map((p) => [
            p.name,
            {
              $Type: p.type.replace('Edm.', ''),
              $Nullable: p.nullable
            }
          ])
        )
      },
      NounType: {
        $Kind: 'EnumType',
        ...Object.fromEntries(
          Object.values(NounType).map((v, i) => [v, i])
        )
      }
    },
    [`${namespace}.Container`]: {
      $Kind: 'EntityContainer',
      Entities: {
        $Collection: true,
        $Type: `${namespace}.Entity`
      }
    }
  }

  if (includeRelationships) {
    schema[namespace].Relationship = {
      $Kind: 'EntityType',
      $Key: ['Id'],
      ...Object.fromEntries(
        relProps.map((p) => [
          p.name,
          {
            $Type: p.type.replace('Edm.', ''),
            $Nullable: p.nullable
          }
        ])
      )
    }

    schema[namespace].VerbType = {
      $Kind: 'EnumType',
      ...Object.fromEntries(
        Object.values(VerbType).map((v, i) => [v, i])
      )
    }

    schema[`${namespace}.Container`].Relationships = {
      $Collection: true,
      $Type: `${namespace}.Relationship`
    }
  }

  return schema
}

/**
 * Get service document (root OData response)
 */
export function generateServiceDocument(
  baseUrl: string,
  options?: { includeRelationships?: boolean }
): object {
  const includeRelationships = options?.includeRelationships ?? true

  const collections = [
    {
      name: 'Entities',
      kind: 'EntitySet',
      url: 'Entities'
    }
  ]

  if (includeRelationships) {
    collections.push({
      name: 'Relationships',
      kind: 'EntitySet',
      url: 'Relationships'
    })
  }

  return {
    '@odata.context': `${baseUrl}/$metadata`,
    value: collections
  }
}

// Private helpers

function getEntityProperties(): PropertyDef[] {
  return [
    { name: 'Id', type: 'Edm.String', nullable: false },
    { name: 'Type', type: 'Edm.String', nullable: false },
    { name: 'CreatedAt', type: 'Edm.DateTimeOffset', nullable: false },
    { name: 'UpdatedAt', type: 'Edm.DateTimeOffset', nullable: true },
    { name: 'Confidence', type: 'Edm.Double', nullable: true },
    { name: 'Weight', type: 'Edm.Double', nullable: true },
    { name: 'Service', type: 'Edm.String', nullable: true },
    { name: 'Data', type: 'Edm.String', nullable: true },
    // Common metadata fields (flattened)
    { name: 'Metadata_name', type: 'Edm.String', nullable: true },
    { name: 'Metadata_title', type: 'Edm.String', nullable: true },
    { name: 'Metadata_description', type: 'Edm.String', nullable: true },
    { name: 'Metadata_email', type: 'Edm.String', nullable: true },
    { name: 'Metadata_url', type: 'Edm.String', nullable: true },
    { name: 'Metadata_tags', type: 'Edm.String', nullable: true },
    { name: 'Metadata_category', type: 'Edm.String', nullable: true },
    { name: 'Metadata_status', type: 'Edm.String', nullable: true },
    { name: 'Metadata_priority', type: 'Edm.Int32', nullable: true }
  ]
}

function getRelationshipProperties(): PropertyDef[] {
  return [
    { name: 'Id', type: 'Edm.String', nullable: false },
    { name: 'FromId', type: 'Edm.String', nullable: false },
    { name: 'ToId', type: 'Edm.String', nullable: false },
    { name: 'Type', type: 'Edm.String', nullable: false },
    { name: 'Weight', type: 'Edm.Double', nullable: true },
    { name: 'Confidence', type: 'Edm.Double', nullable: true },
    { name: 'CreatedAt', type: 'Edm.DateTimeOffset', nullable: false },
    { name: 'UpdatedAt', type: 'Edm.DateTimeOffset', nullable: true },
    { name: 'Service', type: 'Edm.String', nullable: true },
    { name: 'Metadata', type: 'Edm.String', nullable: true }
  ]
}

function generateRelationshipType(properties: PropertyDef[]): string {
  return `      <!-- Relationship Type -->
      <EntityType Name="Relationship">
        <Key>
          <PropertyRef Name="Id"/>
        </Key>
${properties.map((p) => `        <Property Name="${p.name}" Type="${p.type}" Nullable="${p.nullable}"/>`).join('\n')}
      </EntityType>`
}

function generateVerbTypeEnum(): string {
  return `      <!-- Enum: VerbType -->
      <EnumType Name="VerbType">
${Object.values(VerbType)
    .map((v, i) => `        <Member Name="${v}" Value="${i}"/>`)
    .join('\n')}
      </EnumType>`
}
