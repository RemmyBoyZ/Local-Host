import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    const logs = await prisma.executionLog.findMany({
        where: projectId ? { projectId } : {},
        orderBy: { createdAt: "desc" },
        take: 50,
    });

    return NextResponse.json(logs);
}
