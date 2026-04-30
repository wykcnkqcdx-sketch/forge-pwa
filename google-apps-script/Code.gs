const FORGE_CONFIG = {
  spreadsheetId: '', // Optional. Leave blank to use the bound spreadsheet.
  tabOrder: [
    'Meta',
    'Dashboard',
    'Weekly Rollups',
    'Member Drilldown',
    'Volume Trends',
    'Readiness Trends',
    'Compliance',
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

    writeDashboardTabs_(spreadsheet);

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

function writeDashboardTabs_(spreadsheet) {
  writeDashboardSheet_(spreadsheet);
  writeWeeklyRollupsSheet_(spreadsheet);
  writeMemberDrilldownSheet_(spreadsheet);
  writeVolumeTrendsSheet_(spreadsheet);
  writeReadinessTrendsSheet_(spreadsheet);
  writeComplianceSheet_(spreadsheet);
}

function writeMetaTab_(spreadsheet, payload) {
  const sheet = spreadsheet.getSheetByName('Meta') || spreadsheet.insertSheet('Meta');
  resetSheet_(sheet);

  const rows = [
    ['FORGE Export Meta', ''],
    ['App', payload.app],
    ['Version', payload.version],
    ['Exported At', payload.exportedAt],
    ['Coach Email', payload.coachEmail || ''],
    ['Processed At', new Date().toISOString()],
  ];

  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  sheet.getRange(1, 1, 1, 2).merge();
  sheet.getRange(1, 1).setFontWeight('bold').setFontSize(14);
  sheet.getRange(2, 1, rows.length - 1, 1).setFontWeight('bold');
  sheet.autoResizeColumns(1, 2);
}

function writeRowsToSheet_(spreadsheet, sheetName, rows) {
  const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
  const headers = buildHeaders_(rows);

  resetSheet_(sheet);

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

function writeDashboardSheet_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName('Dashboard') || spreadsheet.insertSheet('Dashboard');
  resetSheet_(sheet);
  writeSheetTitle_(sheet, 'FORGE Coach Dashboard', 'Auto-generated summary views from the latest export.');

  const metrics = [
    ['Latest Export', '=Meta!B4'],
    ['Coach Email', '=Meta!B5'],
    ['Members', '=MAX(COUNTA(Members!A:A)-1,0)'],
    ['Assignments', '=MAX(COUNTA(Assignments!A:A)-1,0)'],
    ['Completions', '=MAX(COUNTA(Completions!A:A)-1,0)'],
    ['Readiness Logs', '=MAX(COUNTA(Readiness!A:A)-1,0)'],
  ];

  sheet.getRange(4, 1, metrics.length, 2).setValues(metrics);
  sheet.getRange(4, 1, metrics.length, 1).setFontWeight('bold');
  sheet.getRange(4, 2, metrics.length, 1).setBackground('#f8fafc');

  sheet.getRange('N2').setFormula("=QUERY(Members!A:H,\"select H,count(H) where H is not null group by H label H 'Risk', count(H) 'Members'\",1)");
  sheet.getRange('N10').setFormula("=QUERY(Completions!A:C,\"select C,count(C) where C is not null group by C label C 'Member', count(C) 'Completions'\",1)");
  sheet.getRange('N18').setFormula("=QUERY(Completions!A:J,\"select D,sum(J) where D is not null group by D label D 'Group', sum(J) 'Volume'\",1)");

  addChart_(sheet, sheet.getRange('N2:O6'), Charts.ChartType.PIE, 1, 4, 'Risk Distribution');
  addChart_(sheet, sheet.getRange('N10:O20'), Charts.ChartType.BAR, 10, 4, 'Completions by Member');
  addChart_(sheet, sheet.getRange('N18:O24'), Charts.ChartType.COLUMN, 19, 4, 'Volume by Group');

  sheet.autoResizeColumns(1, 20);
}

function writeVolumeTrendsSheet_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName('Volume Trends') || spreadsheet.insertSheet('Volume Trends');
  resetSheet_(sheet);
  writeSheetTitle_(sheet, 'Volume Trends', 'Total volume, minutes, and session counts by member.');

  sheet.getRange('A3').setFormula("=QUERY(Completions!A:J,\"select C,sum(J),sum(I),count(A) where C is not null group by C label C 'Member', sum(J) 'Total Volume', sum(I) 'Total Minutes', count(A) 'Sessions'\",1)");

  addChart_(sheet, sheet.getRange('A3:B40'), Charts.ChartType.COLUMN, 3, 7, 'Volume by Member');
  addChart_(sheet, sheet.getRange('A3:D40'), Charts.ChartType.BAR, 20, 7, 'Minutes and Sessions by Member');

  sheet.autoResizeColumns(1, 6);
}

function writeWeeklyRollupsSheet_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName('Weekly Rollups') || spreadsheet.insertSheet('Weekly Rollups');
  resetSheet_(sheet);
  writeSheetTitle_(sheet, 'Weekly Rollups', 'Week-by-week squad completion volume and minutes.');

  sheet.getRange('A3').setFormula("=QUERY({ARRAYFORMULA(IF(Completions!M2:M=\"\",\"\",TEXT(Completions!M2:M,\"yyyy-ww\"))),Completions!J2:J,Completions!I2:I,Completions!D2:D},\"select Col1,sum(Col2),sum(Col3),count(Col4) where Col1 is not null group by Col1 order by Col1 label Col1 'Week', sum(Col2) 'Total Volume', sum(Col3) 'Total Minutes', count(Col4) 'Completions'\",0)");
  sheet.getRange('G3').setFormula("=QUERY({ARRAYFORMULA(IF(Readiness!B2:B=\"\",\"\",TEXT(Readiness!B2:B,\"yyyy-ww\"))),Readiness!F2:F,Readiness!H2:H,Readiness!J2:J},\"select Col1,avg(Col2),avg(Col3),avg(Col4) where Col1 is not null group by Col1 order by Col1 label Col1 'Week', avg(Col2) 'Avg Sleep Hours', avg(Col3) 'Avg Soreness', avg(Col4) 'Avg Pain'\",0)");

  addChart_(sheet, sheet.getRange('A3:D40'), Charts.ChartType.LINE, 3, 12, 'Weekly Volume and Minutes');
  addChart_(sheet, sheet.getRange('G3:J40'), Charts.ChartType.LINE, 20, 12, 'Weekly Readiness Signals');
  sheet.autoResizeColumns(1, 12);
}

function writeMemberDrilldownSheet_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName('Member Drilldown') || spreadsheet.insertSheet('Member Drilldown');
  resetSheet_(sheet);
  writeSheetTitle_(sheet, 'Member Drilldown', 'Select a member to inspect assignment, completion, and readiness detail.');

  sheet.getRange('A3').setValue('Selected Member');
  sheet.getRange('B3').setFormula('=IFERROR(INDEX(SORT(UNIQUE(FILTER(Members!B2:B,Members!B2:B<>""))),1),"")');
  sheet.getRange('A3:A6').setFontWeight('bold');
  sheet.getRange('A4').setValue('Current Group');
  sheet.getRange('B4').setFormula('=IF(B3="","",XLOOKUP(B3,Members!B:B,Members!E:E,""))');
  sheet.getRange('A5').setValue('Current Risk');
  sheet.getRange('B5').setFormula('=IF(B3="","",XLOOKUP(B3,Members!B:B,Members!H:H,""))');
  sheet.getRange('A6').setValue('Current Assignment');
  sheet.getRange('B6').setFormula('=IF(B3="","",XLOOKUP(B3,Members!B:B,Members!K:K,""))');

  sheet.getRange('D3').setValue('Pick Member');
  const memberOptions = SpreadsheetApp.newDataValidation()
    .requireValueInRange(sheet.getRange('K2:K'), true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange('B3').setDataValidation(memberOptions);
  sheet.getRange('K1').setValue('Members');
  sheet.getRange('K2').setFormula('=SORT(UNIQUE(FILTER(Members!B2:B,Members!B2:B<>"")))');

  sheet.getRange('A9').setValue('Recent Completions');
  sheet.getRange('A9').setFontWeight('bold');
  sheet.getRange('A10').setFormula("=IF($B$3=\"\",\"\",QUERY(Completions!A:M,\"select C,E,F,G,H,I,J,M where C = '\"&$B$3&\"' order by M desc label C 'Member', E 'Type', F 'Session Kind', G 'Assignment', H 'Effort', I 'Minutes', J 'Volume', M 'Completed At'\",1))");

  sheet.getRange('A24').setValue('Recent Readiness');
  sheet.getRange('A24').setFontWeight('bold');
  sheet.getRange('A25').setFormula("=IF($B$3=\"\",\"\",QUERY(Readiness!A:Q,\"select D,B,F,G,H,J,K,L,Q where D = '\"&$B$3&\"' order by B desc label D 'Member', B 'Logged At', F 'Sleep Hours', G 'Sleep Quality', H 'Soreness', J 'Pain', K 'Hydration', L 'Mood', Q 'HRV'\",1))");

  addChart_(sheet, sheet.getRange('A10:H20'), Charts.ChartType.COLUMN, 3, 14, 'Completion Load');
  addChart_(sheet, sheet.getRange('A25:I35'), Charts.ChartType.LINE, 20, 14, 'Readiness Trend');
  sheet.autoResizeColumns(1, 16);
}

function writeReadinessTrendsSheet_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName('Readiness Trends') || spreadsheet.insertSheet('Readiness Trends');
  resetSheet_(sheet);
  writeSheetTitle_(sheet, 'Readiness Trends', 'Averages for sleep, soreness, and pain by member.');

  sheet.getRange('A3').setFormula("=QUERY(Readiness!A:Q,\"select D,avg(F),avg(G),avg(H),avg(J) where D is not null group by D label D 'Member', avg(F) 'Avg Sleep Hours', avg(G) 'Avg Sleep Quality', avg(H) 'Avg Soreness', avg(J) 'Avg Pain'\",1)");

  addChart_(sheet, sheet.getRange('A3:E40'), Charts.ChartType.BAR, 3, 8, 'Readiness Snapshot by Member');

  sheet.autoResizeColumns(1, 6);
}

function writeComplianceSheet_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName('Compliance') || spreadsheet.insertSheet('Compliance');
  resetSheet_(sheet);
  writeSheetTitle_(sheet, 'Compliance', 'Effort and session distribution from logged completions.');

  sheet.getRange('A3').setFormula("=QUERY(Completions!A:H,\"select H,count(H) where H is not null group by H label H 'Effort', count(H) 'Sessions'\",1)");
  sheet.getRange('A12').setFormula("=QUERY(Completions!A:F,\"select F,count(F) where F is not null group by F label F 'Session Kind', count(F) 'Sessions'\",1)");

  addChart_(sheet, sheet.getRange('A3:B8'), Charts.ChartType.PIE, 3, 5, 'Effort Distribution');
  addChart_(sheet, sheet.getRange('A12:B20'), Charts.ChartType.COLUMN, 18, 5, 'Session Kind Distribution');

  sheet.autoResizeColumns(1, 4);
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
    ensureFilter_(sheet, rowCount, columnCount);
  }
}

function resetSheet_(sheet) {
  sheet.clearContents();
  sheet.clearFormats();
  const filter = sheet.getFilter();
  if (filter) {
    filter.remove();
  }
  const charts = sheet.getCharts();
  charts.forEach(function (chart) {
    sheet.removeChart(chart);
  });
}

function writeSheetTitle_(sheet, title, subtitle) {
  sheet.getRange('A1').setValue(title).setFontWeight('bold').setFontSize(16);
  sheet.getRange('A2').setValue(subtitle).setFontColor('#475569');
}

function addChart_(sheet, range, chartType, row, column, title) {
  const chart = sheet.newChart()
    .setChartType(chartType)
    .addRange(range)
    .setPosition(row, column, 0, 0)
    .setOption('title', title)
    .setOption('legend.position', 'right')
    .build();

  sheet.insertChart(chart);
}

function ensureFilter_(sheet, rowCount, columnCount) {
  const existing = sheet.getFilter();
  if (existing) {
    existing.remove();
  }
  sheet.getRange(1, 1, rowCount, columnCount).createFilter();
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
