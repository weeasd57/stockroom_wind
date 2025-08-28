import { NextResponse } from 'next/server';

// GET - WhatsApp stats endpoint removed
export async function GET() {
  return NextResponse.json({ error: 'WhatsApp API removed' }, { status: 410 });
}