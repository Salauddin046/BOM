'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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

interface RunHistory {
  run_id: number;
  projection_version: string;
  projection_month: string;
  revision: string;
  run_at: string;
}

interface DiffRow {
  material_code: string;
  material_description: string;
  uom: string;
  item_type: string;
  level_in_bom: number;
  status: 'ADDED' | 'REMOVED' | 'CHANGED' | 'UNCHANGED';
  gross_requirement: string;
  prev_gross: string | null;
  gross_diff: number;
  current_stock: string;
  net_requirement: string;
  prev_net: string | null;
  net_diff: number;
  lead_time_weeks: string | null;
  vendor_name: string | null;
}

export default function Home() {
  const [projectionVersion, setProjectionVersion] = useState('0');
  const [projectionMonth, setProjectionMonth] = useState('May 2026');
  const [revision, setRevision] = useState('01');
  const [results, setResults] = useState<MrpRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastRunId, setLastRunId] = useState<number | null>(null);

  // History
  const [history, setHistory] = useState<RunHistory[]>([]);

  // Diff
  const [diffRun1, setDiffRun1] = useState('');
  const [diffRun2, setDiffRun2] = useState('');
  const [diffRows, setDiffRows] = useState<DiffRow[]>([]);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState('');
  const [showDiff, setShowDiff] = useState(false);

  // Allocation
  const [allocFile, setAllocFile] = useState<File | null>(null);
  const [allocUploading, setAllocUploading] = useState(false);
  const [allocResult, setAllocResult] = useState('');

  const fetchHistory = async () => {
    const res = await fetch('/api/mrp/history');
    const data = await res.json();
    setHistory(data.data || []);
  };

  useEffect(() => { fetchHistory(); }, []);

  const runMrp = async () => {
    setLoading(true);
    setError('');
    setResults([]);
    try {
      const res = await fetch('/api/mrp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectionVersion, projectionMonth, revision }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to run MRP'); return; }
      setResults(data.data || []);
      setLastRunId(data.runId);
      fetchHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const runDiff = async () => {
    if (!diffRun1 || !diffRun2) return;
    setDiffLoading(true);
    setDiffError('');
    setDiffRows([]);
    try {
      const res = await fetch(`/api/mrp/diff?run1=${diffRun1}&run2=${diffRun2}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDiffRows(data.diff || []);
      setShowDiff(true);
    } catch (e) {
      setDiffError(e instanceof Error ? e.message : 'Diff failed');
    } finally {
      setDiffLoading(false);
    }
  };

  const handleAllocUpload = async () => {
    if (!allocFile || !lastRunId) return;
    setAllocUploading(true);
    setAllocResult('');
    try {
      const form = new FormData();
      form.append('file', allocFile);
      form.append('run_id', String(lastRunId));
      const res = await fetch('/api/stock-allocation', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAllocResult(`✓ ${data.inserted} allocation rows uploaded`);
      setAllocFile(null);
    } catch (e) {
      setAllocResult(`✗ ${e instanceof Error ? e.message : 'Upload failed'}`);
    } finally {
      setAllocUploading(false);
    }
  };

  const downloadCsv = (data: unknown[], filename: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0] as object);
    const csvRows = [
      headers.join(','),
      ...data.map((row) =>
        headers.map((h) => {
          const val = (row as Record<string, unknown>)[h];
          if (val === null || val === undefined) return '';
          const str = String(val);
          return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
        }).join(',')
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusColor = (status: string) => {
    if (status === 'ADDED') return 'bg-green-50 text-green-700';
    if (status === 'REMOVED') return 'bg-red-50 text-red-700';
    if (status === 'CHANGED') return 'bg-yellow-50 text-yellow-700';
    return 'text-gray-400';
  };

  const diffSign = (val: number) => {
    if (val > 0) return <span className="text-red-600">+{val.toFixed(4)}</span>;
    if (val < 0) return <span className="text-green-600">{val.toFixed(4)}</span>;
    return <span className="text-gray-400">—</span>;
  };

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">MRP Tool</h1>
          <Link href="/dashboard/projection" className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors">
            → View Dashboards
          </Link>
        </div>

        {/* Quick nav */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-8">
          {[
            { href: '/dashboard/projection', label: 'Projection', color: 'bg-blue-50 text-blue-700 border-blue-200' },
            { href: '/dashboard/product', label: 'Product', color: 'bg-gray-50 text-gray-700 border-gray-200' },
            { href: '/dashboard/device', label: 'Device', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
            { href: '/dashboard/harness', label: 'Harness', color: 'bg-purple-50 text-purple-700 border-purple-200' },
            { href: '/dashboard/pcba', label: 'PCBA', color: 'bg-orange-50 text-orange-700 border-orange-200' },
            { href: '/dashboard/raw-material', label: 'Raw Material', color: 'bg-teal-50 text-teal-700 border-teal-200' },
          ].map((item) => (
            <Link key={item.href} href={item.href} className={`border rounded-lg px-3 py-2 text-xs font-semibold text-center hover:opacity-80 transition-opacity ${item.color}`}>
              {item.label}
            </Link>
          ))}
        </div>

        {/* Run MRP */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Run MRP</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Projection Version</label>
              <input type="text" value={projectionVersion} onChange={(e) => setProjectionVersion(e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Projection Month</label>
              <input type="text" value={projectionMonth} onChange={(e) => setProjectionMonth(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="e.g. May 2026" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Revision</label>
              <select value={revision} onChange={(e) => setRevision(e.target.value)} className="w-full border rounded px-3 py-2">
                {['01','02','03','04','05'].map((r) => <option key={r} value={r}>Rev {r}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={runMrp} disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400">
                {loading ? 'Running...' : 'Run MRP'}
              </button>
            </div>
          </div>
          {error && <div className="mt-4 p-3 bg-red-100 text-red-800 rounded">{error}</div>}
          {lastRunId && <p className="mt-3 text-xs text-green-600">✓ Run saved (ID: {lastRunId}). You can now upload stock allocation below.</p>}
        </div>

        {/* Stock Allocation Upload */}
        {lastRunId && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-2">Post-MRP Stock Allocation</h2>
            <p className="text-xs text-gray-400 mb-3">
              Required columns: <code className="bg-gray-100 px-1 rounded">material_code, allocated_qty, future_allocated_qty</code> — Optional: <code className="bg-gray-100 px-1 rounded">notes</code>
            </p>
            <div className="flex items-center gap-3">
              <input type="file" accept=".csv" onChange={(e) => setAllocFile(e.target.files?.[0] ?? null)}
                className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200" />
              <button onClick={handleAllocUpload} disabled={!allocFile || allocUploading}
                className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium disabled:opacity-40">
                {allocUploading ? 'Uploading...' : 'Upload Allocation'}
              </button>
            </div>
            {allocResult && <p className={`mt-2 text-sm ${allocResult.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>{allocResult}</p>}
          </div>
        )}

        {/* Revision Comparison */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Compare Revisions</h2>
          {history.length < 2 ? (
            <p className="text-sm text-gray-400">Run MRP at least twice (different revisions) to compare.</p>
          ) : (
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Base (Rev A)</label>
                <select value={diffRun1} onChange={(e) => setDiffRun1(e.target.value)} className="border rounded px-3 py-2 text-sm">
                  <option value="">Select run...</option>
                  {history.map((h) => (
                    <option key={h.run_id} value={h.run_id}>
                      v{h.projection_version} / {h.projection_month} / Rev {h.revision}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Compare (Rev B)</label>
                <select value={diffRun2} onChange={(e) => setDiffRun2(e.target.value)} className="border rounded px-3 py-2 text-sm">
                  <option value="">Select run...</option>
                  {history.map((h) => (
                    <option key={h.run_id} value={h.run_id}>
                      v{h.projection_version} / {h.projection_month} / Rev {h.revision}
                    </option>
                  ))}
                </select>
              </div>
              <button onClick={runDiff} disabled={!diffRun1 || !diffRun2 || diffLoading}
                className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-40 text-sm font-medium">
                {diffLoading ? 'Comparing...' : 'Compare'}
              </button>
              {diffRows.length > 0 && (
                <button onClick={() => downloadCsv(diffRows, 'mrp_diff.csv')}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm font-medium">
                  ↓ Download Diff
                </button>
              )}
            </div>
          )}
          {diffError && <p className="mt-3 text-sm text-red-600">{diffError}</p>}

          {showDiff && diffRows.length > 0 && (
            <div className="mt-6 overflow-x-auto">
              <div className="flex gap-4 mb-3 text-xs">
                <span className="bg-green-100 text-green-700 px-2 py-1 rounded">ADDED: {diffRows.filter(r=>r.status==='ADDED').length}</span>
                <span className="bg-red-100 text-red-700 px-2 py-1 rounded">REMOVED: {diffRows.filter(r=>r.status==='REMOVED').length}</span>
                <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded">CHANGED: {diffRows.filter(r=>r.status==='CHANGED').length}</span>
                <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded">UNCHANGED: {diffRows.filter(r=>r.status==='UNCHANGED').length}</span>
              </div>
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Material Code</th>
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-right">Gross (B)</th>
                    <th className="px-3 py-2 text-right">Gross Δ</th>
                    <th className="px-3 py-2 text-right">Net (B)</th>
                    <th className="px-3 py-2 text-right">Net Δ</th>
                    <th className="px-3 py-2 text-left">Vendor</th>
                  </tr>
                </thead>
                <tbody>
                  {diffRows.filter(r => r.status !== 'UNCHANGED').map((row, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-3 py-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${statusColor(row.status)}`}>{row.status}</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{row.material_code}</td>
                      <td className="px-3 py-2">{row.material_description}</td>
                      <td className="px-3 py-2">{row.item_type}</td>
                      <td className="px-3 py-2 text-right">{row.gross_requirement}</td>
                      <td className="px-3 py-2 text-right">{diffSign(row.gross_diff)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{row.net_requirement}</td>
                      <td className="px-3 py-2 text-right">{diffSign(row.net_diff)}</td>
                      <td className="px-3 py-2 text-xs">{row.vendor_name ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* MRP Results */}
        {results.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Results ({results.length} items)</h2>
              <button onClick={() => downloadCsv(results, `mrp_${projectionVersion}_${revision}_${projectionMonth.replace(/ /g, '_')}.csv`)}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
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
                    <tr key={idx} className={row.item_type === 'MAKE' ? 'bg-yellow-50' : ''}>
                      <td className="px-3 py-2 font-mono text-xs">{row.material_code}</td>
                      <td className="px-3 py-2">{row.material_description}</td>
                      <td className="px-3 py-2">{row.uom}</td>
                      <td className="px-3 py-2">
                        <span className={row.item_type === 'MAKE' ? 'text-orange-700 font-semibold' : 'text-blue-700'}>{row.item_type}</span>
                      </td>
                      <td className="px-3 py-2 text-right">{row.level_in_bom}</td>
                      <td className="px-3 py-2 text-right">{row.gross_requirement}</td>
                      <td className="px-3 py-2 text-right">{row.current_stock}</td>
                      <td className="px-3 py-2 text-right font-semibold">{row.net_requirement}</td>
                      <td className="px-3 py-2 text-right">{row.lead_time_weeks ?? ''}</td>
                      <td className="px-3 py-2 text-xs">{row.vendor_name ?? ''}</td>
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
