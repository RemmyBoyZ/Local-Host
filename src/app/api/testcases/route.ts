import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// Auto-calculate progress based on status
const getProgressFromStatus = (status: string): number => {
  switch (status) {
    case 'DONE': return 100;
    case 'IN PROGRESS': return 50;
    case 'BLOCKED': return 0;
    case 'NOT DONE': return 0;
    case 'FAILED': return 0;
    case 'READY TO RETEST': return 50;
    case 'TBA': return 0; // Excluded from progress calculations
    default: return 0;
  }
};

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');
    const moduleId = url.searchParams.get('moduleId');
    const status = url.searchParams.get('status');
    const testType = url.searchParams.get('testType');
    const priority = url.searchParams.get('priority');
    const search = url.searchParams.get('search');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const sortBy = url.searchParams.get('sortBy') || 'createdAt';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';

    const where: Record<string, unknown> = {};
    if (projectId) where.projectId = projectId;
    if (moduleId) where.moduleId = moduleId;
    if (status) where.status = status;
    if (testType) where.testType = testType;
    if (priority) where.priority = priority;
    if (search) {
      where.OR = [
        { id: { contains: search } },
        { testCaseId: { contains: search } },
        { page: { contains: search } },
        { subMenu: { contains: search } },
        { testAction: { contains: search } },
        { steps: { contains: search } },
        { remarks: { contains: search } },
      ];
    }

    const total = await db.testCase.count({ where });
    const testCases = await db.testCase.findMany({
      where,
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
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Use stored weight field to calculate numeric weight (no extra DB query needed)
    const enrichedCases = testCases.map(tc => {
      const weightStr = tc.weight || '';
      const calculatedWeight = weightStr ? parseFloat(weightStr.replace('%', '')) : null;
      return {
        ...tc,
        calculatedWeight: calculatedWeight !== null && !isNaN(calculatedWeight) ? Math.round(calculatedWeight * 100) / 100 : null,
      };
    });

    return NextResponse.json({ testCases: enrichedCases, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('GET /api/testcases error:', error);
    return NextResponse.json({ error: 'Failed to fetch test cases' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const status = body.status || 'NOT DONE';
    const progress = getProgressFromStatus(status);

    // Normalize empty strings to null for optional fields
    const subMenu = body.subMenu || null;
    const weight = body.weight || null;
    const actualResult = body.actualResult || null;
    const remarks = body.remarks || null;
    const moduleId = body.moduleId || null;

    const testCase = await db.testCase.create({
      data: {
        testCaseId: body.testCaseId,
        page: body.page,
        subMenu,
        weight,
        testType: body.testType || 'Positive',
        testAction: body.testAction,
        steps: body.steps,
        expectedResult: body.expectedResult,
        actualResult,
        status,
        progress,
        remarks,
        priority: body.priority || 'Medium',
        projectId: body.projectId,
        moduleId,
      },
      include: { project: true, module: true },
    });

    // Recalculate weights for all test cases in the same menu (background, non-blocking)
    recalculateWeights(body.projectId, body.page, subMenu).catch(() => {});

    return NextResponse.json(testCase, { status: 201 });
  } catch (error) {
    console.error('POST /api/testcases error:', error);
    return NextResponse.json({ error: 'Failed to create test case' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    // Get current test case for comparison
    const current = await db.testCase.findUnique({
      where: { id },
      select: { projectId: true, page: true, subMenu: true, status: true, actualResult: true, testCaseId: true, testType: true, testAction: true, steps: true, expectedResult: true, priority: true, moduleId: true },
    });
    if (!current) return NextResponse.json({ error: 'Test case not found' }, { status: 404 });

    // Keep status and actual result in sync for the bug-fix retest flow.
    let finalStatus = data.status ?? current.status;
    let finalActualResult = data.actualResult !== undefined ? data.actualResult : current.actualResult;

    if (finalStatus === 'DONE') {
      finalActualResult = 'As Expected';
    }

    if (finalActualResult === 'Not As Expected') {
      finalStatus = 'FAILED';
    } else if (finalActualResult === 'As Expected' && (current.status === 'FAILED' || finalStatus === 'DONE')) {
      finalStatus = 'DONE';
    }

    // Handle moduleId: convert empty string to null for Prisma
    const finalModuleId = data.moduleId === '' || data.moduleId === null ? null : data.moduleId;
    // Handle subMenu: convert empty string to null
    const finalSubMenu = data.subMenu === '' ? null : data.subMenu;
    // Handle actualResult: convert empty string to null
    const finalActualResultForDb = finalActualResult === '' ? null : finalActualResult;
    const shouldWriteActualResult = data.actualResult !== undefined
      || (finalStatus === 'DONE' && finalActualResultForDb === 'As Expected' && current.actualResult !== 'As Expected');

    // Auto-calculate progress from status
    const progress = getProgressFromStatus(finalStatus || current.status);

    const testCase = await db.testCase.update({
      where: { id },
      data: {
        ...(data.testCaseId !== undefined && { testCaseId: data.testCaseId }),
        ...(data.page !== undefined && { page: data.page }),
        ...(data.subMenu !== undefined && { subMenu: finalSubMenu }),
        ...(data.weight !== undefined && { weight: data.weight }),
        ...(data.testType !== undefined && { testType: data.testType }),
        ...(data.testAction !== undefined && { testAction: data.testAction }),
        ...(data.steps !== undefined && { steps: data.steps }),
        ...(data.expectedResult !== undefined && { expectedResult: data.expectedResult }),
        ...(shouldWriteActualResult && { actualResult: finalActualResultForDb }),
        ...(data.stepLogs !== undefined && { stepLogs: data.stepLogs }),
        ...(finalStatus !== undefined && { status: finalStatus }),
        ...(progress !== undefined && { progress }),
        ...(data.remarks !== undefined && { remarks: data.remarks }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.moduleId !== undefined && { moduleId: finalModuleId }),
      },
      include: { project: true, module: true },
    });

    // If status became FAILED, auto-copy to BugFix table (if not already there)
    if (finalStatus === 'FAILED') {
      const existingBugFix = await db.bugFix.findFirst({
        where: { sourceTestCaseId: id },
      });
      if (!existingBugFix) {
        await db.bugFix.create({
          data: {
            sourceTestCaseId: id,
            testCaseId: current.testCaseId,
            projectId: current.projectId,
            page: current.page,
            subMenu: current.subMenu,
            testType: current.testType,
            testAction: current.testAction,
            steps: current.steps,
            expectedResult: current.expectedResult,
            actualResult: 'Not As Expected',
            priority: current.priority,
            moduleId: current.moduleId,
            status: 'SUDAH DILAPORKAN',
            reportedAt: new Date(),
          },
        });
      }
    } else if (finalStatus === 'DONE' || finalActualResultForDb === 'As Expected') {
      // A bug is only verified after its source test case passes retest.
      await db.bugFix.updateMany({
        where: { 
          sourceTestCaseId: id,
          status: { not: 'VERIFIED & FIXED' }
        },
        data: {
          status: 'VERIFIED & FIXED',
          fixedAt: new Date()
        }
      });
    }

    // Recalculate weights if page/subMenu changed (background, non-blocking)
    const pageChanged = data.page !== undefined && data.page !== current.page;
    const subMenuChanged = finalSubMenu !== current.subMenu;
    if (pageChanged || subMenuChanged) {
      recalculateWeights(current.projectId, current.page, current.subMenu).catch(() => {});
      recalculateWeights(testCase.projectId, testCase.page, testCase.subMenu).catch(() => {});
    }

    return NextResponse.json(testCase);
  } catch (error) {
    console.error('PUT /api/testcases error:', error);
    return NextResponse.json({ error: 'Failed to update test case' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const ids = url.searchParams.get('ids');

    if (ids) {
      const idList = ids.split(',');
      const casesToDelete = await db.testCase.findMany({
        where: { id: { in: idList } },
        select: { id: true, projectId: true, page: true, subMenu: true },
      });
      await db.testCase.deleteMany({ where: { id: { in: idList } } });

      // Recalculate weights for affected menus (background)
      const affectedMenus = new Set<string>();
      for (const tc of casesToDelete) {
        affectedMenus.add(`${tc.projectId}|||${tc.page}|||${tc.subMenu || ''}`);
      }
      for (const key of affectedMenus) {
        const [projId, page, subMenu] = key.split('|||');
        recalculateWeights(projId, page, subMenu === '' ? null : subMenu).catch(() => {});
      }

      return NextResponse.json({ deleted: idList.length });
    }

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    const tc = await db.testCase.findUnique({ where: { id }, select: { projectId: true, page: true, subMenu: true } });
    await db.testCase.delete({ where: { id } });

    if (tc) {
      recalculateWeights(tc.projectId, tc.page, tc.subMenu).catch(() => {});
    }

    return NextResponse.json({ deleted: 1 });
  } catch (error) {
    console.error('DELETE /api/testcases error:', error);
    return NextResponse.json({ error: 'Failed to delete test case' }, { status: 500 });
  }
}

// Helper: Recalculate weight for all test cases in a menu
async function recalculateWeights(projectId: string, page: string, subMenu: string | null) {
  // Only count active (non-TBA) test cases for weight calculation
  const casesInMenu = await db.testCase.findMany({
    where: { projectId, page, subMenu: subMenu || null, status: { not: 'TBA' } },
    select: { id: true },
  });

  if (casesInMenu.length === 0) return;

  const weightPerCase = (100 / casesInMenu.length).toFixed(2) + '%';

  for (const tc of casesInMenu) {
    await db.testCase.update({
      where: { id: tc.id },
      data: { weight: weightPerCase },
    });
  }

  // Set weight to null for TBA test cases in this menu (they don't contribute)
  const tbaCases = await db.testCase.findMany({
    where: { projectId, page, subMenu: subMenu || null, status: 'TBA' },
    select: { id: true },
  });
  for (const tc of tbaCases) {
    await db.testCase.update({
      where: { id: tc.id },
      data: { weight: null },
    });
  }
}
