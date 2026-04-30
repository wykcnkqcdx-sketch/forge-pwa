const FORGE_CONFIG = {
  spreadsheetId: '', // Optional. Leave blank to use the bound spreadsheet.
  tabOrder: [
    'Meta',
    'Members',
    'Groups',
    'Sessions',
    'Assignments',
    'Completions',
    'Readiness',
    'Programme Templates',
  ],
  tabMap: {
    members: 'Members',
    groups: 'Groups',
    sessions: 'Sessions',
    assignments: 'Assignments',
    completions: 'Completions',
    readiness: 'Readiness',
    programmeTemplates: 'Programme Templates',
  },
};

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, error: 'Missing request body.' }, 400);
    }

    const payload = JSON.parse(e.postData.contents);
    validateForgePayload_(payload);

    const spreadsheet = getForgeSpreadsheet_();
    ensureTabOrder_(spreadsheet);

    writeMetaTab_(spreadsheet, payload);

    Object.keys(FORGE_CONFIG.tabMap).forEach(function (key) {
      const sheetName = FORGE_CONFIG.tabMap[key];
      const rows = Array.isArray(payload.tabs[key]) ? payload.tabs[key] : [];
      writeRowsToSheet_(spreadsheet, sheetName, rows);
    });

    return jsonResponse({
      ok: true,
      spreadsheetId: spreadsheet.getId(),
      spreadsheetUrl: spreadsheet.getUrl(),
      exportedAt: payload.exportedAt,
      tabCounts: Object.keys(FORGE_CONFIG.tabMap).reduce(function (acc, key) {
        acc[key] = Array.isArray(payload.tabs[key]) ? payload.tabs[key].length : 0;
        return acc;
      }, {}),
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error && error.message ? error.message : 'Unknown export error.',
    }, 500);
  }
}

function doGet() {
  const spreadsheet = getForgeSpreadsheet_();
  return jsonResponse({
    ok: true,
    service: 'FORGE Google Sheets Receiver',
    spreadsheetId: spreadsheet.getId(),
    spreadsheetUrl: spreadsheet.getUrl(),
    expectedTabs: FORGE_CONFIG.tabOrder,
  });
}

function getForgeSpreadsheet_() {
  if (FORGE_CONFIG.spreadsheetId) {
    return SpreadsheetApp.openById(FORGE_CONFIG.spreadsheetId);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function validateForgePayload_(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Payload must be an object.');
  }

  if (payload.app !== 'FORGE Tactical Fitness') {
    throw new Error('Unexpected app identifier.');
  }

  if (payload.version !== 1) {
    throw new Error('Unsupported payload version.');
  }

  if (!payload.tabs || typeof payload.tabs !== 'object') {
    throw new Error('Missing tabs object.');
  }
}

function ensureTabOrder_(spreadsheet) {
  FORGE_CONFIG.tabOrder.forEach(function (sheetName, index) {
    const existing = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
    spreadsheet.setActiveSheet(existing);
    spreadsheet.moveActiveSheet(index + 1);
  });
}

function writeMetaTab_(spreadsheet, payload) {
  const sheet = spreadsheet.getSheetByName('Meta') || spreadsheet.insertSheet('Meta');
  const rows = [
    ['FORGE Export Meta', ''],
    ['App', payload.app],
    ['Version', payload.version],
    ['Exported At', payload.exportedAt],
    ['Coach Email', payload.coachEmail || ''],
    ['Processed At', new Date().toISOString()],
  ];

  sheet.clearContents();
  sheet.clearFormats();
  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  sheet.getRange(1, 1, 1, 2).merge();
  sheet.getRange(1, 1).setFontWeight('bold').setFontSize(14);
  sheet.getRange(2, 1, rows.length - 1, 1).setFontWeight('bold');
  sheet.autoResizeColumns(1, 2);
}

function writeRowsToSheet_(spreadsheet, sheetName, rows) {
  const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
  const headers = buildHeaders_(rows);

  sheet.clearContents();
  sheet.clearFormats();

  if (!headers.length) {
    sheet.getRange(1, 1).setValue('No rows exported.');
    return;
  }

  const values = [headers].concat(
    rows.map(function (row) {
      return headers.map(function (header) {
        const value = row[header];
        if (value === undefined || value === null) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        return value;
      });
    })
  );

  sheet.getRange(1, 1, values.length, headers.length).setValues(values);
  styleSheet_(sheet, values.length, headers.length);
}

function buildHeaders_(rows) {
  const seen = {};
  const headers = [];

  rows.forEach(function (row) {
    Object.keys(row || {}).forEach(function (key) {
      if (!seen[key]) {
        seen[key] = true;
        headers.push(key);
      }
    });
  });

  return headers;
}

function styleSheet_(sheet, rowCount, columnCount) {
  const headerRange = sheet.getRange(1, 1, 1, columnCount);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#0f766e');
  headerRange.setFontColor('#ffffff');

  if (rowCount > 1) {
    const dataRange = sheet.getRange(2, 1, rowCount - 1, columnCount);
    dataRange.setVerticalAlignment('top');
    dataRange.setWrap(true);
  }

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, columnCount);
  if (columnCount > 0) {
    sheet.getRange(1, 1, rowCount, columnCount).createFilter();
  }
}

function jsonResponse(payload, statusCode) {
  const output = ContentService
    .createTextOutput(JSON.stringify(payload, null, 2))
    .setMimeType(ContentService.MimeType.JSON);

  if (statusCode && output.setStatusCode) {
    output.setStatusCode(statusCode);
  }

  return output;
}
