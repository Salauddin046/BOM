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
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? '').replace(/^"|"$/g, '')]));
  });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const text = await file.text();
    const rows = parseCSV(text);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'CSV is empty or malformed' }, { status: 400 });
    }

    // Validate required columns
    const required = ['bom_name', 'version', 'material_code', 'material_description', 'qty', 'uom', 'material_type'];
    const headers = Object.keys(rows[0]);
    const missing = required.filter((r) => !headers.includes(r));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing columns: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    const validTypes = ['DEVICE', 'HARNESS', 'PCBA', 'RAW_MATERIAL'];
    const invalidTypes = rows.filter((r) => !validTypes.includes(r.material_type?.toUpperCase()));
    if (invalidTypes.length > 0) {
      return NextResponse.json(
        {
          error: `Invalid material_type values found. Allowed: ${validTypes.join(', ')}. Problem rows: ${invalidTypes.slice(0, 3).map((r) => r.material_code).join(', ')}`,
        },
        { status: 400 }
      );
    }

    const sql = neon(process.env.DATABASE_URL!);

    let inserted = 0;
    let skipped = 0;

    for (const row of rows) {
      const bomName = row.bom_name?.trim();
      const version = row.version?.trim();
      const materialCode = row.material_code?.trim();
      const materialDesc = row.material_description?.trim();
      const qty = parseFloat(row.qty);
      const uom = row.uom?.trim();
      const materialType = row.material_type?.trim().toUpperCase();
      const bomDesc = row.bom_description?.trim() ?? '';
      const variant = row.variant?.trim() ?? null;

      if (!bomName || !version || !materialCode || isNaN(qty)) {
        skipped++;
        continue;
      }

      // Upsert bom_header
      const headerResult = await sql`
        INSERT INTO bom_header (bom_name, bom_description, version)
        VALUES (${bomName}, ${bomDesc}, ${version})
        ON CONFLICT (bom_name, version) DO UPDATE SET bom_description = EXCLUDED.bom_description
        RETURNING bom_id
      `;
      const bomId = headerResult[0].bom_id;

      // Insert bom_line
      await sql`
        INSERT INTO bom_line (bom_id, material_code, material_description, qty, uom, material_type, variant)
        VALUES (${bomId}, ${materialCode}, ${materialDesc}, ${qty}, ${uom}, ${materialType}, ${variant})
      `;

      inserted++;
    }

    return NextResponse.json({
      success: true,
      inserted,
      skipped,
      total: rows.length,
    });
  } catch (error) {
    console.error('BOM upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
