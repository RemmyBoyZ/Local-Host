import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import fs from 'fs';
import path from 'path';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export const maxDuration = 60;

const MAX_FIELD_CHARS = 2500;
const MAX_EXECUTION_LOG_CHARS = 4500;
const MAX_EXTRA_LOG_CHARS = 5500;
const MAX_PROMPT_CHARS = 11000;
const RETRY_PROMPT_CHARS = 6500;
const MAX_COMPLETION_TOKENS = 700;
const IMPORTANT_LOG_PATTERN = /error|failed|failure|exception|timeout|severe|warn|warning|status["': ]+(4|5)\d\d|"\s*success\s*"\s*:\s*false|success[:= ]+false/i;

type SummaryRecord = {
  id: string;
  testCaseId: string;
  testType: string;
  testAction: string;
  steps: string;
  stepLogs: string | null;
  expectedResult: string;
  actualResult: string | null;
  status: string;
};

function limitText(value: string | null | undefined, maxChars: number) {
  const text = (value || '').trim();
  if (text.length <= maxChars) return text;

  const headLength = Math.floor(maxChars * 0.35);
  const tailLength = maxChars - headLength - 80;

  return [
    text.slice(0, headLength).trimEnd(),
    `\n...[dipotong: ${text.length - headLength - tailLength} karakter]...\n`,
    text.slice(-tailLength).trimStart(),
  ].join('');
}

function compactLogLine(line: string) {
  const trimmed = line.trim();

  try {
    const parsed = JSON.parse(trimmed);
    const parts = [
      parsed.timestamp || parsed.time,
      parsed.level,
      parsed.network?.event,
      parsed.network?.method,
      parsed.network?.status ? `status=${parsed.network.status}` : '',
      parsed.network?.success === false ? 'success=false' : '',
      parsed.network?.url,
      parsed.log,
    ].filter(Boolean);

    const compacted = parts.join(' | ');
    return limitText(compacted || trimmed, 500);
  } catch {
    return limitText(trimmed, 500);
  }
}

function compactLogs(rawLogs: string, maxChars: number) {
  const lines = rawLogs
    .split('\n')
    .map(compactLogLine)
    .filter(Boolean);

  if (!lines.length) return '';

  const important = lines.filter(line => IMPORTANT_LOG_PATTERN.test(line));
  const tail = lines.slice(-40);
  const selected = Array.from(new Set([...important.slice(-50), ...tail]));

  return limitText(selected.join('\n'), maxChars);
}

async function createSummary(systemPrompt: string, userMessage: string) {
  try {
    return await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      max_completion_tokens: MAX_COMPLETION_TOKENS,
    });
  } catch (error: any) {
    const status = error?.status;
    const message = error?.message || '';
    const isTooLarge = status === 413 || /request too large|tokens per minute|rate_limit_exceeded/i.test(message);

    if (!isTooLarge || userMessage.length <= RETRY_PROMPT_CHARS) throw error;

    const retryMessage = `${limitText(userMessage, RETRY_PROMPT_CHARS)}

NOTE: Context was reduced automatically because provider token limits were reached. Prioritize explicit errors, failed network calls, final status, expected vs actual result, and newest execution lines.`;

    console.warn(`[AI Summary] Provider rejected prompt size (${userMessage.length} chars). Retrying with ${retryMessage.length} chars.`);

    return groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: retryMessage },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      max_completion_tokens: MAX_COMPLETION_TOKENS,
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { testCaseId } = body;

    if (!testCaseId) return NextResponse.json({ error: 'Test Case ID is required' }, { status: 400 });

    const requestedId = String(testCaseId).trim();

    console.log(`[AI Summary] Mencari Test Case/BugFix untuk ID: ${requestedId}`);

    // Coba cari berdasarkan Database UUID (id)
    let tc: SummaryRecord | null = await db.testCase.findUnique({
      where: { id: requestedId },
    });
    let recordType: 'TestCase' | 'BugFix' = 'TestCase';

    // Jika tidak ketemu, coba cari berdasarkan Visual ID (testCaseId)
    if (!tc) {
      console.log(`[AI Summary] TestCase tidak ditemukan dengan UUID, mencoba Visual ID: ${requestedId}`);
      tc = await db.testCase.findFirst({
        where: { testCaseId: requestedId },
      });
    }

    // BugFix punya tabel sendiri. Automation sering mengirim id BugFix, bukan id TestCase asli.
    if (!tc) {
      console.log(`[AI Summary] TestCase tidak ditemukan, mencoba BugFix: ${requestedId}`);
      const bugFix = await db.bugFix.findFirst({
        where: {
          OR: [
            { id: requestedId },
            { testCaseId: requestedId },
            { sourceTestCaseId: requestedId },
          ],
        },
      });

      if (bugFix) {
        tc = bugFix;
        recordType = 'BugFix';
      }
    }

    if (!tc) {
      const totalInDb = await db.testCase.count();
      const totalBugFixInDb = await db.bugFix.count();
      const dbUrl = process.env.DATABASE_URL || 'Not Set';
      
      // Prisma resolves SQLite paths relative to the schema file (prisma/schema.prisma)
      const prismaDir = path.join(process.cwd(), 'prisma');
      const resolvedPath = path.resolve(prismaDir, dbUrl.replace('file:', ''));
      
      console.error(`[AI Summary] NOT FOUND: "${requestedId}". Total TestCase: ${totalInDb}. Total BugFix: ${totalBugFixInDb}. DB Path: ${resolvedPath}`);
      
      return NextResponse.json({ 
        error: `Test case atau bug fix "${requestedId}" tidak ditemukan.`,
        diagnostic: {
          requestedId,
          totalTestCases: totalInDb,
          totalBugFixItems: totalBugFixInDb,
          dbUrl: dbUrl,
          dbPath: resolvedPath,
          serverCwd: process.cwd()
        }
      }, { status: 404 });
    }

    console.log(`[AI Summary] Berhasil menemukan ${recordType}: ${tc.testCaseId} (${tc.id})`);

    // 1. Ambil logs dari database (execution logs)
    const executionLogs = compactLogs(tc.stepLogs || 'No execution logs found.', MAX_EXECUTION_LOG_CHARS);

    // 2. Ambil logs dari file system (console & network)
    let extraLogs = "";
    try {
      // Gunakan path absolute yang lebih aman
      const logsDir = path.join(process.cwd(), 'mini-services', 'logs');
      const logCandidates = Array.from(new Set([requestedId, tc.id, tc.testCaseId].filter(Boolean)));
      
      console.log(`[AI Summary] Mencari log untuk kandidat ID: ${logCandidates.join(', ')}`);

      const foundLogPath = logCandidates
        .map(id => path.join(logsDir, `${id}.current.jsonl`))
        .find(candidatePath => fs.existsSync(candidatePath));

      if (foundLogPath) {
        const fileContent = fs.readFileSync(foundLogPath, 'utf8');
        const lines = fileContent.split('\n').filter(l => l.trim());
        const importantLines = lines.filter(line => IMPORTANT_LOG_PATTERN.test(line));
        const selectedLines = Array.from(new Set([...importantLines.slice(-80), ...lines.slice(-80)]));
        extraLogs = compactLogs(selectedLines.join('\n'), MAX_EXTRA_LOG_CHARS);
        console.log(`[AI Summary] Berhasil memadatkan ${selectedLines.length} dari ${lines.length} baris log tambahan: ${foundLogPath}`);
      } else {
        console.warn(`[AI Summary] File current log tidak ditemukan untuk kandidat: ${logCandidates.join(', ')}`);
      }
    } catch (err: any) {
      console.error('[AI Summary] Error saat membaca file log:', err.message);
    }

    const systemPrompt = `You are a Senior QA Automation Analyst. Your task is to summarize the results of an automated test.
Analyze the provided Test Case Requirements (Steps & Expected Result) and compare them with the actual Automation Logs (Execution, Console, and Network).

Focus on:
1. SUCCESS/FAILURE: Did the test reach the expected result?
2. BUGS/ERRORS: Identify any specific errors (JS errors, API failures, or logic errors).
3. NETWORK: Mention any critical API calls that failed or took too long.
4. RECOMMENDATION: Brief advice on what to fix if it failed.

Keep the summary professional, structured (using bullet points), and concise. Use Indonesian language for the summary.`;

    const userMessage = `TEST CASE DETAILS:
Record Type: ${recordType}
ID: ${tc.testCaseId}
Database ID: ${tc.id}
Action: ${tc.testAction}
Type: ${tc.testType}
Status: ${tc.status}
Steps: ${limitText(tc.steps, MAX_FIELD_CHARS)}
Expected: ${limitText(tc.expectedResult, MAX_FIELD_CHARS)}
Actual: ${limitText(tc.actualResult || 'No actual result recorded.', MAX_FIELD_CHARS)}

AUTOMATION LOGS (EXECUTION):
${executionLogs}

AUTOMATION LOGS (CDP - CONSOLE & NETWORK):
${extraLogs || 'No CDP logs recorded.'}`;

    const compactUserMessage = limitText(userMessage, MAX_PROMPT_CHARS);
    console.log(`[AI Summary] Prompt size: system=${systemPrompt.length} chars, user=${compactUserMessage.length} chars`);

    const completion = await createSummary(systemPrompt, compactUserMessage);

    const summary = completion.choices[0]?.message?.content || 'Gagal menghasilkan ringkasan.';

    return NextResponse.json({ summary });
  } catch (error: any) {
    console.error('POST /api/ai/summary error:', error);
    return NextResponse.json({ error: 'Failed to generate summary: ' + error.message }, { status: 500 });
  }
}
