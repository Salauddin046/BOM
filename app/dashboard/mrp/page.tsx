'use client';

import { useState, useEffect } from 'react';

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
  material_type: string;
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

const TABS = [
  { key: 'PRODUCT', label: 'Product', color: 'text-gray-700' },
  { key: 'DEVICE', label: 'Device', color: 'text-blue-700' },
  { key: 'HARNESS', label: 'Harness', color: 'text-purple-700' },
  { key: 'PCBA', label: 'PCBA', color: 'text-orange-700' },
  { key: 'RAW_MATERIAL', label: 'Raw Material', color: 'text-teal-700' },
];

export default function MrpDashboard() {
  const [projectionVersion, setProjectionVersion] = useState('0');
  const [projectionMonth, setProjectionMonth] = useState('May 2026');
  const [revision, setRevision] = useState('01');
  const [results, setResults] = useState<MrpRow[]>([]);
  const [activeTab, setActiveTab] = useState('PRODUCT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastRunId, setLastRunId] = useState<number | null>(null);

  const [history, setHistory] = useState<RunHistory[]>([]);
  const [diffRun1, setDiffRun1] = useState('');
  const [diffRun2, setDiffRun2] = useState('');
  const [diffRows, setDiffRows] = useState<DiffRow[]>([]);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState('');
  const [showDiff, setShowDiff] = useState(false);

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
      setActiveTab('PRODUCT');
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
    if (status === 'ADDED') return 'bg-green-100 text-green-700';
    if (status === 'REMOVED') return 'bg-red-100 text-red-700';
    if (status === 'CHANGED') return 'bg-yellow-100 text-yellow-700';
    return 'text-gray-400';
  };

  const diffSign = (val: number) => {
    if (val > 0) return <span className="text-red-600">+{val.toFixed(4)}</span>;
    if (val < 0) return <span className="text-green-600">{val.toFixed(4)}</span>;
    return <span className="text-gray-400">—</span>;
  };

  const tabResults = results.filter(r => r.material_type === activeTab);
  const tabCount = (key: string) => results.filter(r => r.material_type === key).length;

  const ResultsTable = ({ rows }: { rows: MrpRow[] }) => (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {['Material Code', 'Description', 'UOM', 'Type', 'Level', 'Gross', 'Stock', 'Net', 'Lead Time (wks)', 'Vendor'].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.length === 0 ? (
            <tr><td colSpan={10} className="px-3 py-8 text-center text-gray-400 text-sm">No items in this category</td></tr>
          ) : rows.map((row, idx) => (
            <tr key={idx} className={row.item_type === 'MAKE' ? 'bg-yellow-50' : 'hover:bg-gray-50'}>
              <td className="px-3 py-2 font-mono text-xs">{row.material_code}</td>
              <td className="px-3 py-2 text-gray-700">{row.material_description}</td>
              <td className="px-3 py-2 text-gray-500">{row.uom}</td>
              <td className="px-3 py-2">
                <span className={row.item_type === 'MAKE' ? 'text-orange-700 font-semibold' : 'text-blue-700'}>{row.item_type}</span>
              </td>
              <td className="px-3 py-2 text-right">{row.level_in_bom}</td>
              <td className="px-3 py-2 text-right">{row.gross_requirement}</td>
              <td className="px-3 py-2 text-right">{row.current_stock}</td>
              <td className="px-3 py-2 text-right font-semibold">{row.net_requirement}</td>
              <td className="px-3 py-2 text-right">{row.lead_time_weeks ?? ''}</td>
              <td className="px-3 py-2 text-xs text-gray-500">{row.vendor_name ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Run MRP</h2>
        <p className="text-sm text-gray-500 mt-1">Run, save, and compare MRP revisions</p>
      </div>

      {/* Run MRP */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h3 className="text-base font-semibold text-gray-700 mb-4">MRP Parameters</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Projection Version</label>
            <input type="text" value={projectionVersion} onChange={(e) => setProjectionVersion(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Projection Month</label>
            <input type="text" value={projectionMonth} onChange={(e) => setProjectionMonth(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. May 2026" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Revision</label>
            <select value={revision} onChange={(e) => setRevision(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {['01','02','03','04','05'].map((r) => <option key={r} value={r}>Rev {r}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={runMrp} disabled={loading}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 text-sm font-medium transition-colors">
              {loading ? 'Running...' : 'Run MRP'}
            </button>
          </div>
        </div>
        {error && <div className="mt-4 p-3 bg-red-100 text-red-800 rounded-lg text-sm">{error}</div>}
        {lastRunId && <p className="mt-3 text-xs text-green-600">✓ Run saved (ID: {lastRunId}). Upload stock allocation below.</p>}
      </div>

      {/* Stock Allocation Upload */}
      {lastRunId && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="text-base font-semibold text-gray-700 mb-2">Post-MRP Stock Allocation</h3>
          <p className="text-xs text-gray-400 mb-3">
            Required columns: <code className="bg-gray-100 px-1 rounded">material_code, allocated_qty, future_allocated_qty</code>
            {' '}— Optional: <code className="bg-gray-100 px-1 rounded">notes</code>
          </p>
          <div className="flex items-center gap-3">
            <input type="file" accept=".csv" onChange={(e) => setAllocFile(e.target.files?.[0] ?? null)}
              className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200" />
            <button onClick={handleAllocUpload} disabled={!allocFile || allocUploading}
              className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40 transition-colors">
              {allocUploading ? 'Uploading...' : 'Upload Allocation'}
            </button>
          </div>
          {allocResult && <p className={`mt-2 text-sm ${allocResult.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>{allocResult}</p>}
        </div>
      )}

      {/* MRP Results with Tabs */}
      {results.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 mb-6">
          {/* Tab header */}
          <div className="flex items-center justify-between px-6 pt-4 pb-0 border-b border-gray-200">
            <div className="flex gap-1">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors relative ${
                    activeTab === tab.key
                      ? 'bg-white border border-b-white border-gray-200 -mb-px text-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                  {tabCount(tab.key) > 0 && (
                    <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                      {tabCount(tab.key)}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={() => downloadCsv(tabResults, `mrp_${activeTab.toLowerCase()}_${projectionVersion}_rev${revision}.csv`)}
              disabled={tabResults.length === 0}
              className="mb-2 bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 text-xs font-medium disabled:opacity-40 transition-colors">
              ↓ Download CSV
            </button>
          </div>
          {/* Tab content */}
          <div className="p-0">
            <ResultsTable rows={tabResults} />
          </div>
        </div>
      )}

      {/* Compare Revisions */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-700 mb-4">Compare Revisions</h3>
        {history.length < 2 ? (
          <p className="text-sm text-gray-400">Run MRP at least twice with different revisions to compare.</p>
        ) : (
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Base (Rev A)</label>
              <select value={diffRun1} onChange={(e) => setDiffRun1(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
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
              <select value={diffRun2} onChange={(e) => setDiffRun2(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select run...</option>
                {history.map((h) => (
                  <option key={h.run_id} value={h.run_id}>
                    v{h.projection_version} / {h.projection_month} / Rev {h.revision}
                  </option>
                ))}
              </select>
            </div>
            <button onClick={runDiff} disabled={!diffRun1 || !diffRun2 || diffLoading}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-40 text-sm font-medium transition-colors">
              {diffLoading ? 'Comparing...' : 'Compare'}
            </button>
            {diffRows.length > 0 && (
              <button onClick={() => downloadCsv(diffRows, 'mrp_diff.csv')}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium transition-colors">
                ↓ Download Diff
              </button>
            )}
          </div>
        )}
        {diffError && <p className="mt-3 text-sm text-red-600">{diffError}</p>}
        {showDiff && diffRows.length > 0 && (
          <div className="mt-6">
            <div className="flex gap-3 mb-4 flex-wrap">
              {[
                { status: 'ADDED', color: 'bg-green-100 text-green-700' },
                { status: 'REMOVED', color: 'bg-red-100 text-red-700' },
                { status: 'CHANGED', color: 'bg-yellow-100 text-yellow-700' },
                { status: 'UNCHANGED', color: 'bg-gray-100 text-gray-600' },
              ].map(({ status, color }) => (
                <span key={status} className={`text-xs font-medium px-2 py-1 rounded ${color}`}>
                  {status}: {diffRows.filter(r => r.status === status).length}
                </span>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Status', 'Material Code', 'Description', 'Type', 'Gross (B)', 'Gross Δ', 'Net (B)', 'Net Δ', 'Vendor'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {diffRows.filter(r => r.status !== 'UNCHANGED').map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${statusColor(row.status)}`}>{row.status}</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{row.material_code}</td>
                      <td className="px-3 py-2 text-gray-700">{row.material_description}</td>
                      <td className="px-3 py-2">{row.item_type}</td>
                      <td className="px-3 py-2 text-right">{row.gross_requirement}</td>
                      <td className="px-3 py-2 text-right">{diffSign(row.gross_diff)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{row.net_requirement}</td>
                      <td className="px-3 py-2 text-right">{diffSign(row.net_diff)}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{row.vendor_name ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
