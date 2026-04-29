import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

// Known header keywords to auto-detect the header row
const HEADER_KEYWORDS = ['ID', 'Page', 'Sub Menu', 'Feature', 'Test', 'Action', 'Step', 'Expected Result', 'Actual Result', 'Status', 'Remarks'];

/**
 * Auto-detect the header row index in a sheet.
 * Scans rows from top and finds the first row where at least 3 header keywords appear.
 * Returns 0-based row index, or 0 if not found.
 */
function detectHeaderRowIndex(sheet: XLSX.WorkSheet): number {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  for (let r = range.s.r; r <= Math.min(range.s.r + 10, range.e.r); r++) {
    let matchCount = 0;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.v !== undefined) {
        const val = String(cell.v).trim();
        if (HEADER_KEYWORDS.some(kw => val.toLowerCase().includes(kw.toLowerCase()))) {
          matchCount++;
        }
      }
    }
    if (matchCount >= 3) return r;
  }
  return 0; // fallback to first row
}

/**
 * Parse a sheet with auto-detected header row.
 */
function parseSheetWithAutoHeader(sheet: XLSX.WorkSheet): Record<string, unknown>[] {
  const headerRow = detectHeaderRowIndex(sheet);

  // Convert sheet to array of arrays
  const rawData: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (rawData.length <= headerRow) return [];

  // Extract headers from the detected header row
  const headers = rawData[headerRow].map((h: unknown) => String(h || '').trim());

  // Convert remaining rows to objects using those headers
  const rows: Record<string, unknown>[] = [];
  for (let i = headerRow + 1; i < rawData.length; i++) {
    const rowObj: Record<string, unknown> = {};
    let hasData = false;
    for (let j = 0; j < headers.length; j++) {
      const val = rawData[i]?.[j];
      rowObj[headers[j]] = val !== undefined ? val : '';
      if (val !== undefined && val !== '' && val !== null) hasData = true;
    }
    // Skip completely empty rows
    if (hasData) rows.push(rowObj);
  }

  return rows;
}

/**
 * Normalize the column value from a row, trying multiple possible column names.
 */
function getColValue(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return String(row[key]);
    }
  }
  return '';
}

// ============== IMPORT (POST) ==============
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const projectId = formData.get('projectId') as string;
    const createModules = formData.get('createModules') === 'true';

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (!projectId) return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    let totalImported = 0;
    const sheetResults: { sheet: string; imported: number; skipped: number; moduleId?: string }[] = [];

    // Process ALL sheets
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet || !sheet['!ref']) {
        sheetResults.push({ sheet: sheetName, imported: 0, skipped: 0 });
        continue;
      }

      // Auto-detect header row and parse
      const rows = parseSheetWithAutoHeader(sheet);

      if (rows.length === 0) {
        sheetResults.push({ sheet: sheetName, imported: 0, skipped: 0 });
        continue;
      }

      // Optionally create a Module for this sheet
      let moduleId: string | null = null;
      if (createModules) {
        // Check if module already exists
        const existing = await db.module.findFirst({
          where: { projectId, name: sheetName },
        });
        if (existing) {
          moduleId = existing.id;
        } else {
          const newModule = await db.module.create({
            data: { name: sheetName, projectId },
          });
          moduleId = newModule.id;
        }
      }

      let imported = 0;
      let skipped = 0;

      for (const row of rows) {
        // Get the test case ID - required field
        const testCaseId = getColValue(row, 'ID', 'Test Case ID', 'testCaseId');
        if (!testCaseId) {
          skipped++;
          continue;
        }

        // Get page and subMenu
        const page = getColValue(row, 'Page', 'page');
        const subMenu = getColValue(row, 'Sub Menu', 'subMenu', 'Submenu') || null;

        // Get the "Feature" column and "Test" column
        const feature = getColValue(row, 'Feature', 'feature');
        const testDescription = getColValue(row, 'Test', 'Test Action', 'testAction');

        // Get action/prerequisite
        const action = getColValue(row, 'Action', 'Prerequisite', 'action', 'testAction');

        // Get steps
        const steps = getColValue(row, 'Steps', 'Step', 'steps');

        // Build testAction: combine Feature + Test description if both exist
        let testAction = '';
        if (feature && testDescription) {
          testAction = `[${feature}] ${testDescription}`;
        } else if (testDescription) {
          testAction = testDescription;
        } else if (feature) {
          testAction = feature;
        } else if (action) {
          testAction = action;
        }

        // Build steps: combine Action prerequisite with Steps if both exist
        let finalSteps = '';
        if (action && steps) {
          finalSteps = `Prerequisite: ${action}\n\nSteps:\n${steps}`;
        } else if (steps) {
          finalSteps = steps;
        } else if (action) {
          finalSteps = action;
        }

        // Expected result and actual result
        const expectedResult = getColValue(row, 'Expected Result', 'expectedResult');
        const actualResultRaw = getColValue(row, 'Actual Result', 'actualResult');
        let actualResult: string | null = null;
        if (actualResultRaw) {
          // Normalize actual result to dropdown values
          const lower = actualResultRaw.toLowerCase().trim();
          if (lower === 'as expected' || lower === 'pass' || lower === 'passed' || lower === '✓') {
            actualResult = 'As Expected';
          } else if (lower === 'not as expected' || lower === 'fail' || lower === 'failed' || lower === '✗') {
            actualResult = 'Not As Expected';
          } else {
            actualResult = actualResultRaw;
          }
        }

        // Status normalization
        const statusRaw = getColValue(row, 'Status', 'status');
        let status = 'NOT DONE';
        if (statusRaw) {
          const lower = statusRaw.toLowerCase().trim();
          if (lower === 'done' || lower === 'pass' || lower === 'passed' || lower === '✓') {
            status = 'DONE';
          } else if (lower === 'in progress' || lower === 'in-progress' || lower === 'wip') {
            status = 'IN PROGRESS';
          } else if (lower === 'blocked') {
            status = 'BLOCKED';
          } else if (lower === 'failed' || lower === 'fail' || lower === '✗') {
            status = 'FAILED';
          } else if (lower === 'ready to retest') {
            status = 'READY TO RETEST';
          } else if (lower === 'tbh' || lower === 'to be honed' || lower === 'tbd' || lower === 'to be determined') {
            status = 'TBH';
          } else if (lower === 'not done' || lower === 'not done yet' || lower === 'todo') {
            status = 'NOT DONE';
          }
        }

        // If actual result is "Not As Expected" and no explicit status, set to FAILED
        if (actualResult === 'Not As Expected' && status === 'NOT DONE') {
          status = 'FAILED';
        }
        // If actual result is "As Expected" and no explicit status, set to DONE
        if (actualResult === 'As Expected' && status === 'NOT DONE') {
          status = 'DONE';
        }

        // Progress from status
        let progress = 0;
        switch (status) {
          case 'DONE': progress = 100; break;
          case 'IN PROGRESS': progress = 50; break;
          case 'READY TO RETEST': progress = 50; break;
          default: progress = 0;
        }

        // Weight
        const weightRaw = getColValue(row, 'Weight', 'Bobot', 'weight') || null;

        // Priority
        const priorityRaw = getColValue(row, 'Priority', 'priority');
        let priority = 'Medium';
        if (priorityRaw) {
          const p = priorityRaw.toLowerCase().trim();
          if (['critical', 'high', 'medium', 'low'].includes(p)) {
            priority = p.charAt(0).toUpperCase() + p.slice(1);
          }
        }

        // Test Type
        const testTypeRaw = getColValue(row, 'Test Type', 'Type', 'testType');
        let testType = 'Positive';
        if (testTypeRaw) {
          const t = testTypeRaw.toLowerCase().trim();
          if (t === 'negative') testType = 'Negative';
        }

        // Remarks
        const remarks = getColValue(row, 'Remarks of Test', 'Remarks', 'remarks', 'Catatan') || null;

        try {
          const tc = await db.testCase.create({
            data: {
              testCaseId,
              page: page || sheetName, // Use sheet name as fallback for page
              subMenu,
              weight: weightRaw,
              testType,
              testAction,
              steps: finalSteps,
              expectedResult,
              actualResult,
              status,
              progress,
              remarks,
              priority,
              projectId,
              moduleId: moduleId || null,
            },
          });

          // If status is FAILED, auto-create BugFix entry
          if (status === 'FAILED') {
            const existingBugFix = await db.bugFix.findFirst({
              where: { sourceTestCaseId: tc.id },
            });
            if (!existingBugFix) {
              await db.bugFix.create({
                data: {
                  sourceTestCaseId: tc.id,
                  testCaseId,
                  projectId,
                  page: page || sheetName,
                  subMenu,
                  testType,
                  testAction,
                  steps: finalSteps,
                  expectedResult,
                  actualResult: 'Not As Expected',
                  priority,
                  moduleId: moduleId || null,
                  status: 'SUDAH DILAPORKAN',
                  reportedAt: new Date(),
                },
              });
            }
          }

          imported++;
        } catch (err) {
          console.error(`Failed to import row with ID ${testCaseId}:`, err);
          skipped++;
        }
      }

      totalImported += imported;
      sheetResults.push({ sheet: sheetName, imported, skipped, moduleId: moduleId || undefined });
    }

    // Recalculate weights for all imported test cases (grouped by projectId + page + subMenu)
    const allNewCases = await db.testCase.findMany({
      where: { projectId },
      select: { id: true, page: true, subMenu: true },
    });
    const menuGroups = new Map<string, string[]>();
    for (const tc of allNewCases) {
      const key = `${tc.page}|||${tc.subMenu || ''}`;
      if (!menuGroups.has(key)) menuGroups.set(key, []);
      menuGroups.get(key)!.push(tc.id);
    }
    for (const [, ids] of menuGroups) {
      if (ids.length === 0) continue;
      const weightPerCase = (100 / ids.length).toFixed(2) + '%';
      await Promise.all(ids.map(id =>
        db.testCase.update({ where: { id }, data: { weight: weightPerCase } })
      ));
    }

    return NextResponse.json({
      imported: totalImported,
      sheets: sheetResults,
      totalSheets: workbook.SheetNames.length,
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/excel/import error:', error);
    return NextResponse.json({ error: 'Failed to import Excel file' }, { status: 500 });
  }
}

// ============== EXPORT (GET) - Matching user's Excel format exactly ==============

// Column headers matching the user's Excel exactly
const HEADERS = ['ID', 'Page', 'Sub Menu', 'Feature', 'Bobot', 'Test', 'Action', 'Step', 'Expected Result', 'Actual Result', 'Status', 'Progress', 'Remarks of Test'];

// Column widths from user's Excel (in character units)
const COL_WIDTHS = [5.5, 5.75, 17.5, 42.63, 13, 54.13, 57, 62, 87.63, 38.13, 13, 13, 13];

// Header fill color: FFD9EAD3 (light green from user's Excel)
const HEADER_FILL: Partial<ExcelJS.FillPattern> = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFD9EAD3' },
};

// Header font: bold, size 12
const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  size: 12,
};

// Thin border for header cells
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  bottom: { style: 'thin' },
  left: { style: 'thin' },
  right: { style: 'thin' },
};

// Legend colors from Scan-to-Order sheet
const LEGEND_COLORS = {
  green: 'FF00FF00',   // Sudah implementasi, tidak ada masalah
  yellow: 'FFFFFF00',  // Sudah Implementasi, ada adjustment
  red: 'FFFF0000',     // Sudah implementasi, ada bug
  white: 'FFFFFFFF',   // Belum Implementasi
};

/**
 * Apply header row styling to a worksheet row
 */
function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = THIN_BORDER;
  });
  row.height = 25;
}

/**
 * Apply data row styling to a worksheet row
 */
function styleDataRow(row: ExcelJS.Row) {
  row.eachCell((cell, colNumber) => {
    // Wrap text for Action (col 7), Step (col 8), Actual Result (col 10)
    const shouldWrap = [7, 8, 10].includes(colNumber);
    cell.alignment = {
      vertical: 'top',
      wrapText: shouldWrap,
    };
    // Font size 10 for Bobot (5), Status (11), Progress (12), Remarks (13)
    if ([5, 11, 12, 13].includes(colNumber)) {
      cell.font = { size: 10 };
    }
  });
}

/**
 * Add legend section (like Scan-to-Order sheet)
 */
function addLegendSection(ws: ExcelJS.Worksheet) {
  // Row 1: Legend header
  const legendData = [
    { text: '= Sudah implementasi, tidak ada masalah', color: LEGEND_COLORS.green },
    { text: '= Sudah Implementasi, ada adjustment (Opsional)', color: LEGEND_COLORS.yellow },
    { text: '= Sudah implementasi, ada bug', color: LEGEND_COLORS.red },
    { text: '= Belum Implementasi', color: LEGEND_COLORS.white },
  ];

  legendData.forEach((item, idx) => {
    const row = ws.getRow(idx + 1);
    // Color indicator in column B
    const colorCell = row.getCell(2);
    colorCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: item.color },
    };
    // Text in column C
    const textCell = row.getCell(3);
    textCell.value = item.text;
    textCell.font = { size: 10 };
  });
}

/**
 * Write test case data rows to a worksheet starting at a given row
 */
function writeTestCaseRows(ws: ExcelJS.Worksheet, testCases: typeof import('@/lib/db').db.testCase.findMany extends Promise<infer T> ? T : never, startRow: number): number {
  let currentRow = startRow;

  for (const tc of testCases) {
    const row = ws.getRow(currentRow);

    // Extract feature from testAction if it was stored as [Feature] description
    let feature = '';
    let testDesc = tc.testAction || '';
    const featureMatch = tc.testAction?.match(/^\[(.+?)\]\s*(.*)/);
    if (featureMatch) {
      feature = featureMatch[1];
      testDesc = featureMatch[2] || tc.testAction;
    }

    // Extract action from steps if it was stored as "Prerequisite: ...\n\nSteps:\n..."
    let action = '';
    let steps = tc.steps || '';
    const actionMatch = tc.steps?.match(/^Prerequisite:\s*(.+?)(?:\n\nSteps:\n|\nSteps:\n)(.*)/s);
    if (actionMatch) {
      action = actionMatch[1];
      steps = actionMatch[2] || tc.steps;
    }

    // Set cell values matching user's Excel columns exactly
    row.getCell(1).value = tc.testCaseId;                       // ID
    row.getCell(2).value = tc.page;                              // Page
    row.getCell(3).value = tc.subMenu || '';                     // Sub Menu
    row.getCell(4).value = feature;                              // Feature
    row.getCell(5).value = tc.weight || '';                      // Bobot
    row.getCell(6).value = testDesc;                             // Test
    row.getCell(7).value = action;                               // Action
    row.getCell(8).value = steps;                                // Step
    row.getCell(9).value = tc.expectedResult || '';              // Expected Result
    row.getCell(10).value = tc.actualResult || '';               // Actual Result
    row.getCell(11).value = tc.status;                           // Status
    row.getCell(12).value = tc.progress;                         // Progress
    row.getCell(13).value = tc.remarks || '';                    // Remarks of Test

    styleDataRow(row);
    currentRow++;
  }

  return currentRow;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');
    const format = url.searchParams.get('format') || 'xlsx';
    const multiSheet = url.searchParams.get('multiSheet') === 'true';

    if (!projectId) return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });

    const testCases = await db.testCase.findMany({
      where: { projectId },
      include: { module: true },
      orderBy: { testCaseId: 'asc' },
    });

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    });

    // ============== ExcelJS styled export matching user's Excel format ==============
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Test Case Manager';
    workbook.created = new Date();

    if (multiSheet) {
      // Group by module (sheet per module, matching user's format)
      const moduleGroups = new Map<string, typeof testCases>();
      const ungrouped: typeof testCases = [];

      for (const tc of testCases) {
        const modName = tc.module?.name;
        if (modName) {
          if (!moduleGroups.has(modName)) moduleGroups.set(modName, []);
          moduleGroups.get(modName)!.push(tc);
        } else {
          ungrouped.push(tc);
        }
      }

      // Create a sheet per module
      for (const [modName, cases] of moduleGroups) {
        const sheetName = modName.substring(0, 31);
        const ws = workbook.addWorksheet(sheetName);

        // Set column widths matching user's Excel
        for (let i = 0; i < HEADERS.length; i++) {
          ws.getColumn(i + 1).width = COL_WIDTHS[i];
        }

        // Row 1: Header row (no legend for module sheets)
        const headerRow = ws.getRow(1);
        HEADERS.forEach((h, idx) => {
          headerRow.getCell(idx + 1).value = h;
        });
        styleHeaderRow(headerRow);

        // Data rows start at row 2
        writeTestCaseRows(ws, cases, 2);
      }

      // Ungrouped test cases
      if (ungrouped.length > 0) {
        const ws = workbook.addWorksheet('Ungrouped');
        for (let i = 0; i < HEADERS.length; i++) {
          ws.getColumn(i + 1).width = COL_WIDTHS[i];
        }
        const headerRow = ws.getRow(1);
        HEADERS.forEach((h, idx) => {
          headerRow.getCell(idx + 1).value = h;
        });
        styleHeaderRow(headerRow);
        writeTestCaseRows(ws, ungrouped, 2);
      }

      // If no data at all, add empty sheet
      if (testCases.length === 0) {
        const ws = workbook.addWorksheet('Test Cases');
        for (let i = 0; i < HEADERS.length; i++) {
          ws.getColumn(i + 1).width = COL_WIDTHS[i];
        }
        const headerRow = ws.getRow(1);
        HEADERS.forEach((h, idx) => {
          headerRow.getCell(idx + 1).value = h;
        });
        styleHeaderRow(headerRow);
      }
    } else {
      // Single sheet with all test cases, matching user's original Excel format
      const ws = workbook.addWorksheet(project?.name || 'Test Cases');

      // Set column widths matching user's Excel
      for (let i = 0; i < HEADERS.length; i++) {
        ws.getColumn(i + 1).width = COL_WIDTHS[i];
      }

      // Separate whitebox (regular) and blackbox (negative test type) test cases
      const whiteboxCases = testCases.filter(tc => tc.testType !== 'Negative');
      const blackboxCases = testCases.filter(tc => tc.testType === 'Negative');

      let currentRow = 1;

      // Row 1: Title/Link row (like user's Kiosk sheet row 1)
      const titleRow = ws.getRow(currentRow);
      const projectTitle = project?.name || 'Test Cases';
      titleRow.getCell(1).value = `Test Case ${projectTitle}`;
      titleRow.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF0000FF' } };
      titleRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF00FF00' },
      };
      // Merge A1:M1 for title - clear other cells first to avoid overlap
      for (let c = 2; c <= HEADERS.length; c++) {
        titleRow.getCell(c).value = '';
      }
      ws.mergeCells(currentRow, 1, currentRow, HEADERS.length);
      currentRow++;

      // Row 2: Header row
      const headerRow = ws.getRow(currentRow);
      HEADERS.forEach((h, idx) => {
        headerRow.getCell(idx + 1).value = h;
      });
      styleHeaderRow(headerRow);
      currentRow++;

      // Write whitebox test cases
      if (whiteboxCases.length > 0) {
        currentRow = writeTestCaseRows(ws, whiteboxCases, currentRow);
      }

      // If there are blackbox test cases, add a section divider (like user's "B. Testcase Blackbox")
      if (blackboxCases.length > 0) {
        // 2 empty rows (spacing like user's Excel)
        currentRow++;
        currentRow++;

        // Section header (merged, bold, like "B. Testcase Blackbox")
        const sectionRow = ws.getRow(currentRow);
        sectionRow.getCell(1).value = 'B. Testcase Blackbox';
        sectionRow.getCell(1).font = { bold: true, size: 12 };
        // Clear other cells in the merged range before merging
        for (let c = 2; c <= HEADERS.length; c++) {
          sectionRow.getCell(c).value = '';
        }
        ws.mergeCells(currentRow, 1, currentRow, HEADERS.length);
        currentRow++;

        // Repeated header row after section divider
        const headerRow2 = ws.getRow(currentRow);
        HEADERS.forEach((h, idx) => {
          headerRow2.getCell(idx + 1).value = h;
        });
        styleHeaderRow(headerRow2);
        currentRow++;

        // Write blackbox test cases
        currentRow = writeTestCaseRows(ws, blackboxCases, currentRow);
      }
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    if (format === 'csv') {
      // For CSV, fall back to simple XLSX-based CSV generation
      const simpleWb = XLSX.utils.book_new();
      const exportData = testCases.map((tc) => ({
        ID: tc.testCaseId,
        Page: tc.page,
        'Sub Menu': tc.subMenu || '',
        Feature: '',
        Bobot: tc.weight || '',
        Test: tc.testAction,
        Action: '',
        Step: tc.steps,
        'Expected Result': tc.expectedResult,
        'Actual Result': tc.actualResult || '',
        Status: tc.status,
        Progress: tc.progress,
        'Remarks of Test': tc.remarks || '',
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(simpleWb, ws, 'Test Cases');
      const csv = XLSX.utils.sheet_to_csv(ws);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="testcases.csv"`,
        },
      });
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="testcases.xlsx"`,
      },
    });
  } catch (error) {
    console.error('GET /api/excel/export error:', error);
    return NextResponse.json({ error: 'Failed to export Excel file' }, { status: 500 });
  }
}
