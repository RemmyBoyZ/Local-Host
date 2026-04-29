import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');
    const where: Record<string, unknown> = {};
    if (projectId) where.projectId = projectId;

    const modules = await db.module.findMany({
      where,
      include: {
        _count: { select: { testCases: true } },
      },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(modules);
  } catch (error) {
    console.error('GET /api/modules error:', error);
    return NextResponse.json({ error: 'Failed to fetch modules' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const newModule = await db.module.create({
      data: {
        name: body.name,
        projectId: body.projectId,
      },
    });
    return NextResponse.json(newModule, { status: 201 });
  } catch (error) {
    console.error('POST /api/modules error:', error);
    return NextResponse.json({ error: 'Failed to create module' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    await db.module.delete({ where: { id } });
    return NextResponse.json({ deleted: 1 });
  } catch (error) {
    console.error('DELETE /api/modules error:', error);
    return NextResponse.json({ error: 'Failed to delete module' }, { status: 500 });
  }
}
