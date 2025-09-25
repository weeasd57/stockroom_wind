import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ error: 'Debug endpoint is disabled' }, { status: 410 });
}
