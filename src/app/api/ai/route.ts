import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, userPrompt, moduleFilter } = body;

    if (!projectId) return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    if (!userPrompt) return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });

    // Fetch a smaller set of test cases for context (reduced for performance)
    const existingTestCases = await db.testCase.findMany({
      where: {
        projectId,
        ...(moduleFilter && moduleFilter !== 'all' ? { moduleId: moduleFilter } : {}),
      },
      include: { module: true },
      orderBy: { testCaseId: 'asc' },
      take: 30,
    });

    // Fetch modules for the project
    const projectModules = await db.module.findMany({
      where: { projectId },
    });

    // Build a compact context from existing test cases
    const contextSummary = buildContext(existingTestCases, projectModules);

    // Create a more compact system prompt
    const systemPrompt = `You are a QA Tester assistant. Generate test cases for web/mobile apps.
Respond with ONLY a valid JSON array. No markdown, no explanation.

Each object must have:
- testCaseId: string (follow existing pattern like "A-005")
- page: string (page being tested)
- subMenu: string (sub-section or "")
- weight: string (e.g. "5%", "10%", or "")
- testType: "Positive" or "Negative"
- testAction: string (in Indonesian/Bahasa Indonesia)
- steps: string (detailed steps using \\n for line breaks, prefixed with "- ", in Indonesian)
- expectedResult: string (in Indonesian)
- priority: "Critical" | "High" | "Medium" | "Low"
- moduleId: string or null (from available modules)

JSON RULES:
1. Use \\n for line breaks in "steps", NOT actual newlines
2. No trailing commas
3. Must be parseable by JSON.parse()

Generate 3-12 test cases. Write testAction, steps, expectedResult in Indonesian.`;

    const userMessage = `Context:
${contextSummary}

Modules: ${projectModules.map(m => `${m.name}(id:${m.id})`).join(', ')}

Request: ${userPrompt}

JSON array only:`;

    // Call AI with timeout protection
    const zai = await ZAI.create();

    let completion;
    try {
      completion = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 3000,
      });
    } catch (aiError: unknown) {
      console.error('AI SDK call failed:', aiError);
      const errMsg = aiError instanceof Error ? aiError.message : 'Unknown AI error';
      return NextResponse.json({
        error: `AI service error: ${errMsg}. Silakan coba lagi.`,
      }, { status: 502 });
    }

    const aiResponse = completion.choices[0]?.message?.content || '';

    // Parse the AI response
    let generatedCases: GeneratedTestCase[] = [];
    try {
      let jsonStr = aiResponse.trim();
      // Remove markdown code block if present
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }

      // Try direct parse first
      try {
        generatedCases = JSON.parse(jsonStr);
      } catch {
        // Try to extract JSON array
        const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          let fixed = arrayMatch[0];
          // Fix unescaped newlines in string values
          fixed = fixed.replace(/"steps"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,/g, (match) => {
            return match.replace(/\n/g, '\\n');
          });
          fixed = fixed.replace(/\n(?=\s*- )/g, '\\n');
          try {
            generatedCases = JSON.parse(fixed);
          } catch {
            // More aggressive fix: escape raw newlines within string values
            const lines = fixed.split('\n');
            const rebuilt: string[] = [];
            let inString = false;
            for (const line of lines) {
              const quotes = (line.match(/(?<!\\)"/g) || []).length;
              if (quotes % 2 === 1) inString = !inString;
              if (inString) {
                rebuilt.push(line.replace(/"/g, '\\"') + '\\n');
              } else {
                rebuilt.push(line);
              }
            }
            generatedCases = JSON.parse(rebuilt.join('\n'));
          }
        }
      }
    } catch {
      console.error('Failed to parse AI response:', aiResponse.substring(0, 500));
      return NextResponse.json({
        error: 'AI menghasilkan format yang tidak valid. Silakan coba lagi.',
      }, { status: 422 });
    }

    if (!Array.isArray(generatedCases) || generatedCases.length === 0) {
      return NextResponse.json({
        error: 'AI tidak berhasil menghasilkan test case. Silakan coba lagi dengan prompt yang lebih spesifik.',
      }, { status: 422 });
    }

    // Validate and clean the generated cases
    const cleanedCases = generatedCases.map((tc) => ({
      testCaseId: String(tc.testCaseId || ''),
      page: String(tc.page || ''),
      subMenu: String(tc.subMenu || ''),
      weight: String(tc.weight || ''),
      testType: tc.testType === 'Negative' ? 'Negative' : 'Positive',
      testAction: String(tc.testAction || ''),
      steps: String(tc.steps || ''),
      expectedResult: String(tc.expectedResult || ''),
      priority: ['Critical', 'High', 'Medium', 'Low'].includes(tc.priority) ? tc.priority : 'Medium',
      moduleId: tc.moduleId && projectModules.some(m => m.id === tc.moduleId) ? tc.moduleId : null,
    })).filter(tc => tc.testCaseId && tc.page && tc.testAction);

    return NextResponse.json({ generated: cleanedCases });
  } catch (error) {
    console.error('POST /api/ai error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Gagal generate test case: ${msg}` }, { status: 500 });
  }
}

function buildContext(existingTestCases: TestCaseWithModule[], modules: { id: string; name: string }[]): string {
  if (existingTestCases.length === 0) {
    return 'No existing test cases. Empty project.';
  }

  const lines: string[] = [];
  lines.push(`Total TCs: ${existingTestCases.length}`);
  lines.push(`Modules: ${modules.map(m => m.name).join(', ')}`);

  // Show only 8 representative test cases (compact)
  const shown = new Set<string>();
  let count = 0;
  for (const tc of existingTestCases) {
    if (count >= 8) break;
    const key = `${tc.testCaseId}-${tc.testAction}`;
    if (shown.has(key)) continue;
    shown.add(key);
    lines.push(`[${tc.testCaseId}] ${tc.page}>${tc.subMenu || '-'} ${tc.testType} ${tc.priority} | ${tc.testAction}`);
    lines.push(`  Steps: ${tc.steps.substring(0, 100)}${tc.steps.length > 100 ? '...' : ''}`);
    count++;
  }

  // Summarize patterns (compact)
  const pages = [...new Set(existingTestCases.map(tc => tc.page))];
  const idPattern = existingTestCases[0]?.testCaseId?.match(/^[A-Z]+-/)?.[0] || 'A-';
  lines.push(`Pages: ${pages.join(', ')}`);
  lines.push(`ID pattern: ${idPattern}XXX`);

  return lines.join('\n');
}

interface TestCaseWithModule {
  testCaseId: string;
  page: string;
  subMenu: string | null;
  weight: string | null;
  testType: string;
  testAction: string;
  steps: string;
  expectedResult: string;
  status: string;
  priority: string;
  moduleId: string | null;
  module: { name: string } | null;
}
