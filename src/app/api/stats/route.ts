import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');

    if (!projectId) return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });

    // Fetch all test cases with only needed fields (lighter query)
    const allTestCases = await db.testCase.findMany({
      where: { projectId },
      select: {
        id: true,
        page: true,
        subMenu: true,
        status: true,
        testType: true,
        priority: true,
        moduleId: true,
        module: { select: { id: true, name: true } },
      },
    });

    const totalTestCases = allTestCases.length;
    const tbhCount = allTestCases.filter(tc => tc.status === 'TBH').length;
    // Active test cases = excluding TBH (To Be Honed - not yet confirmed for use)
    const activeTestCases = allTestCases.filter(tc => tc.status !== 'TBH');
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
    // TBH test cases are excluded from weight and progress calculations
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
        case 'TBH': return 0; // TBH excluded from progress but handled separately
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
      tbhCount: number;
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
      let menuTbh = 0;

      for (const tc of cases) {
        const factor = getStatusFactor(tc.status);
        contributedWeight += weightPerCase * factor;
        if (tc.status === 'DONE') menuDone++;
        else if (tc.status === 'IN PROGRESS') menuInProgress++;
        else if (tc.status === 'BLOCKED') menuBlocked++;
        else if (tc.status === 'FAILED') menuFailed++;
        else if (tc.status === 'READY TO RETEST') menuReadyRetest++;
        else if (tc.status === 'TBH') menuTbh++;
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
        tbhCount: menuTbh,
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
          id: null as const,
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

    // Overall progress uses active (non-TBH) test cases only
    const overallProgress = activeCount > 0 ? Math.round((doneCount / activeCount) * 100) : 0;

    // BugFix stats
    const bugFixItems = await db.bugFix.findMany({
      where: { projectId },
      select: { id: true, status: true },
    });
    const bugFixReported = bugFixItems.filter(bf => bf.status === 'SUDAH DILAPORKAN').length;
    const bugFixFixing = bugFixItems.filter(bf => bf.status === 'SEDANG DI FIX').length;
    const bugFixReadyRetest = bugFixItems.filter(bf => bf.status === 'READY TO RETEST').length;

    return NextResponse.json({
      totalTestCases,
      tbhCount,
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
    });
  } catch (error) {
    console.error('GET /api/stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
