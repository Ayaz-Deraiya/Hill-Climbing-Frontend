import React, { useState } from 'react';
import axios from 'axios';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { Play, RotateCcw, BarChart3, Box, Settings2, Info, FileText } from 'lucide-react';

// API Configuration
const API_BASE_URL = 'https://hill-climbing-backend-1.onrender.com';

interface Bin {
  items: number[];
  used: number;
  capacity: number;
}

interface OptimizationResult {
  algorithm: string;
  bins: Bin[];
  cost_history: number[];
  num_bins: number;
  final_cost: number;
}

interface TestCaseResult {
  algorithm: string;
  num_bins: number;
  time_ms: number;
}

interface BatchCompareItemResult {
  test_case_name: string;
  items_count: number;
  capacity: number;
  hc: TestCaseResult;
  bt: TestCaseResult;
}

interface BatchCompareResponse {
  results: BatchCompareItemResult[];
}

const App: React.FC = () => {
  const [itemsStr, setItemsStr] = useState('5, 8, 3, 2, 6, 9, 4, 1, 7, 5, 2, 8, 4, 3, 6, 9');
  const [capacity, setCapacity] = useState(10);
  const [maxIter, setMaxIter] = useState(500);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [appMode, setAppMode] = useState<'single' | 'batch'>('single');
  const [batchText, setBatchText] = useState(`TestCase 1:\n13 10\n1 5 3 1 2 5 5 1 7 2 3 1 2\n\nTestCase 2:\n20 30\n8 17 23 4 26 1 8 8 22 26 13 11 9 22 15 26 6 1 22 8`);
  const [batchResult, setBatchResult] = useState<BatchCompareResponse | null>(null);

  const handleRandomItems = async () => {
    try {
      const resp = await axios.get(`${API_BASE_URL}/random_items?count=20`);
      setItemsStr(resp.data.items.join(', '));
    } catch (err) {
      console.error('Failed to fetch random items', err);
    }
  };

  const runOptimization = async () => {
    setLoading(true);
    setResult(null);
    
    const items = itemsStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    
    try {
      const resp = await axios.post(`${API_BASE_URL}/optimize`, {
        items,
        capacity,
        algorithm: 'hc',
        max_iter: maxIter
      });
      setResult(resp.data);
    } catch (err) {
      console.error('Optimization failed', err);
      alert('Optimization failed. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const runBatchOptimization = async () => {
    setLoading(true);
    setBatchResult(null);
    try {
      const resp = await axios.post(`${API_BASE_URL}/compare-batch`, {
        batch_text: batchText
      });
      setBatchResult(resp.data);
    } catch (err) {
      console.error('Batch Optimization failed', err);
      alert('Batch Optimization failed. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        setBatchText(text);
      }
    };
    reader.readAsText(file);
  };

  const renderBin = (bin: Bin, idx: number, totalCapacity: number) => (
    <div key={idx} className="bin">
      <div className="bin-header">BIN #{idx + 1} ({bin.used}/{bin.capacity})</div>
      <div className="item-stack">
        {bin.items.map((item, i) => (
          <div 
            key={i} 
            className="item" 
            style={{ height: `${(item / totalCapacity) * 100}px` }}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );

  const renderStats = (res: OptimizationResult) => (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-value">{res.num_bins}</div>
        <div className="stat-label">Bins Used</div>
      </div>
      <div className="stat-card">
        <div className="stat-value">{res.final_cost.toFixed(2)}</div>
        <div className="stat-label">Final Cost</div>
      </div>
      <div className="stat-card">
        <div className="stat-value">{res.cost_history.length}</div>
        <div className="stat-label">Iterations</div>
      </div>
    </div>
  );

  const renderChart = (history: number[]) => {
    const data = history.map((val, i) => ({ iteration: i, cost: val }));
    // Downsample chart data for performance if history is long
    const sampledData = data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 100)) === 0);

    return (
      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sampledData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="iteration" stroke="#64748b" label={{ value: 'Iterations', position: 'bottom', offset: 0, fill: '#64748b' }} height={50} />
            <YAxis stroke="#64748b" label={{ value: 'Cost', angle: -90, position: 'insideLeft', offset: 10, fill: '#64748b' }} width={60} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }}
              itemStyle={{ color: '#4f46e5' }}
            />
            <Line 
              type="monotone" 
              dataKey="cost" 
              name="Cost" 
              stroke="#4f46e5" 
              strokeWidth={2} 
              dot={false} 
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };



  const renderBatchStats = () => {
    if (!batchResult) return null;
    
    const totalCases = batchResult.results.length;
    let optimalMatches = 0;
    let extraBins = 0;

    batchResult.results.forEach(r => {
      if (r.hc.num_bins === r.bt.num_bins) {
        optimalMatches++;
      }
      extraBins += (r.hc.num_bins - r.bt.num_bins);
    });

    const chartData = batchResult.results.map(r => ({
      name: r.test_case_name,
      "HC Bins": r.hc.num_bins,
      "BT Bins": r.bt.num_bins,
    }));

    return (
      <div className="batch-results">
        <div className="stats-grid" style={{ marginBottom: '2rem' }}>
          <div className="stat-card">
            <div className="stat-value">{optimalMatches}/{totalCases}</div>
            <div className="stat-label">Optimal Solutions Reached by HC</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{totalCases > 0 ? ((optimalMatches / totalCases) * 100).toFixed(1) : 0}%</div>
            <div className="stat-label">HC Accuracy</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">+{extraBins}</div>
            <div className="stat-label">Total Extra Bins Used by HC</div>
          </div>
        </div>

        <div className="card">
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
             <Box size={20} /> Bins Required (Optimal Vs Heuristic)
          </h2>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" label={{ value: 'Test Cases', position: 'bottom', offset: 0, fill: '#64748b' }} height={50} />
                <YAxis stroke="#64748b" />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }}/>
                <Bar dataKey="HC Bins" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="BT Bins" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="app-container">
      <header>
        <h1>Bin Packing</h1>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
           <button className={`btn ${appMode === 'single' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setAppMode('single')} style={{ width: 'auto', padding: '0.5rem 1.5rem', marginTop: 0 }}>Single Optimization</button>
           <button className={`btn ${appMode === 'batch' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setAppMode('batch')} style={{ width: 'auto', padding: '0.5rem 1.5rem', marginTop: 0 }}>Batch Comparison</button>
        </div>
      </header>

      <main className="dashboard-grid">
        <aside className="card">
          {appMode === 'single' ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: '#818cf8' }}>
                <Settings2 size={20} />
                <h2 style={{ fontSize: '1.25rem' }}>Configuration</h2>
              </div>

              <div className="form-group">
                <label>Item Sizes (comma separated)</label>
                <textarea 
                  rows={4} 
                  value={itemsStr} 
                  onChange={(e) => setItemsStr(e.target.value)}
                  placeholder="e.g. 5, 2, 8, 4"
                />
                <button className="btn btn-secondary" onClick={handleRandomItems}>
                  <RotateCcw size={16} style={{ marginRight: '0.5rem' }} />
                  Random Items
                </button>
              </div>

              <div className="form-group">
                <label>Bin Capacity</label>
                <input 
                  type="number" 
                  value={capacity} 
                  onChange={(e) => setCapacity(parseInt(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label>Max Iterations</label>
                <input 
                  type="number" 
                  value={maxIter} 
                  onChange={(e) => setMaxIter(parseInt(e.target.value))}
                />
              </div>

              <button 
                className="btn btn-primary" 
                onClick={runOptimization}
                disabled={loading}
              >
                {loading ? 'Optimizing...' : (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <Play size={18} fill="currentColor" /> Run
                  </span>
                )}
              </button>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: '#818cf8' }}>
                <FileText size={20} />
                <h2 style={{ fontSize: '1.25rem' }}>Batch Text File Layout</h2>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Upload a text file or paste the contents below. Include exact `TestCase X:` headers.
              </p>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <input 
                  type="file" 
                  accept=".txt" 
                  onChange={handleFileUpload} 
                  style={{ cursor: 'pointer', padding: '0.5rem', fontSize: '0.875rem' }}
                />
                <textarea 
                  rows={13} 
                  value={batchText} 
                  onChange={(e) => setBatchText(e.target.value)}
                  style={{ fontFamily: 'monospace' }}
                />
              </div>
              <button 
                className="btn btn-primary" 
                onClick={runBatchOptimization}
                disabled={loading}
              >
                {loading ? 'Processing...' : (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <Play size={18} fill="currentColor" /> Process Bulk File
                  </span>
                )}
              </button>
            </>
          )}
        </aside>

        <section className="results-container">
          {appMode === 'single' ? (
            result ? (
              <>
                <div className="card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#10b981' }}>
                    <Box size={20} />
                    <h2 style={{ fontSize: '1.25rem' }}>Bin Assignment</h2>
                  </div>
                  {renderStats(result)}
                  <div className="bin-grid">
                    {result.bins.map((b, i) => renderBin(b, i, capacity))}
                  </div>
                </div>
                <div className="card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#818cf8' }}>
                    <BarChart3 size={20} />
                    <h2 style={{ fontSize: '1.25rem' }}>Cost History</h2>
                  </div>
                  {renderChart(result.cost_history)}
                </div>
              </>
            ) : (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '400px', color: '#94a3b8' }}>
                <Info size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                <p>Configure the parameters and run optimization to see results.</p>
              </div>
            )
          ) : (
            batchResult ? (
              renderBatchStats()
            ) : (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '400px', color: '#94a3b8' }}>
                <Info size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                <p>Paste the text cases and click process to see optimal Bins and exec speed charts.</p>
              </div>
            )
          )}
        </section>
      </main>
    </div>
  );
};

export default App;
