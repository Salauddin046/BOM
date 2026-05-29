import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const runId1 = searchParams.get('run1');
    const runId2 = searchParams.get('run2');

    if (!runId1 || !runId2) {
      return NextResponse.json({ error: 'run1 and run2 are required' }, { status: 400 });
    }

    const sql = neon(process.env.DATABASE_URL!);

    const [lines1, lines2, run1Info, run2Info] = await Promise.all([
      sql`SELECT * FROM mrp_run_line WHERE run_id = ${runId1} ORDER BY level_in_bom, material_code`,
      sql`SELECT * FROM mrp_run_line WHERE run_id = ${runId2} ORDER BY level_in_bom, material_code`,
      sql`SELECT * FROM mrp_run WHERE run_id = ${runId1}`,
      sql`SELECT * FROM mrp_run WHERE run_id = ${runId2}`,
    ]);

    // Build maps keyed by material_code
    const map1 = new Map(lines1.map((r) => [r.material_code, r]));
    const map2 = new Map(lines2.map((r) => [r.material_code, r]));

    const allCodes = new Set([...map1.keys(), ...map2.keys()]);

    const diff = Array.from(allCodes).map((code) => {
      const r1 = map1.get(code);
      const r2 = map2.get(code);

      if (!r1) return { material_code: code, status: 'ADDED', ...r2, prev_net: null, prev_gross: null };
      if (!r2) return { material_code: code, status: 'REMOVED', ...r1, prev_net: null, prev_gross: null };

      const netDiff = Number(r2.net_requirement) - Number(r1.net_requirement);
      const grossDiff = Number(r2.gross_requirement) - Number(r1.gross_requirement);
      const status = netDiff === 0 && grossDiff === 0 ? 'UNCHANGED' : 'CHANGED';

      return {
        material_code: code,
        material_description: r2.material_description,
        uom: r2.uom,
        item_type: r2.item_type,
        level_in_bom: r2.level_in_bom,
        status,
        gross_requirement: r2.gross_requirement,
        prev_gross: r1.gross_requirement,
        gross_diff: grossDiff,
        current_stock: r2.current_stock,
        net_requirement: r2.net_requirement,
        prev_net: r1.net_requirement,
        net_diff: netDiff,
        lead_time_weeks: r2.lead_time_weeks,
        vendor_name: r2.vendor_name,
      };
    }).sort((a, b) => {
      const order = { ADDED: 0, REMOVED: 1, CHANGED: 2, UNCHANGED: 3 };
      return (order[a.status as keyof typeof order] ?? 3) - (order[b.status as keyof typeof order] ?? 3);
    });

    return NextResponse.json({
      diff,
      run1: run1Info[0],
      run2: run2Info[0],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
