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

// GET - fetch all projection rows or download as CSV
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const download = searchParams.get('download') === 'true';

    const sql = neon(process.env.DATABASE_URL!);

    const rows = await sql`
      SELECT
        p.projection_id,
        p.product_id,
        pm.product_name,
        p.projection_version,
        p.qty
      FROM projection p
      LEFT JOIN product_master pm ON pm.product_id = p.product_id
      ORDER BY p.projection_version, p.product_id
    `;

    if (download) {
      const headers = ['projection_id', 'product_id', 'product_name', 'projection_version', 'qty'];
      const csvRows = [
        headers.join(','),
        ...rows.map((row) =>
          headers.map((h) => {
            const val = (row as unknown as Record<string, unknown>)[h];
            if (val === null || val === undefined) return '';
            const str = String(val);
            return str.includes(',') || str.includes('"')
              ? `"${str.replace(/"/g, '""')}"` : str;
          }).join(',')
        ),
      ];
      return new NextResponse(csvRows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="projection.csv"',
        },
      });
    }

    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error('Projection GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST - upload projection CSV
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

    const required = ['product_id', 'projection_version', 'qty'];
    const headers = Object.keys(rows[0]);
    const missing = required.filter((r) => !headers.includes(r));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing columns: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    const sql = neon(process.env.DATABASE_URL!);
    let inserted = 0;
    let skipped = 0;

    for (const row of rows) {
      const productId = row.product_id?.trim();
      const projectionVersion = row.projection_version?.trim();
      const qty = parseFloat(row.qty);

      if (!productId || !projectionVersion || isNaN(qty)) {
        skipped++;
        continue;
      }

      await sql`
        INSERT INTO projection (product_id, projection_version, qty)
        VALUES (${productId}, ${projectionVersion}, ${qty})
        ON CONFLICT DO NOTHING
      `;
      inserted++;
    }

    return NextResponse.json({ success: true, inserted, skipped, total: rows.length });
  } catch (error) {
    console.error('Projection POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
