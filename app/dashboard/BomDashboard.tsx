'use client';

import { useEffect, useState } from 'react';

interface BomRow {
  line_id: number;
  bom_name: string;
  bom_description: string;
  version: string;
  material_code: string;
  material_description: string;
  qty: string;
  uom: string;
  material_type: string;
  variant: string | null;
}

interface Props {
  title: string;
  materialType: string;
  accentColor: string;
}

const VARIANT_TYPES = ['DEVICE', 'PCBA'];

export default function BomDashboard({ title, materialType, accentColor }: Props) {
  const [rows, setRows] = useState<BomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState('');

  const showVariant = VARIANT_TYPES.includes(materialType);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/bom?type=${materialType}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRows(data.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [materialType]);

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setUploadResult('');
    try {
      const form = new FormData();
      form.append('file', uploadFile);
      const res = await fetch('/api/bom/upload', { method: 'POST', body: form });
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

  const downloadCsv = () => {
    if (rows.length === 0) return;
    const headers = ['bom_name', 'bom_description', 'version', 'material_code', 'material_description', 'qty', 'uom', 'material_type', ...(showVariant ? ['variant'] : [])];
    const csvRows = [
      headers.join(','),
      ...rows.map((row) =>
        headers.map((h) => {
          const val = (row as unknown as Record<string, unknown>)[h];
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
    a.download = `${materialType.toLowerCase()}_bom.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = rows.filter(
    (r) =>
      r.material_code?.toLowerCase().includes(search.toLowerCase()) ||
      r.material_description?.toLowerCase().includes(search.toLowerCase()) ||
      r.bom_name?.toLowerCase().includes(search.toLowerCase()) ||
      (showVariant && r.variant?.toLowerCase().includes(search.toLowerCase()))
  );

  const tableHeaders = ['BOM Name', 'Version', 'Material Code', 'Description', 'Qty', 'UOM', ...(showVariant ? ['Variant'] : [])];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500 mt-1">{rows.length} materials loaded</p>
        </div>
        <button
          onClick={downloadCsv}
          disabled={rows.length === 0}
          className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-40 transition-colors"
        >
          ↓ Download CSV
        </button>
      </div>

      {/* Upload section */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Upload BOM CSV</h3>
        <p className="text-xs text-gray-400 mb-3">
          Required columns:{' '}
          <code className="bg-gray-100 px-1 rounded">
            bom_name, version, material_code, material_description, qty, uom, material_type
            {showVariant ? ', variant' : ''}
          </code>
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
            className={`${accentColor} text-white px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40 transition-colors`}
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
          placeholder="Search by material code, description, or BOM name..."
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
            {rows.length === 0 ? 'No data yet. Upload a BOM CSV to get started.' : 'No results match your search.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {tableHeaders.map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((row) => (
                  <tr key={row.line_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{row.bom_name}</td>
                    <td className="px-4 py-3 text-gray-500">{row.version}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{row.material_code}</td>
                    <td className="px-4 py-3 text-gray-700">{row.material_description}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{row.qty}</td>
                    <td className="px-4 py-3 text-gray-500">{row.uom}</td>
                    {showVariant && (
                      <td className="px-4 py-3 text-gray-600">{row.variant ?? '—'}</td>
                    )}
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
