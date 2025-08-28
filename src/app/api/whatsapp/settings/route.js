import { NextResponse } from 'next/server';

// GET - WhatsApp settings endpoint removed
export async function GET() {
  return NextResponse.json({ error: 'WhatsApp API removed' }, { status: 410 });
}

// PUT - WhatsApp settings endpoint removed
export async function PUT() {
  return NextResponse.json({ error: 'WhatsApp API removed' }, { status: 410 });
}

// POST - WhatsApp test endpoint removed
export async function POST() {
  return NextResponse.json({ error: 'WhatsApp API removed' }, { status: 410 });
}