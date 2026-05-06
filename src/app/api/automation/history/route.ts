import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

type LogKind = 'current' | 'previous' | 'legacy';

interface LogMeta {
  id: string;
  hasCurrent: boolean;
  hasPrevious: boolean;
  hasLegacy: boolean;
  hasAutomationRun: boolean;
  hasManualCapture: boolean;
  totalBytes: number;
  lastRunAt: string | null;
  files: Array<{
    kind: LogKind;
    name: string;
    size: number;
    updatedAt: string;
  }>;
}

const LOG_FILE_RE = /^(.+?)(?:\.(current|previous))?\.jsonl$/;

async function readLogSignals(filePath: string): Promise<{
  lastTimestamp: string | null;
  hasAutomationRun: boolean;
  hasManualCapture: boolean;
}> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    let lastTimestamp: string | null = null;
    let hasAutomationRun = false;
    let hasManualCapture = false;

    for (let index = lines.length - 1; index >= 0; index--) {
      try {
        const parsed = JSON.parse(lines[index]);
        const source = String(parsed?.source || '');
        const logText = typeof parsed?.log === 'string' ? parsed.log : JSON.stringify(parsed?.log || '');

        if (!lastTimestamp && parsed?.timestamp) lastTimestamp = parsed.timestamp;
        if (source.startsWith('manual-') || /Manual\s+Capture/i.test(logText)) hasManualCapture = true;
        if (/Automation/i.test(logText) || source === 'automation') hasAutomationRun = true;

        if (lastTimestamp && hasAutomationRun && hasManualCapture) break;
      } catch {
        // Skip malformed log lines.
      }
    }

    return { lastTimestamp, hasAutomationRun, hasManualCapture };
  } catch {
    return { lastTimestamp: null, hasAutomationRun: false, hasManualCapture: false };
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const logsDir = path.join(process.cwd(), 'mini-services', 'logs');
    let entries: string[] = [];

    try {
      entries = await fs.readdir(logsDir);
    } catch {
      return NextResponse.json({ items: [], total: 0 });
    }

    const metaById = new Map<string, LogMeta>();

    for (const name of entries) {
      const match = name.match(LOG_FILE_RE);
      if (!match) continue;

      const id = match[1];
      const kind = (match[2] || 'legacy') as LogKind;
      const filePath = path.join(logsDir, name);
      const stat = await fs.stat(filePath);
      if (stat.size <= 0) continue;

      const current = metaById.get(id) || {
        id,
        hasCurrent: false,
        hasPrevious: false,
        hasLegacy: false,
        hasAutomationRun: false,
        hasManualCapture: false,
        totalBytes: 0,
        lastRunAt: null,
        files: [],
      };

      current.hasCurrent = current.hasCurrent || kind === 'current';
      current.hasPrevious = current.hasPrevious || kind === 'previous';
      current.hasLegacy = current.hasLegacy || kind === 'legacy';
      current.totalBytes += stat.size;
      current.files.push({
        kind,
        name,
        size: stat.size,
        updatedAt: stat.mtime.toISOString(),
      });

      const signals = await readLogSignals(filePath);
      current.hasAutomationRun = current.hasAutomationRun || signals.hasAutomationRun;
      current.hasManualCapture = current.hasManualCapture || signals.hasManualCapture;

      const timestamp = signals.lastTimestamp;
      const fallbackTimestamp = stat.mtime.toISOString();
      const candidate = timestamp || fallbackTimestamp;
      if (!current.lastRunAt || new Date(candidate) > new Date(current.lastRunAt)) {
        current.lastRunAt = candidate;
      }

      metaById.set(id, current);
    }

    const ids = Array.from(metaById.keys());
    if (ids.length === 0) {
      return NextResponse.json({ items: [], total: 0 });
    }

    const testCases = await db.testCase.findMany({
      where: {
        id: { in: ids },
        projectId,
      },
      select: {
        id: true,
        testCaseId: true,
        page: true,
        subMenu: true,
        weight: true,
        testType: true,
        testAction: true,
        steps: true,
        expectedResult: true,
        actualResult: true,
        status: true,
        progress: true,
        remarks: true,
        priority: true,
        projectId: true,
        moduleId: true,
        createdAt: true,
        updatedAt: true,
        project: true,
        module: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    const bugFixItems = await db.bugFix.findMany({
      where: {
        id: { in: ids },
        projectId,
      },
      select: {
        id: true,
        testCaseId: true,
        page: true,
        subMenu: true,
        testType: true,
        testAction: true,
        steps: true,
        expectedResult: true,
        actualResult: true,
        status: true,
        priority: true,
        projectId: true,
        moduleId: true,
        createdAt: true,
        updatedAt: true,
        project: true,
        module: true,
        sourceTestCaseId: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    const testCaseItems = testCases
      .map((testCase) => {
        const automation = metaById.get(testCase.id);
        if (!automation) return null;
        const calculatedWeight = testCase.weight
          ? parseFloat(testCase.weight.replace('%', ''))
          : null;

        return {
          ...testCase,
          calculatedWeight: calculatedWeight !== null && !Number.isNaN(calculatedWeight)
            ? Math.round(calculatedWeight * 100) / 100
            : null,
          automationSource: 'testcase',
          automation,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const bugFixAutomatedItems = bugFixItems
      .map((bugFix) => {
        const automation = metaById.get(bugFix.id);
        if (!automation) return null;

        return {
          ...bugFix,
          weight: null,
          calculatedWeight: null,
          progress: bugFix.status === 'VERIFIED & FIXED'
            ? 100
            : bugFix.status === 'READY TO RETEST'
              ? 50
              : 0,
          remarks: null,
          stepLogs: null,
          automationSource: 'bugfix',
          automation,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const items = [...testCaseItems, ...bugFixAutomatedItems]
      .sort((a, b) => {
        const aTime = a.automation.lastRunAt ? new Date(a.automation.lastRunAt).getTime() : 0;
        const bTime = b.automation.lastRunAt ? new Date(b.automation.lastRunAt).getTime() : 0;
        return bTime - aTime;
      });

    return NextResponse.json({ items, total: items.length });
  } catch (error) {
    console.error('GET /api/automation/history error:', error);
    return NextResponse.json({ error: 'Failed to fetch automation history' }, { status: 500 });
  }
}
