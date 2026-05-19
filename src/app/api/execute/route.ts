import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // sesuaikan path prisma client lo

export async function POST(req: NextRequest) {
    const { method, url, headers: reqHeaders, body, projectId } = await req.json();

    if (!url) {
        return NextResponse.json({ error: "URL wajib diisi" }, { status: 400 });
    }

    const start = Date.now();

    try {
        const fetchOptions: RequestInit = {
            method: method || "GET",
            headers: reqHeaders ? JSON.parse(reqHeaders) : {},
        };

        if (body && method !== "GET") {
            fetchOptions.body = body;
        }

        const response = await fetch(url, fetchOptions);
        const duration = Date.now() - start;
        const responseText = await response.text();

        // Simpan ke DB
        await prisma.executionLog.create({
            data: {
                method: method || "GET",
                url,
                headers: reqHeaders || null,
                body: body || null,
                statusCode: response.status,
                response: responseText.slice(0, 10000), // limit 10KB
                duration,
                projectId: projectId || null,
            },
        });

        return NextResponse.json({
            statusCode: response.status,
            statusText: response.statusText,
            response: responseText,
            duration,
        });

    } catch (err: unknown) {
        const duration = Date.now() - start;
        const message = err instanceof Error ? err.message : "Unknown error";

        await prisma.executionLog.create({
            data: {
                method: method || "GET",
                url,
                headers: reqHeaders || null,
                body: body || null,
                statusCode: 0,
                response: `ERROR: ${message}`,
                duration,
                projectId: projectId || null,
            },
        });

        return NextResponse.json({ error: message, duration }, { status: 500 });
    }
}