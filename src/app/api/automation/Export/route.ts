import fs from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── Types ──────────────────────────────────────────────────────────────────
interface DetailStep {
  action?: string;
  label?: string;
  value?: string;
  selector?: string;
  tagName?: string;
  inputType?: string;
  url?: string;
  isIframe?: boolean;
  frameId?: string | null;
}

interface NetworkLog {
  method?: string;
  url: string;
  status?: number;
  duration?: number;
  data?: {
    requestBody?: string | null;
    responseBody?: string | null;
  };
}

interface LogEntry {
  source?: string;
  detailStep?: DetailStep;
  network?: NetworkLog;
  isDetailStep?: boolean;
  isNetwork?: boolean;
  timestamp?: string;
  relativeMs?: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Baca semua log dari .current.jsonl atau .jsonl (legacy) */
async function readLogEntries(testCaseId: string): Promise<LogEntry[]> {
  const logsDir = path.join(process.cwd(), 'mini-services', 'logs');
  const candidates = [
    path.join(logsDir, `${testCaseId}.current.jsonl`),
    path.join(logsDir, `${testCaseId}.jsonl`),
  ];

  for (const filePath of candidates) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      const entries: LogEntry[] = [];
      for (const line of lines) {
        try {
          entries.push(JSON.parse(line));
        } catch {
          // skip malformed line
        }
      }
      if (entries.length > 0) return entries;
    } catch {
      // try next candidate
    }
  }
  return [];
}

/** Ubah selector CSS jadi nama Object Repository yang aman */
function selectorToObjectName(selector: string, label?: string): string {
  if (label && label.trim()) {
    return label.trim().replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_').slice(0, 60);
  }
  return selector
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60) || 'element';
}

/** Ubah URL API jadi nama Object Repository */
function urlToObjectName(url: string, method: string): string {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.replace(/^\//, '').split('/').filter(Boolean);
    const name = segments.slice(0, 4).join('_').replace(/[^a-zA-Z0-9_]/g, '_');
    return `${method.toUpperCase()}_${name || 'api'}`.slice(0, 80);
  } catch {
    return `${method.toUpperCase()}_api`.slice(0, 80);
  }
}

/** Generate Groovy keyword dari detailStep */
function detailStepToGroovy(step: DetailStep, objPath: string): string {
  const objRef = `findTestObject('Object Repository/${objPath}')`;

  switch (step.action) {
    case 'click':
      return `WebUI.click(${objRef})`;
    case 'input':
    case 'change': {
      const tag = step.tagName?.toLowerCase();
      const type = step.inputType?.toLowerCase();
      if (tag === 'select') {
        return `WebUI.selectOptionByLabel(${objRef}, '${(step.value || '').replace(/'/g, "\\'")}', false)`;
      }
      if (type === 'checkbox' || type === 'radio') {
        const checked = step.value === 'checked';
        return checked
          ? `WebUI.check(${objRef})`
          : `WebUI.uncheck(${objRef})`;
      }
      const val = (step.value || '').replace(/'/g, "\\'");
      return `WebUI.setText(${objRef}, '${val}')`;
    }
    default:
      return `WebUI.click(${objRef}) // action: ${step.action || 'unknown'}`;
  }
}

/** Generate Groovy WS block dari network log */
function networkToGroovy(net: NetworkLog, objPath: string): string {
  const lines: string[] = [];
  const varName = `response_${objPath.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}`;
  lines.push(`def ${varName} = WS.sendRequest(findTestObject('Object Repository/API/${objPath}'))`);
  if (net.status) {
    lines.push(`WS.verifyResponseStatusCode(${varName}, ${net.status})`);
  }
  return lines.join('\n');
}

/** Filter network logs — skip static assets & noise */
function isRelevantNetwork(net: NetworkLog): boolean {
  const url = net.url?.toLowerCase() || '';
  if (!url.startsWith('http')) return false;
  const noisy = ['.js', '.css', '.png', '.jpg', '.jpeg', '.svg', '.gif',
                 '.woff', '.woff2', '.ttf', '.ico', '.map', '/assets/', '/public/'];
  if (noisy.some(n => url.includes(n))) return false;
  const method = (net.method || '').toUpperCase();
  if (method === 'OPTIONS') return false;
  return true;
}

// ── Main exporter ──────────────────────────────────────────────────────────

function generateGroovy(testCaseId: string, entries: LogEntry[]): string {
  const lines: string[] = [];
  const header = [
    `import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI`,
    `import com.kms.katalon.core.webservice.keyword.WSBuiltInKeywords as WS`,
    `import com.kms.katalon.core.model.FailureHandling`,
    ``,
    `/**`,
    ` * Auto-generated from Local-Host Manual Capture`,
    ` * Test Case ID : ${testCaseId}`,
    ` * Generated at : ${new Date().toISOString()}`,
    ` */`,
    ``,
    `WebUI.openBrowser('')`,
    ``,
  ];
  lines.push(...header);

  let lastFrameUrl: string | null = null;
  let lastFrameId: string | null = null;
  let insideIframe = false;
  const usedObjectNames = new Map<string, number>();

  const getUniqueName = (base: string): string => {
    const count = usedObjectNames.get(base) || 0;
    usedObjectNames.set(base, count + 1);
    return count === 0 ? base : `${base}_${count}`;
  };

  for (const entry of entries) {

    // ── Detail Steps (DOM interactions) ──
    if (entry.detailStep || String(entry.source || '').startsWith('manual-step')) {
      const step = entry.detailStep;
      if (!step?.action || !step.selector) continue;

      // Handle iframe switch
      if (step.isIframe) {
        const frameChanged = step.url !== lastFrameUrl || step.frameId !== lastFrameId;
        if (frameChanged) {
          if (insideIframe) {
            lines.push(`WebUI.switchToDefaultContent()`);
          }
          const frameName = step.frameId
            ? `iframe_${step.frameId}`
            : `iframe_${step.url ? new URL(step.url).hostname.replace(/\./g, '_') : 'frame'}`;
          lines.push(`WebUI.switchToFrame(findTestObject('Object Repository/${frameName}'), 30)`);
          lines.push(``);
          lastFrameUrl = step.url || null;
          lastFrameId = step.frameId || null;
          insideIframe = true;
        }
      } else if (insideIframe) {
        // Keluar dari iframe kalau step ini bukan iframe
        lines.push(`WebUI.switchToDefaultContent()`);
        lines.push(``);
        insideIframe = false;
        lastFrameUrl = null;
        lastFrameId = null;
      }

      const baseName = selectorToObjectName(step.selector, step.label);
      const objName = getUniqueName(baseName);
      const groovyLine = detailStepToGroovy(step, objName);

      // Tambah comment kalau ada label
      if (step.label) {
        lines.push(`// Step: ${step.label}`);
      }
      lines.push(groovyLine);
      lines.push(``);
      continue;
    }

    // ── Network Logs (API assertions) ──
    if (entry.network && isRelevantNetwork(entry.network)) {
      const net = entry.network;
      const baseName = urlToObjectName(net.url, net.method || 'GET');
      const objName = getUniqueName(baseName);
      lines.push(`// API: ${net.method} ${net.url}`);
      lines.push(networkToGroovy(net, objName));
      lines.push(``);
    }
  }

  // Close iframe kalau masih terbuka di akhir
  if (insideIframe) {
    lines.push(`WebUI.switchToDefaultContent()`);
    lines.push(``);
  }

  lines.push(`WebUI.closeBrowser()`);

  return lines.join('\n');
}

// ── Route Handler ──────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const testCaseId = searchParams.get('testCaseId');
  const format = searchParams.get('format') || 'groovy';

  if (!testCaseId) {
    return NextResponse.json({ error: 'testCaseId is required' }, { status: 400 });
  }

  const entries = await readLogEntries(testCaseId);
  if (entries.length === 0) {
    return NextResponse.json(
      { error: 'No log entries found for this test case' },
      { status: 404 }
    );
  }

  if (format === 'json') {
    // Return raw structured steps untuk debug / preview
    const steps = entries.filter(e =>
      e.detailStep || String(e.source || '').startsWith('manual-step') || e.network
    );
    return NextResponse.json({ testCaseId, total: steps.length, steps });
  }

  // Default: groovy export
  const groovyContent = generateGroovy(testCaseId, entries);
  const filename = `TC_${testCaseId.replace(/[^a-zA-Z0-9]/g, '_')}.groovy`;

  return new NextResponse(groovyContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}