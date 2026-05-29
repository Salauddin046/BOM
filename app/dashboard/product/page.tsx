'use client';

import { useEffect, useState } from 'react';

interface ProductRow {
  product_id: string;
  product_name: string;
  client: string;
  vehicle_model: string;
  type_of_asset: string;
  config_type: string;
}

export default function ProductDashboard() {
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/products');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setRows(data.data || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const downloadCsv = () => {
    if (rows.length === 0) return;
    const headers = ['product_id', 'product_name', 'client', 'vehicle_model', 'type_of_asset', 'config_type'];
    const csvRows = [
      headers.join(','),
      ...rows.map((row) =>
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
    a.download = 'products.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = rows.filter(
    (r) =>
      r.product_id?.toLowerCase().includes(search.toLowerCase()) ||
      r.product_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.client?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Product Dashboard</h2>
          <p className="text-sm text-gray-500 mt-1">{rows.length} products</p>
        </div>
        <button
          onClick={downloadCsv}
          disabled={rows.length === 0}
          className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-40 transition-colors"
        >
          ↓ Download CSV
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by product ID, name, or client..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Loading...</div>
        ) : error ? (
          <div className="p-6 text-red-600 text-sm">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">No products found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Product ID', 'Product Name', 'Client', 'Vehicle Model', 'Asset Type', 'Config'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((row) => (
                  <tr key={row.product_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-blue-700">{row.product_id}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{row.product_name}</td>
                    <td className="px-4 py-3 text-gray-600">{row.client}</td>
                    <td className="px-4 py-3 text-gray-600">{row.vehicle_model}</td>
                    <td className="px-4 py-3 text-gray-600">{row.type_of_asset}</td>
                    <td className="px-4 py-3 text-gray-600">{row.config_type}</td>
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
