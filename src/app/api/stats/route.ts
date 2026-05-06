import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');

    if (!projectId) return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // Fetch all test cases with only needed fields (lighter query)
    const allTestCases = await db.testCase.findMany({
      where: { projectId },
      select: {
        id: true,
        testCaseId: true,
        page: true,
        subMenu: true,
        status: true,
        testType: true,
        priority: true,
        updatedAt: true,
        moduleId: true,
        module: { select: { id: true, name: true } },
      },
    });

    const totalTestCases = allTestCases.length;
    const tbaCount = allTestCases.filter(tc => tc.status === 'TBA').length;
    // Active test cases = excluding TBA (To Be Announced - not yet confirmed for use)
    const activeTestCases = allTestCases.filter(tc => tc.status !== 'TBA');
    const activeCount = activeTestCases.length;
    const doneCount = activeTestCases.filter(tc => tc.status === 'DONE').length;
    const notDoneCount = activeTestCases.filter(tc => tc.status === 'NOT DONE').length;
    const inProgressCount = activeTestCases.filter(tc => tc.status === 'IN PROGRESS').length;
    const blockedCount = activeTestCases.filter(tc => tc.status === 'BLOCKED').length;
    const failedCount = activeTestCases.filter(tc => tc.status === 'FAILED').length;
    const readyToRetestCount = activeTestCases.filter(tc => tc.status === 'READY TO RETEST').length;
    const positiveCount = allTestCases.filter(tc => tc.testType === 'Positive').length;
    const negativeCount = allTestCases.filter(tc => tc.testType === 'Negative').length;
    const criticalCount = allTestCases.filter(tc => tc.priority === 'Critical').length;
    const highCount = allTestCases.filter(tc => tc.priority === 'High').length;
    const mediumCount = allTestCases.filter(tc => tc.priority === 'Medium').length;
    const lowCount = allTestCases.filter(tc => tc.priority === 'Low').length;

    // ============ WEIGHT CALCULATION ============
    // TBA test cases are excluded from weight and progress calculations
    const menuGroups: Record<string, typeof allTestCases> = {};
    for (const tc of activeTestCases) {
      const menuKey = `${tc.page}|||${tc.subMenu || ''}`;
      if (!menuGroups[menuKey]) menuGroups[menuKey] = [];
      menuGroups[menuKey].push(tc);
    }

    const weightMap: Record<string, number> = {};
    for (const [, cases] of Object.entries(menuGroups)) {
      const weightPerCase = 100 / cases.length;
      for (const tc of cases) {
        weightMap[tc.id] = weightPerCase;
      }
    }

    // ============ PROGRESS CALCULATION ============
    const getStatusFactor = (status: string): number => {
      switch (status) {
        case 'DONE': return 1;
        case 'IN PROGRESS': return 0.5;
        case 'READY TO RETEST': return 0.5;
        case 'TBA': return 0; // TBA excluded from progress but handled separately
        case 'BLOCKED': return 0;
        case 'NOT DONE': return 0;
        case 'FAILED': return 0;
        default: return 0;
      }
    };

    const menuProgress: {
      menuKey: string;
      page: string;
      subMenu: string;
      totalCases: number;
      weightPerCase: number;
      totalWeight: number;
      contributedWeight: number;
      progressPercent: number;
      doneCount: number;
      inProgressCount: number;
      notDoneCount: number;
      blockedCount: number;
      failedCount: number;
      readyToRetestCount: number;
      tbaCount: number;
      moduleId: string | null;
      moduleName: string | null;
    }[] = [];

    for (const [menuKey, cases] of Object.entries(menuGroups)) {
      const [page, subMenu] = menuKey.split('|||');
      const weightPerCase = 100 / cases.length;
      let contributedWeight = 0;
      let menuDone = 0;
      let menuInProgress = 0;
      let menuNotDone = 0;
      let menuBlocked = 0;
      let menuFailed = 0;
      let menuReadyRetest = 0;
      let menuTba = 0;

      for (const tc of cases) {
        const factor = getStatusFactor(tc.status);
        contributedWeight += weightPerCase * factor;
        if (tc.status === 'DONE') menuDone++;
        else if (tc.status === 'IN PROGRESS') menuInProgress++;
        else if (tc.status === 'BLOCKED') menuBlocked++;
        else if (tc.status === 'FAILED') menuFailed++;
        else if (tc.status === 'READY TO RETEST') menuReadyRetest++;
        else if (tc.status === 'TBA') menuTba++;
        else menuNotDone++;
      }

      const firstModule = cases.find(c => c.moduleId)?.module;

      menuProgress.push({
        menuKey,
        page,
        subMenu: subMenu || '',
        totalCases: cases.length,
        weightPerCase: Math.round(weightPerCase * 100) / 100,
        totalWeight: 100,
        contributedWeight: Math.round(contributedWeight * 100) / 100,
        progressPercent: Math.round(contributedWeight * 100) / 100,
        doneCount: menuDone,
        inProgressCount: menuInProgress,
        notDoneCount: menuNotDone,
        blockedCount: menuBlocked,
        failedCount: menuFailed,
        readyToRetestCount: menuReadyRetest,
        tbaCount: menuTba,
        moduleId: firstModule?.id || null,
        moduleName: firstModule?.name || null,
      });
    }

    // ============ MODULE PERCENTAGE ============
    const moduleGroups: Record<string, typeof menuProgress> = {};
    const ungroupedMenus: typeof menuProgress = [];

    for (const mp of menuProgress) {
      if (mp.moduleId) {
        if (!moduleGroups[mp.moduleId]) moduleGroups[mp.moduleId] = [];
        moduleGroups[mp.moduleId].push(mp);
      } else {
        ungroupedMenus.push(mp);
      }
    }

    const projectModules = await db.module.findMany({ where: { projectId } });

    const moduleProgress = projectModules.map(mod => {
      const menus = moduleGroups[mod.id] || [];
      const totalMenus = menus.length;
      const avgProgress = totalMenus > 0
        ? menus.reduce((sum, m) => sum + m.progressPercent, 0) / totalMenus
        : 0;
      const totalCases = menus.reduce((sum, m) => sum + m.totalCases, 0);
      const totalDone = menus.reduce((sum, m) => sum + m.doneCount, 0);

      return {
        id: mod.id,
        name: mod.name,
        totalMenus,
        totalCases,
        totalDone,
        avgProgress: Math.round(avgProgress * 100) / 100,
        menus: menus.map(m => ({
          page: m.page,
          subMenu: m.subMenu,
          totalCases: m.totalCases,
          weightPerCase: m.weightPerCase,
          progressPercent: m.progressPercent,
          doneCount: m.doneCount,
          inProgressCount: m.inProgressCount,
          notDoneCount: m.notDoneCount,
          blockedCount: m.blockedCount,
          failedCount: m.failedCount,
          readyToRetestCount: m.readyToRetestCount,
        })),
      };
    });

    const ungroupedProgress = ungroupedMenus.length > 0
      ? {
          id: null,
          name: 'Tanpa Module',
          totalMenus: ungroupedMenus.length,
          totalCases: ungroupedMenus.reduce((sum, m) => sum + m.totalCases, 0),
          totalDone: ungroupedMenus.reduce((sum, m) => sum + m.doneCount, 0),
          avgProgress: Math.round(
            ungroupedMenus.reduce((sum, m) => sum + m.progressPercent, 0) / ungroupedMenus.length * 100
          ) / 100,
          menus: ungroupedMenus.map(m => ({
            page: m.page,
            subMenu: m.subMenu,
            totalCases: m.totalCases,
            weightPerCase: m.weightPerCase,
            progressPercent: m.progressPercent,
            doneCount: m.doneCount,
            inProgressCount: m.inProgressCount,
            notDoneCount: m.notDoneCount,
            blockedCount: m.blockedCount,
            failedCount: m.failedCount,
            readyToRetestCount: m.readyToRetestCount,
          })),
        }
      : null;

    // Module data (backward compat)
    const moduleData = projectModules.map((m) => {
      const cases = allTestCases.filter(tc => tc.moduleId === m.id);
      return {
        name: m.name,
        total: cases.length,
        done: cases.filter(t => t.status === 'DONE').length,
        notDone: cases.filter(t => t.status === 'NOT DONE').length,
        inProgress: cases.filter(t => t.status === 'IN PROGRESS').length,
        blocked: cases.filter(t => t.status === 'BLOCKED').length,
      };
    });

    // Page groups from already loaded data (no extra DB query)
    const pageGroupMap: Record<string, number> = {};
    for (const tc of allTestCases) {
      pageGroupMap[tc.page] = (pageGroupMap[tc.page] || 0) + 1;
    }
    const pageGroups = Object.entries(pageGroupMap).map(([page, count]) => ({ page, _count: { id: count } }));

    // Overall progress uses active (non-TBA) test cases only
    const overallProgress = activeCount > 0 ? Math.round((doneCount / activeCount) * 100) : 0;

    // BugFix stats
    const bugFixItems = await db.bugFix.findMany({
      where: { projectId },
      select: {
        id: true,
        sourceTestCaseId: true,
        testCaseId: true,
        page: true,
        subMenu: true,
        testAction: true,
        priority: true,
        status: true,
        reportedAt: true,
        fixingAt: true,
        readyAt: true,
        fixedAt: true,
        updatedAt: true,
        moduleId: true,
        module: { select: { id: true, name: true } },
      },
    });
    const bugFixReported = bugFixItems.filter(bf => bf.status === 'SUDAH DILAPORKAN').length;
    const bugFixFixing = bugFixItems.filter(bf => bf.status === 'SEDANG DI FIX').length;
    const bugFixReadyRetest = bugFixItems.filter(bf => bf.status === 'READY TO RETEST').length;
    const bugFixFixed = bugFixItems.filter(bf => bf.status === 'VERIFIED & FIXED').length;
    const now = Date.now();
    const getAgeDays = (date: Date | null) => {
      if (!date) return 0;
      return Math.max(0, Math.floor((now - date.getTime()) / (1000 * 60 * 60 * 24)));
    };

    const retestQueue = allTestCases
      .filter(tc => tc.status === 'READY TO RETEST')
      .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())
      .slice(0, 8)
      .map(tc => ({
        id: tc.id,
        testCaseId: tc.testCaseId,
        page: tc.page,
        subMenu: tc.subMenu,
        priority: tc.priority,
        moduleName: tc.module?.name || null,
        updatedAt: tc.updatedAt,
        waitingDays: getAgeDays(tc.updatedAt),
      }));

    const bugAging = bugFixItems
      .filter(bf => bf.status === 'SUDAH DILAPORKAN' || bf.status === 'SEDANG DI FIX')
      .map(bf => ({
        id: bf.id,
        testCaseId: bf.testCaseId,
        page: bf.page,
        subMenu: bf.subMenu,
        testAction: bf.testAction,
        priority: bf.priority,
        status: bf.status,
        moduleName: bf.module?.name || null,
        startedAt: bf.fixingAt || bf.reportedAt || bf.updatedAt,
        ageDays: getAgeDays(bf.fixingAt || bf.reportedAt || bf.updatedAt),
      }))
      .sort((a, b) => b.ageDays - a.ageDays)
      .slice(0, 8);

    const moduleRiskMap = new Map<string, {
      moduleId: string | null;
      moduleName: string;
      total: number;
      failed: number;
      readyToRetest: number;
      inProgress: number;
      blocked: number;
      notDone: number;
      riskScore: number;
    }>();
    const getModuleRisk = (moduleId: string | null, moduleName: string) => {
      const key = moduleId || '__ungrouped__';
      if (!moduleRiskMap.has(key)) {
        moduleRiskMap.set(key, {
          moduleId,
          moduleName,
          total: 0,
          failed: 0,
          readyToRetest: 0,
          inProgress: 0,
          blocked: 0,
          notDone: 0,
          riskScore: 0,
        });
      }
      return moduleRiskMap.get(key)!;
    };

    for (const tc of activeTestCases) {
      const bucket = getModuleRisk(tc.moduleId, tc.module?.name || 'Tanpa Module');
      bucket.total++;
      if (tc.status === 'FAILED') bucket.failed++;
      else if (tc.status === 'READY TO RETEST') bucket.readyToRetest++;
      else if (tc.status === 'IN PROGRESS') bucket.inProgress++;
      else if (tc.status === 'BLOCKED') bucket.blocked++;
      else if (tc.status === 'NOT DONE') bucket.notDone++;
    }

    const moduleRisks = Array.from(moduleRiskMap.values())
      .map(item => ({
        ...item,
        riskScore: item.failed * 5 + item.blocked * 4 + item.readyToRetest * 3 + item.inProgress * 2 + item.notDone,
      }))
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 6);

    return NextResponse.json({
      totalTestCases,
      tbaCount,
      activeCount,
      doneCount,
      notDoneCount,
      inProgressCount,
      blockedCount,
      failedCount,
      readyToRetestCount,
      bugFixTotal: bugFixItems.length,
      bugFixReported,
      bugFixFixing,
      bugFixReadyRetest,
      bugFixFixed,
      positiveCount,
      negativeCount,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      overallProgress,
      moduleData,
      pageGroups,
      weightMap,
      menuProgress,
      moduleProgress,
      ungroupedProgress,
      retestQueue,
      bugAging,
      moduleRisks,
    });
  } catch (error) {
    console.error('GET /api/stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
