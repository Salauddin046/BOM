'use client';

import { useState } from 'react';

interface MrpRow {
  material_code: string;
  material_description: string;
  uom: string;
  item_type: string;
  level_in_bom: number;
  gross_requirement: string;
  current_stock: string;
  net_requirement: string;
  lead_time_weeks: string | null;
  vendor_name: string | null;
}

export default function Home() {
  const [projectionVersion, setProjectionVersion] = useState('0');
  const [projectionMonth, setProjectionMonth] = useState('May 2026');
  const [results, setResults] = useState<MrpRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runMrp = async () => {
    setLoading(true);
    setError('');
    setResults([]);

    try {
      const res = await fetch('/api/mrp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectionVersion, projectionMonth }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to run MRP');
        return;
      }

      setResults(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const downloadCsv = () => {
    if (results.length === 0) return;

    const headers = Object.keys(results[0]);
    const csvRows = [
      headers.join(','),
      ...results.map((row) =>
        headers
          .map((h) => {
            const val = (row as any)[h];
            if (val === null || val === undefined) return '';
            const str = String(val);
            return str.includes(',') || str.includes('"')
              ? `"${str.replace(/"/g, '""')}"`
              : str;
          })
          .join(',')
      ),
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mrp_${projectionVersion}_${projectionMonth.replace(/ /g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">MRP Tool</h1>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Run MRP</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Projection Version
              </label>
              <input
                type="text"
                value={projectionVersion}
                onChange={(e) => setProjectionVersion(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Projection Month
              </label>
              <input
                type="text"
                value={projectionMonth}
                onChange={(e) => setProjectionMonth(e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="e.g. May 2026"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={runMrp}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
              >
                {loading ? 'Running...' : 'Run MRP'}
              </button>
            </div>
          </div>
          {error && (
            <div className="mt-4 p-3 bg-red-100 text-red-800 rounded">
              {error}
            </div>
          )}
        </div>

        {results.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                Results ({results.length} items)
              </h2>
              <button
                onClick={downloadCsv}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Download CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left">Material Code</th>
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-left">UOM</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-right">Level</th>
                    <th className="px-3 py-2 text-right">Gross</th>
                    <th className="px-3 py-2 text-right">Stock</th>
                    <th className="px-3 py-2 text-right">Net</th>
                    <th className="px-3 py-2 text-right">Lead Time (wks)</th>
                    <th className="px-3 py-2 text-left">Vendor</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((row, idx) => (
                    <tr
                      key={idx}
                      className={
                        row.item_type === 'MAKE' ? 'bg-yellow-50' : ''
                      }
                    >
                      <td className="px-3 py-2 font-mono text-xs">
                        {row.material_code}
                      </td>
                      <td className="px-3 py-2">{row.material_description}</td>
                      <td className="px-3 py-2">{row.uom}</td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            row.item_type === 'MAKE'
                              ? 'text-orange-700 font-semibold'
                              : 'text-blue-700'
                          }
                        >
                          {row.item_type}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row.level_in_bom}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row.gross_requirement}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row.current_stock}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {row.net_requirement}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row.lead_time_weeks ?? ''}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {row.vendor_name ?? ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}