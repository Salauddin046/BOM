import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { projectionVersion, projectionMonth } = await request.json();

    if (!projectionVersion || !projectionMonth) {
      return NextResponse.json(
        { error: 'projectionVersion and projectionMonth are required' },
        { status: 400 }
      );
    }

    const sql = neon(process.env.DATABASE_URL!);

    const rows = await sql`
      SELECT * FROM run_mrp_bulk(${projectionVersion}, ${projectionMonth})
    `;

    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error('MRP API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}