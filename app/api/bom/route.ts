import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type')?.toUpperCase();

    const validTypes = ['DEVICE', 'HARNESS', 'PCBA', 'RAW_MATERIAL'];

    const sql = neon(process.env.DATABASE_URL!);

    let rows;
    if (type && validTypes.includes(type)) {
      rows = await sql`
        SELECT
          bl.line_id,
          bh.bom_name,
          bh.bom_description,
          bh.version,
          bl.material_code,
          bl.material_description,
          bl.qty,
          bl.uom,
          bl.material_type,
          bl.variant
        FROM bom_line bl
        JOIN bom_header bh ON bh.bom_id = bl.bom_id
        WHERE bl.material_type = ${type}
        ORDER BY bh.bom_name, bl.material_code
      `;
    } else {
      rows = await sql`
        SELECT
          bl.line_id,
          bh.bom_name,
          bh.bom_description,
          bh.version,
          bl.material_code,
          bl.material_description,
          bl.qty,
          bl.uom,
          bl.material_type,
          bl.variant
        FROM bom_line bl
        JOIN bom_header bh ON bh.bom_id = bl.bom_id
        ORDER BY bl.material_type, bh.bom_name, bl.material_code
      `;
    }

    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error('BOM GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
