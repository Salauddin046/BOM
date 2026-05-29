import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const values: string[] = [];
    let current = '';
    let insideQuote = false;
    for (const char of line) {
      if (char === '"') { insideQuote = !insideQuote; }
      else if (char === ',' && !insideQuote) { values.push(current.trim()); current = ''; }
      else { current += char; }
    }
    values.push(current.trim());
    return Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? '').replace(/^"|"$/g, '')]));
  });
}

// GET - fetch allocation for a run
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const runId = searchParams.get('run_id');

    const sql = neon(process.env.DATABASE_URL!);

    let rows;
    if (runId) {
      rows = await sql`
        SELECT
          sa.allocation_id,
          sa.material_code,
          sa.run_id,
          sa.allocated_qty,
          sa.future_allocated_qty,
          sa.notes,
          sa.created_at,
          ml.net_requirement,
          ml.current_stock,
          ml.gross_requirement,
          ml.uom,
          ml.item_type,
          (ml.current_stock - sa.allocated_qty) AS available_stock,
          GREATEST(ml.net_requirement - (ml.current_stock - sa.allocated_qty - sa.future_allocated_qty), 0) AS revised_net_requirement
        FROM stock_allocation sa
        LEFT JOIN mrp_run_line ml ON ml.run_id = sa.run_id AND ml.material_code = sa.material_code
        WHERE sa.run_id = ${runId}
        ORDER BY sa.material_code
      `;
    } else {
      rows = await sql`
        SELECT sa.*, mr.projection_version, mr.projection_month, mr.revision
        FROM stock_allocation sa
        JOIN mrp_run mr ON mr.run_id = sa.run_id
        ORDER BY sa.created_at DESC
      `;
    }

    return NextResponse.json({ data: rows });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST - upload stock allocation CSV
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const runId = formData.get('run_id') as string | null;

    if (!file || !runId) {
      return NextResponse.json({ error: 'file and run_id are required' }, { status: 400 });
    }

    const text = await file.text();
    const rows = parseCSV(text);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'CSV is empty or malformed' }, { status: 400 });
    }

    const required = ['material_code', 'allocated_qty', 'future_allocated_qty'];
    const headers = Object.keys(rows[0]);
    const missing = required.filter((r) => !headers.includes(r));
    if (missing.length > 0) {
      return NextResponse.json({ error: `Missing columns: ${missing.join(', ')}` }, { status: 400 });
    }

    const sql = neon(process.env.DATABASE_URL!);
    let inserted = 0;

    for (const row of rows) {
      const materialCode = row.material_code?.trim();
      const allocatedQty = parseFloat(row.allocated_qty) || 0;
      const futureAllocatedQty = parseFloat(row.future_allocated_qty) || 0;
      const notes = row.notes?.trim() ?? null;

      if (!materialCode) continue;

      await sql`
        INSERT INTO stock_allocation (material_code, run_id, allocated_qty, future_allocated_qty, notes)
        VALUES (${materialCode}, ${runId}, ${allocatedQty}, ${futureAllocatedQty}, ${notes})
        ON CONFLICT DO NOTHING
      `;
      inserted++;
    }

    return NextResponse.json({ success: true, inserted });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
