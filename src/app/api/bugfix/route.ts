import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const sortBy = url.searchParams.get('sortBy') || 'createdAt';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';

    const where: Record<string, unknown> = {};
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { testCaseId: { contains: search } },
        { page: { contains: search } },
        { subMenu: { contains: search } },
        { testAction: { contains: search } },
      ];
    }

    const total = await db.bugFix.count({ where });
    const bugFixItems = await db.bugFix.findMany({
      where,
      include: { module: true },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });

    return NextResponse.json({ bugFixItems, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('GET /api/bugfix error:', error);
    return NextResponse.json({ error: 'Failed to fetch bug fix items' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    // Get current bug fix item
    const current = await db.bugFix.findUnique({ where: { id } });
    if (!current) return NextResponse.json({ error: 'Bug fix item not found' }, { status: 404 });

    // Update timestamps based on status change
    const updateData: Record<string, unknown> = {};
    if (data.status !== undefined) {
      updateData.status = data.status;
      const now = new Date();

      if (data.status === 'SUDAH DILAPORKAN' && !current.reportedAt) {
        updateData.reportedAt = now;
      }
      if (data.status === 'SEDANG DI FIX') {
        updateData.fixingAt = now;
      }
      if (data.status === 'READY TO RETEST') {
        updateData.readyAt = now;
        // Sync: update the original test case status to READY TO RETEST
        await db.testCase.update({
          where: { id: current.sourceTestCaseId },
          data: { status: 'READY TO RETEST', progress: 50 },
        });
      }
    }

    const bugFixItem = await db.bugFix.update({
      where: { id },
      data: updateData,
      include: { module: true },
    });

    return NextResponse.json(bugFixItem);
  } catch (error) {
    console.error('PUT /api/bugfix error:', error);
    return NextResponse.json({ error: 'Failed to update bug fix item' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const ids = url.searchParams.get('ids');

    if (ids) {
      const idList = ids.split(',');
      await db.bugFix.deleteMany({ where: { id: { in: idList } } });
      return NextResponse.json({ deleted: idList.length });
    }

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    await db.bugFix.delete({ where: { id } });
    return NextResponse.json({ deleted: 1 });
  } catch (error) {
    console.error('DELETE /api/bugfix error:', error);
    return NextResponse.json({ error: 'Failed to delete bug fix item' }, { status: 500 });
  }
}
