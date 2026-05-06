import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

interface GeneratedTestCase {
  testCaseId: string;
  page: string;
  subMenu: string;
  weight: string;
  testType: string;
  testAction: string;
  steps: string;
  expectedResult: string;
  priority: string;
  moduleId: string | null;
}

// Set max duration for this API route (Vercel/Next.js)
export const maxDuration = 60;

const AI_MODEL = process.env.GROQ_GENERATE_MODEL || process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
const MAX_CONTEXT_CASES = 12;
const MAX_CONTEXT_LINES = 4;
const MAX_OUTPUT_TOKENS = 1800;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, userPrompt, moduleFilter } = body;
    const requestedCount = Math.min(Math.max(Number(body.count || 4), 1), 8);

    if (!projectId) return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    if (!userPrompt) return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });

    const existingTestCases = await db.testCase.findMany({
      where: {
        projectId,
        ...(moduleFilter && moduleFilter !== 'all' ? { moduleId: moduleFilter } : {}),
      },
      select: {
        testCaseId: true,
        page: true,
        subMenu: true,
        testType: true,
        testAction: true,
        priority: true,
      },
      orderBy: { testCaseId: 'asc' },
      take: MAX_CONTEXT_CASES,
    });

    // Fetch modules for the project
    const projectModules = await db.module.findMany({
      where: { projectId },
    });
    const selectedModuleId = moduleFilter && moduleFilter !== 'all' ? String(moduleFilter) : null;
    const idSequence = await getNextIdSequence(projectId, selectedModuleId, requestedCount);

    // Build context
    const contextSummary = buildContext(existingTestCases, idSequence);

    const systemPrompt = `You are a QA Tester assistant. Generate test cases for web/mobile apps.
Respond with ONLY a valid JSON object containing a "test_cases" array.

Each test case object must have:
- testCaseId: string (use the provided next IDs exactly, in order)
- page: string (page being tested)
- subMenu: string (sub-section or "")
- weight: string (e.g. "5%", "10%", or "")
- testType: "Positive" or "Negative"
- testAction: string (in Indonesian/Bahasa Indonesia)
- steps: string (detailed steps using \\n for line breaks, prefixed with "- ", in Indonesian)
- expectedResult: string (in Indonesian)
- priority: "Critical" | "High" | "Medium" | "Low"
- moduleId: string or null (match ID from provided modules)

Generate exactly ${requestedCount} high-value test cases. Write testAction, steps, expectedResult in Indonesian.`;

    const userMessage = `Context:
${contextSummary}

Next testCaseId values to use exactly in order: ${idSequence.nextIds.join(', ')}
Available Modules (Use IDs only): ${projectModules.map(m => `${m.name}(id:${m.id})`).join(', ')}

User Request: ${userPrompt}

Return JSON with "test_cases" key:`;

    let completion;
    try {
      completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        model: AI_MODEL,
        temperature: 0.4,
        max_tokens: MAX_OUTPUT_TOKENS,
        response_format: { type: "json_object" }
      });
    } catch (aiError: unknown) {
      console.error('Groq API call failed:', aiError);
      return NextResponse.json({
        error: `Groq service error. Silakan coba lagi.`,
      }, { status: 502 });
    }

    const aiResponse = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(aiResponse);
    const generatedCases: GeneratedTestCase[] = parsed.test_cases || [];

    if (!Array.isArray(generatedCases) || generatedCases.length === 0) {
      return NextResponse.json({
        error: 'AI tidak berhasil menghasilkan test case.',
      }, { status: 422 });
    }

    // Validate and clean
    const cleanedCases = generatedCases.slice(0, requestedCount).map((tc, index) => ({
      testCaseId: idSequence.nextIds[index] || String(tc.testCaseId || ''),
      page: String(tc.page || ''),
      subMenu: String(tc.subMenu || ''),
      weight: String(tc.weight || ''),
      testType: tc.testType === 'Negative' ? 'Negative' : 'Positive',
      testAction: String(tc.testAction || ''),
      steps: String(tc.steps || ''),
      expectedResult: String(tc.expectedResult || ''),
      priority: ['Critical', 'High', 'Medium', 'Low'].includes(tc.priority) ? tc.priority : 'Medium',
      moduleId: selectedModuleId || (tc.moduleId && projectModules.some(m => m.id === tc.moduleId) ? tc.moduleId : null),
    })).filter(tc => tc.testCaseId && tc.page && tc.testAction);

    return NextResponse.json({ generated: cleanedCases });
  } catch (error) {
    console.error('POST /api/ai error:', error);
    return NextResponse.json({ error: 'Gagal generate test case' }, { status: 500 });
  }
}

interface IdSequence {
  prefix: string;
  width: number;
  lastNumber: number;
  nextIds: string[];
}

async function getNextIdSequence(projectId: string, moduleId: string | null, count: number): Promise<IdSequence> {
  const testCases = await db.testCase.findMany({
    where: {
      projectId,
      ...(moduleId ? { moduleId } : {}),
    },
    select: { testCaseId: true },
  });

  let prefix = 'A-';
  let width = 3;
  let lastNumber = 0;

  for (const testCase of testCases) {
    const parsed = parseTestCaseId(testCase.testCaseId);
    if (!parsed) continue;
    if (parsed.number > lastNumber) {
      prefix = parsed.prefix;
      width = parsed.width;
      lastNumber = parsed.number;
    }
  }

  const nextIds = Array.from({ length: count }, (_, index) => {
    const nextNumber = lastNumber + index + 1;
    return `${prefix}${String(nextNumber).padStart(width, '0')}`;
  });

  return { prefix, width, lastNumber, nextIds };
}

function parseTestCaseId(value: string) {
  const match = value.match(/^(.+?-)(\d+)$/);
  if (!match) return null;
  return {
    prefix: match[1],
    number: Number(match[2]),
    width: match[2].length,
  };
}

function buildContext(existingTestCases: Array<{
  testCaseId: string;
  page: string;
  subMenu: string | null;
  testType: string;
  testAction: string;
  priority: string;
}>, idSequence: IdSequence): string {
  if (existingTestCases.length === 0) return 'Empty project.';
  
  const lines: string[] = [];
  existingTestCases.slice(0, MAX_CONTEXT_LINES).forEach(tc => {
    lines.push(`[${tc.testCaseId}] ${tc.page}${tc.subMenu ? ` > ${tc.subMenu}` : ''} | ${tc.testType} | ${tc.priority} | ${tc.testAction}`);
  });
  
  lines.push(`Last numeric testCaseId in selected scope: ${idSequence.prefix}${String(idSequence.lastNumber).padStart(idSequence.width, '0')}`);
  
  return lines.join('\n');
}
