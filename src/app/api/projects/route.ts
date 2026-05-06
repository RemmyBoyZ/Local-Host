import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const cleanText = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const nullableText = (value: unknown) => {
  const text = cleanText(value);
  return text ? text : null;
};

export async function GET() {
  try {
    const projects = await db.project.findMany({
      include: {
        _count: { select: { testCases: true, modules: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(projects);
  } catch (error) {
    console.error('GET /api/projects error:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = cleanText(body.name);
    if (!name) return NextResponse.json({ error: 'Nama project wajib diisi' }, { status: 400 });

    const project = await db.project.create({
      data: {
        name,
        description: nullableText(body.description),
      },
    });
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects error:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    if (data.name !== undefined && !cleanText(data.name)) {
      return NextResponse.json({ error: 'Nama project wajib diisi' }, { status: 400 });
    }
    const existing = await db.project.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const project = await db.project.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: cleanText(data.name) }),
        ...(data.description !== undefined && { description: nullableText(data.description) }),
        ...(data.automationContext !== undefined && { automationContext: nullableText(data.automationContext) }),
      },
    });
    return NextResponse.json(project);
  } catch (error) {
    console.error('PUT /api/projects error:', error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    const existing = await db.project.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    await db.project.delete({ where: { id } });
    return NextResponse.json({ deleted: 1 });
  } catch (error) {
    console.error('DELETE /api/projects error:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
