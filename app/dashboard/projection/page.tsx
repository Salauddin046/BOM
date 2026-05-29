'use client';

import { useEffect, useState } from 'react';

interface ProjectionRow {
  projection_id: number;
  product_id: string;
  product_name: string;
  projection_version: string;
  qty: string;
}

export default function ProjectionDashboard() {
  const [rows, setRows] = useState<ProjectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/projection');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRows(data.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setUploadResult('');
    try {
      const form = new FormData();
      form.append('file', uploadFile);
      const res = await fetch('/api/projection', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUploadResult(`✓ Uploaded: ${data.inserted} rows inserted, ${data.skipped} skipped`);
      setUploadFile(null);
      fetchData();
    } catch (e) {
      setUploadResult(`✗ ${e instanceof Error ? e.message : 'Upload failed'}`);
    } finally {
      setUploading(false);
    }
  };

  const downloadCsv = async () => {
    const res = await fetch('/api/projection?download=true');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'projection.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Group by version for summary
  const versionSummary = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.projection_version] = (acc[row.projection_version] || 0) + 1;
    return acc;
  }, {});

  const filtered = rows.filter(
    (r) =>
      r.product_id?.toLowerCase().includes(search.toLowerCase()) ||
      r.product_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.projection_version?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Projection Dashboard</h2>
          <p className="text-sm text-gray-500 mt-1">{rows.length} projection entries across all types</p>
        </div>
        <button
          onClick={downloadCsv}
          disabled={rows.length === 0}
          className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-40 transition-colors"
        >
          ↓ Download CSV
        </button>
      </div>

      {/* Version summary cards */}
      {Object.keys(versionSummary).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {Object.entries(versionSummary).map(([version, count]) => (
            <div key={version} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Version</p>
              <p className="text-lg font-bold text-gray-900 mt-1">{version}</p>
              <p className="text-sm text-gray-500">{count} products</p>
            </div>
          ))}
        </div>
      )}

      {/* Upload section */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Upload Projection CSV</h3>
        <p className="text-xs text-gray-400 mb-3">
          Required columns: <code className="bg-gray-100 px-1 rounded">product_id, projection_version, qty</code>
        </p>
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
            className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
          />
          <button
            onClick={handleUpload}
            disabled={!uploadFile || uploading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40 transition-colors"
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
        {uploadResult && (
          <p className={`mt-2 text-sm ${uploadResult.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>
            {uploadResult}
          </p>
        )}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by product ID, name, or version..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Loading...</div>
        ) : error ? (
          <div className="p-6 text-red-600 text-sm">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            {rows.length === 0
              ? 'No projection data yet. Upload a projection CSV to get started.'
              : 'No results match your search.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Product ID', 'Product Name', 'Version', 'Qty'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((row) => (
                  <tr key={row.projection_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-blue-700">{row.product_id}</td>
                    <td className="px-4 py-3 text-gray-900">{row.product_name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded">
                        {row.projection_version}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{row.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
