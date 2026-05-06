import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  return NextResponse.json({ 
    message: 'Script generation is disabled. Please use the AI Summary feature on the dashboard to analyze test results.' 
  });
}
