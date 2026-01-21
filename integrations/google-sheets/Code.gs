/**
 * Brainy Google Sheets Add-on
 *
 * Custom functions and sidebar for two-way sync with Brainy.
 *
 * Setup:
 * 1. Open Script Editor: Extensions → Apps Script
 * 2. Paste this code into Code.gs
 * 3. Set your Brainy URL: Tools → Script properties → Add BRAINY_URL
 * 4. Refresh your spreadsheet
 *
 * Custom Functions:
 * - =BRAINY_QUERY(query, limit) - Query entities
 * - =BRAINY_GET(id) - Get entity by ID
 * - =BRAINY_SIMILAR(text, limit) - Semantic search
 * - =BRAINY_RELATIONS(entityId, direction) - Get relationships
 * - =BRAINY_TYPES() - List available types
 *
 * For full documentation: https://github.com/soulcraft/brainy
 */

// Configuration
const CONFIG_BRAINY_URL = 'BRAINY_URL';
const CONFIG_API_KEY = 'BRAINY_API_KEY';
const DEFAULT_LIMIT = 100;

/**
 * Get Brainy URL from script properties
 */
function getBrainyUrl() {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty(CONFIG_BRAINY_URL);
  if (!url) {
    throw new Error('Brainy URL not configured. Go to Extensions → Apps Script → Project Settings → Script Properties and add BRAINY_URL');
  }
  return url.replace(/\/$/, ''); // Remove trailing slash
}

/**
 * Get API key (optional)
 */
function getApiKey() {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty(CONFIG_API_KEY) || '';
}

/**
 * Make authenticated request to Brainy
 */
function brainyFetch(endpoint, options = {}) {
  const baseUrl = getBrainyUrl();
  const apiKey = getApiKey();

  const url = `${baseUrl}/sheets${endpoint}`;

  const fetchOptions = {
    method: options.method || 'GET',
    contentType: 'application/json',
    muteHttpExceptions: true,
    ...options
  };

  if (apiKey) {
    fetchOptions.headers = {
      ...fetchOptions.headers,
      'Authorization': `Bearer ${apiKey}`
    };
  }

  if (options.payload) {
    fetchOptions.payload = JSON.stringify(options.payload);
  }

  const response = UrlFetchApp.fetch(url, fetchOptions);
  const code = response.getResponseCode();
  const text = response.getContentText();

  if (code >= 400) {
    const error = JSON.parse(text);
    throw new Error(error.error || `HTTP ${code}`);
  }

  return JSON.parse(text);
}

// ============= Custom Functions =============

/**
 * Query Brainy entities
 *
 * @param {string} query Semantic search query or type filter (e.g., "type:person")
 * @param {number} limit Maximum results (default: 100)
 * @return {Array} Results as rows with headers
 * @customfunction
 */
function BRAINY_QUERY(query, limit) {
  query = query || '';
  limit = limit || DEFAULT_LIMIT;

  const params = new URLSearchParams();
  params.append('limit', limit);

  if (query) {
    // Check if it's a type filter
    if (query.toLowerCase().startsWith('type:')) {
      params.append('type', query.substring(5).trim());
    } else {
      params.append('q', query);
    }
  }

  const result = brainyFetch(`/query?${params.toString()}`);

  if (!result.rows || result.rows.length === 0) {
    return [['No results found']];
  }

  return [result.headers, ...result.rows];
}

/**
 * Get a single entity by ID
 *
 * @param {string} id Entity ID
 * @return {Array} Entity as rows with headers
 * @customfunction
 */
function BRAINY_GET(id) {
  if (!id) {
    return [['Error: ID required']];
  }

  const result = brainyFetch(`/entity/${id}`);

  if (!result.rows || result.rows.length === 0) {
    return [['Entity not found']];
  }

  return [result.headers, ...result.rows];
}

/**
 * Semantic similarity search
 *
 * @param {string} text Text to find similar entities to
 * @param {number} limit Maximum results (default: 10)
 * @return {Array} Similar entities as rows with headers
 * @customfunction
 */
function BRAINY_SIMILAR(text, limit) {
  if (!text) {
    return [['Error: Search text required']];
  }

  limit = limit || 10;

  const params = new URLSearchParams();
  params.append('q', text);
  params.append('limit', limit);

  const result = brainyFetch(`/similar?${params.toString()}`);

  if (!result.rows || result.rows.length === 0) {
    return [['No similar entities found']];
  }

  return [result.headers, ...result.rows];
}

/**
 * Get relationships for an entity
 *
 * @param {string} entityId Entity ID to get relationships for
 * @param {string} direction Direction: "from", "to", or "both" (default: "from")
 * @param {number} limit Maximum results (default: 100)
 * @return {Array} Relationships as rows with headers
 * @customfunction
 */
function BRAINY_RELATIONS(entityId, direction, limit) {
  if (!entityId) {
    return [['Error: Entity ID required']];
  }

  direction = direction || 'from';
  limit = limit || DEFAULT_LIMIT;

  const params = new URLSearchParams();
  params.append('limit', limit);

  if (direction === 'from' || direction === 'both') {
    params.append('from', entityId);
  }
  if (direction === 'to' || direction === 'both') {
    params.append('to', entityId);
  }

  const result = brainyFetch(`/relations?${params.toString()}`);

  if (!result.rows || result.rows.length === 0) {
    return [['No relationships found']];
  }

  return [result.headers, ...result.rows];
}

/**
 * List available entity types
 *
 * @return {Array} List of noun types
 * @customfunction
 */
function BRAINY_TYPES() {
  const result = brainyFetch('/schema');
  return [['Type'], ...result.nounTypes.map(t => [t])];
}

/**
 * List available relationship types
 *
 * @return {Array} List of verb types
 * @customfunction
 */
function BRAINY_RELATION_TYPES() {
  const result = brainyFetch('/schema');
  return [['Type'], ...result.verbTypes.map(t => [t])];
}

// ============= Menu & Sidebar =============

/**
 * Add menu on spreadsheet open
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Brainy')
    .addItem('Open Sidebar', 'showSidebar')
    .addSeparator()
    .addItem('Configure Connection', 'showConfig')
    .addItem('Test Connection', 'testConnection')
    .addToUi();
}

/**
 * Show the Brainy sidebar
 */
function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('Brainy')
    .setWidth(300);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Show configuration dialog
 */
function showConfig() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const currentUrl = props.getProperty(CONFIG_BRAINY_URL) || '';

  const response = ui.prompt(
    'Configure Brainy Connection',
    `Enter your Brainy server URL (current: ${currentUrl || 'not set'}):`,
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() === ui.Button.OK) {
    const url = response.getResponseText().trim();
    if (url) {
      props.setProperty(CONFIG_BRAINY_URL, url);
      ui.alert('Configuration saved! URL: ' + url);
    }
  }
}

/**
 * Test the connection
 */
function testConnection() {
  const ui = SpreadsheetApp.getUi();
  try {
    const result = brainyFetch('/health');
    ui.alert('Connection successful!\n\nStatus: ' + result.status + '\nUptime: ' + Math.round(result.uptime / 1000) + 's');
  } catch (e) {
    ui.alert('Connection failed!\n\n' + e.message);
  }
}

// ============= Sidebar Functions =============

/**
 * Get connection status for sidebar
 */
function getConnectionStatus() {
  try {
    const result = brainyFetch('/health');
    return {
      connected: true,
      url: getBrainyUrl(),
      status: result.status,
      uptime: result.uptime
    };
  } catch (e) {
    return {
      connected: false,
      error: e.message
    };
  }
}

/**
 * Query entities from sidebar
 */
function sidebarQuery(query, type, limit) {
  const params = new URLSearchParams();
  params.append('limit', limit || 50);

  if (query) params.append('q', query);
  if (type) params.append('type', type);

  return brainyFetch(`/query?${params.toString()}`);
}

/**
 * Add entity from sidebar
 */
function sidebarAddEntity(type, data, metadata) {
  return brainyFetch('/add', {
    method: 'POST',
    payload: { type, data, metadata }
  });
}

/**
 * Update entity from sidebar
 */
function sidebarUpdateEntity(id, data, metadata) {
  return brainyFetch('/update', {
    method: 'POST',
    payload: { id, data, metadata, merge: true }
  });
}

/**
 * Delete entity from sidebar
 */
function sidebarDeleteEntity(id) {
  return brainyFetch('/delete', {
    method: 'POST',
    payload: { id }
  });
}

/**
 * Get schema for sidebar dropdowns
 */
function sidebarGetSchema() {
  return brainyFetch('/schema');
}

/**
 * Insert query result into sheet at selection
 */
function insertQueryResult(query, type, limit) {
  const sheet = SpreadsheetApp.getActiveSheet();
  const selection = sheet.getActiveCell();

  const result = sidebarQuery(query, type, limit);

  if (!result.rows || result.rows.length === 0) {
    selection.setValue('No results');
    return;
  }

  const data = [result.headers, ...result.rows];
  const range = sheet.getRange(
    selection.getRow(),
    selection.getColumn(),
    data.length,
    data[0].length
  );

  range.setValues(data);

  return {
    inserted: result.rows.length,
    columns: result.headers.length
  };
}

/**
 * Sync selected range to Brainy
 */
function syncRangeToBrainy(type) {
  const sheet = SpreadsheetApp.getActiveSheet();
  const range = sheet.getActiveRange();
  const values = range.getValues();

  if (values.length < 2) {
    throw new Error('Need at least header row and one data row');
  }

  const headers = values[0];
  const operations = [];

  // Find ID column
  const idCol = headers.findIndex(h => h.toLowerCase() === 'id');

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const metadata = {};

    for (let j = 0; j < headers.length; j++) {
      if (j !== idCol && row[j]) {
        metadata[headers[j]] = row[j];
      }
    }

    if (idCol >= 0 && row[idCol]) {
      // Update existing
      operations.push({
        action: 'update',
        id: row[idCol],
        metadata
      });
    } else {
      // Add new
      operations.push({
        action: 'add',
        type: type,
        metadata
      });
    }
  }

  const result = brainyFetch('/batch', {
    method: 'POST',
    payload: { operations }
  });

  // Update IDs in sheet for new entities
  if (idCol >= 0) {
    for (let i = 0; i < result.results.length; i++) {
      if (result.results[i].action === 'add' && result.results[i].id) {
        sheet.getRange(range.getRow() + 1 + i, range.getColumn() + idCol).setValue(result.results[i].id);
      }
    }
  }

  return result;
}
