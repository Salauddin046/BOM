import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { projectionVersion, projectionMonth, revision } = await request.json();

    if (!projectionVersion || !projectionMonth) {
      return NextResponse.json(
        { error: 'projectionVersion and projectionMonth are required' },
        { status: 400 }
      );
    }

    const rev = revision || '01';
    const sql = neon(process.env.DATABASE_URL!);

    // Run MRP
    const rows = await sql`
      SELECT * FROM run_mrp_bulk(${projectionVersion}, ${projectionMonth})
    `;

    if (rows.length === 0) {
      return NextResponse.json({ data: [], runId: null });
    }

    // Save run header (upsert)
    const runResult = await sql`
      INSERT INTO mrp_run (projection_version, projection_month, revision)
      VALUES (${projectionVersion}, ${projectionMonth}, ${rev})
      ON CONFLICT (projection_version, projection_month, revision)
      DO UPDATE SET run_at = NOW()
      RETURNING run_id
    `;
    const runId = runResult[0].run_id;

    // Delete old lines for this run
    await sql`DELETE FROM mrp_run_line WHERE run_id = ${runId}`;

    // Insert new lines
    for (const row of rows) {
      await sql`
        INSERT INTO mrp_run_line (
          run_id, material_code, material_description, uom, item_type,
          level_in_bom, gross_requirement, current_stock, net_requirement,
          lead_time_weeks, vendor_name
        ) VALUES (
          ${runId},
          ${row.material_code},
          ${row.material_description},
          ${row.uom},
          ${row.item_type},
          ${row.level_in_bom},
          ${row.gross_requirement},
          ${row.current_stock},
          ${row.net_requirement},
          ${row.lead_time_weeks ?? null},
          ${row.vendor_name ?? null}
        )
      `;
    }

    return NextResponse.json({ data: rows, runId });
  } catch (error) {
    console.error('MRP API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
