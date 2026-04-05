import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Link, Outlet, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Activity, Search, Database, Users, LayoutDashboard, FileText } from 'lucide-react';

export const DataContext = createContext();

function Layout() {
  return (
    <div className="layout-container">
      <div className="sidebar pacs-panel">
        <h2 className="clinical-text" style={{ fontSize: '1.2rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Activity size={24} /> MSK PACS
        </h2>
        
        <Link to="/" className="btn"><LayoutDashboard size={16} /> Dashboard</Link>
        <Link to="/search" className="btn"><Search size={16} /> Combo Search</Link>
        
        <div style={{ marginTop: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <div className="status-light" style={{ width: '8px', height: '8px', background: 'var(--accent-color)', borderRadius: '50%', display: 'inline-block', boxShadow: 'var(--accent-glow)', marginRight: '5px' }}></div>
          SYSTEM ONLINE
        </div>
      </div>
      <div className="main-content pacs-panel" style={{ margin: '20px', borderRadius: '12px' }}>
        <Outlet />
      </div>
    </div>
  );
}

// --------- COMPONENTS -----------

function Dashboard() {
  const { stats, loading } = useContext(DataContext);
  if (loading) return <div>INITIALIZING DATASTORE...</div>;

  return (
    <div>
      <h1 className="clinical-text">System Overview</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginTop: '20px' }}>
        <div className="pacs-panel" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 10px 0', color: 'var(--text-muted)' }}>Total Records</h3>
          <div style={{ fontSize: '2.5rem', color: 'var(--accent-color)' }}>{stats.totalReports.toLocaleString()}</div>
        </div>
        <div className="pacs-panel" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 10px 0', color: 'var(--text-muted)' }}>Pathologies Tracked</h3>
          <div style={{ fontSize: '2.5rem', color: 'var(--accent-color)' }}>{Object.keys(stats.pathCounts || {}).length}</div>
        </div>
        <div className="pacs-panel" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 10px 0', color: 'var(--text-muted)' }}>Body Regions</h3>
          <div style={{ fontSize: '2.5rem', color: 'var(--accent-color)' }}>{Object.keys(stats.regionCounts || {}).length}</div>
        </div>
      </div>
      
      <div style={{ marginTop: '40px' }}>
        <h2 className="clinical-text">Top Pathologies</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {Object.entries(stats.pathCounts || {}).sort((a,b)=>b[1]-a[1]).slice(0,20).map(([p, v]) => (
            <Link key={p} to={`/search?pathology=${encodeURIComponent(p)}`} className="badge" style={{ cursor: 'pointer', border: '1px solid var(--panel-border)', textDecoration: 'none', color: 'var(--text-primary)' }}>
              {p} ({v})
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function ComboSearch() {
  const { reports, stats } = useContext(DataContext);
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Initialize state from URL params if available
  const [selectedPaths, setSelectedPaths] = useState(() => {
    const p = searchParams.get('pathology');
    return p ? [p] : [];
  });
  const [selectedRegion, setSelectedRegion] = useState(() => {
    return searchParams.get('region') || '';
  });
  const [searchTerm, setSearchTerm] = useState(() => {
    return searchParams.get('q') || '';
  });
  
  // Keep state in sync with URL changes when clicking external links
  useEffect(() => {
    const p = searchParams.get('pathology');
    if (p && !selectedPaths.includes(p)) {
      setSelectedPaths(prev => [...prev, p]);
    }
    const r = searchParams.get('region');
    if (r && r !== selectedRegion) {
      setSelectedRegion(r);
    }
    const q = searchParams.get('q');
    if (q && q !== searchTerm) {
      setSearchTerm(q);
    }
  }, [searchParams]);

  const allPathologies = Object.keys(stats.pathCounts || {}).sort();
  
  const handlePathChange = (e) => {
    const val = e.target.value;
    if (val && !selectedPaths.includes(val)) {
      setSelectedPaths([...selectedPaths, val]);
    }
    e.target.value = '';
  };
  
  const removePath = (p) => {
    setSelectedPaths(selectedPaths.filter(x => x !== p));
  };
  
  // Filter logic
  const results = reports.filter(r => {
    // 1. Region check
    if (selectedRegion && r.bodyRegion !== selectedRegion) return false;
    
    // 2. Pathology combo check (ALL selected paths must exist in r.pathologies)
    const rPaths = r.pathologies.map(p => p.toLowerCase());
    for(const p of selectedPaths) {
      if (!rPaths.includes(p.toLowerCase())) return false;
    }
    
    // 3. Free Text Search check
    if (searchTerm) {
      const termLower = searchTerm.toLowerCase();
      const fullText = (r.reportText || '').toLowerCase();
      if (!fullText.includes(termLower)) return false;
    }
    
    return true;
  });

  return (
    <div>
      <h1 className="clinical-text"><Search size={24} style={{verticalAlign: 'text-bottom'}}/> Advanced Combination Search</h1>
      
      <div className="pacs-panel" style={{ padding: '20px', marginBottom: '20px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '250px' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--accent-color)' }}>Require Pathology (AND logic):</label>
          <select onChange={handlePathChange} value="">
            <option value="">+ Add Pathology Filter...</option>
            {allPathologies.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <div style={{ marginTop: '10px' }}>
            {selectedPaths.map(p => (
               <span key={p} className="badge" style={{ background: 'rgba(0, 240, 255, 0.2)', color: '#fff', padding: '6px 12px', border: '1px solid var(--accent-color)' }}>
                 {p} <button onClick={()=>removePath(p)} style={{background:'none',border:'none',color:'white',cursor:'pointer',marginLeft:'5px'}}>×</button>
               </span>
            ))}
          </div>
        </div>
        
        <div style={{ flex: 1, minWidth: '250px' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--accent-color)' }}>Body Region:</label>
          <select value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)}>
             <option value="">All Regions</option>
             {Object.keys(stats.regionCounts || {}).sort().map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        
        <div style={{ flex: 1, minWidth: '250px' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--accent-color)' }}>Keyword Search:</label>
          <input 
            type="text" 
            placeholder="e.g. 'grade II' or 'fracture'" 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            style={{ width: '100%', padding: '8px', background: 'var(--panel-bg)', color: 'var(--text-primary)', border: '1px solid var(--panel-border)', borderRadius: '4px' }}
          />
        </div>
      </div>
      
      <h3 style={{ color: 'var(--text-muted)' }}>Matches: {results.length} cases</h3>
      
      {results.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Patient ID</th>
                <th>Date</th>
                <th>Age</th>
                <th>Sex</th>
                <th>Region</th>
                <th>Summary of Pathologies</th>
              </tr>
            </thead>
            <tbody>
              {results.slice(0, 100).map(r => (
                <tr key={r._slug + r.patientId}>
                  <td><Link to={`/report/${r._slug}`}>{r.patientId}</Link></td>
                  <td>{r.date}</td>
                  <td>{r.age}</td>
                  <td>{r.sex}</td>
                  <td>{r.bodyRegion}</td>
                  <td>{r.pathologies.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {results.length > 100 && <div style={{padding:'10px', color:'var(--text-muted)'}}>... showing first 100 results.</div>}
        </div>
      ) : (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          NO MATCHING RECORDS FOUND IN DATASTORE
        </div>
      )}
    </div>
  );
}

function ReportView() {
  const { slug } = useParams();
  const { reports, loading } = useContext(DataContext);
  
  if (loading) return <div>LOADING REPORT...</div>;
  
  const report = reports.find(r => r._slug === slug || r.patientId === slug);
  
  if (!report) return <div style={{color:'red'}}>REPORT RECORD NOT FOUND</div>;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="clinical-text">CLINICAL REPORT: {report.patientId}</h1>
        <Link to="/search" className="btn">← Back to Search</Link>
      </div>
      
      <div className="pacs-panel" style={{ padding: '20px', marginBottom: '20px', display: 'flex', gap: '30px' }}>
        <div><strong style={{color:'var(--accent-color)'}}>Date:</strong> {report.date}</div>
        <div><strong style={{color:'var(--accent-color)'}}>Age:</strong> {report.age}</div>
        <div><strong style={{color:'var(--accent-color)'}}>Sex:</strong> {report.sex}</div>
        <div><strong style={{color:'var(--accent-color)'}}>DOB:</strong> {report.dob}</div>
        <div>
          <strong style={{color:'var(--accent-color)'}}>Region:</strong> 
          <Link to={`/search?region=${encodeURIComponent(report.bodyRegion)}`} style={{marginLeft:'5px'}} className="badge">
            {report.bodyRegion}
          </Link>
        </div>
      </div>

      <div className="pacs-panel" style={{ padding: '30px', marginBottom: '20px', background: '#000' }}>
        <h3 style={{ color: 'var(--text-muted)', marginTop: 0, borderBottom: '1px solid #333', paddingBottom: '10px' }}>RAW DICOM REPORT TEXT</h3>
        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-stack)', fontSize: '0.95rem', lineHeight: '1.6' }}>
          {report.reportText}
        </pre>
      </div>
      
      <div className="pacs-panel" style={{ padding: '20px' }}>
        <h3 style={{ color: 'var(--accent-color)', marginTop: 0 }}>IDENTIFIED PATHOLOGIES</h3>
        <div>
          {report.pathologies.length === 0 && <span style={{color:'var(--text-muted)'}}>No distinct pathology tagged.</span>}
          {report.pathologies.map(p => (
            <Link key={p} to={`/search?pathology=${encodeURIComponent(p)}`} className="badge" style={{ padding: '8px 16px', fontSize: '0.9rem', border: '1px solid var(--accent-color)', background: 'rgba(0,240,255,0.1)' }}>
              {p}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [repRes, statRes] = await Promise.all([
          fetch(`${import.meta.env.BASE_URL}data/parsed_reports.json`),
          fetch(`${import.meta.env.BASE_URL}data/stats.json`)
        ]);
        const repData = await repRes.json();
        const statData = await statRes.json();
        
        // Add slugs to reports
        repData.forEach(r => {
           const sDate = r.date ? r.date.split('.').reverse().join('') : '00000000';
           r._slug = `${r.patientId}-${sDate}`;
        });
        
        setReports(repData);
        setStats(statData);
        setLoading(false);
      } catch (err) {
        console.error("Failed to load datastore", err);
      }
    }
    loadData();
  }, []);

  return (
    <DataContext.Provider value={{ reports, stats, loading }}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="search" element={<ComboSearch />} />
            <Route path="report/:slug" element={<ReportView />} />
            <Route path="*" element={<div>MODULE OFFLINE (404)</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </DataContext.Provider>
  );
}
