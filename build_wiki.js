/**
 * MSK MRI Wiki Builder
 * Generates a structured, interlinked markdown wiki from parsed MRI reports.
 * Following Karpathy's llm-wiki pattern — every page has cross-references and patient traceback.
 */

const fs = require('fs');
const path = require('path');

const WIKI = path.join(__dirname, 'wiki');
const allParsed = JSON.parse(fs.readFileSync(path.join(__dirname, 'parsed_reports.json'), 'utf-8'));
// Filter out non-MSK studies (e.g., brain MRIs) from the wiki
const nonMsk = allParsed.filter(r => r.bodyRegion === 'Non-MSK');
const reports = allParsed.filter(r => r.bodyRegion !== 'Non-MSK');
if (nonMsk.length > 0) console.log(`⚠ Excluded ${nonMsk.length} non-MSK studies (brain MRI etc.)`);
const stats = JSON.parse(fs.readFileSync(path.join(__dirname, 'stats.json'), 'utf-8'));

function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }
function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''); }
function formatDate(d) { return d; } // keep DD.MM.YYYY as-is
// Escaped pipe for wikilinks inside markdown tables: produces literal \|
const EP = String.fromCharCode(92) + '|';

// Build a unique slug for each report: patientId-YYYYMMDD[-n]
// Assigns slugs to reports in-place so all page builders can reference them
const reportSlugMap = new Map(); // key -> count for deduplication
function assignReportSlugs() {
  for (const r of reports) {
    const [dd, mm, yyyy] = r.date.split('.');
    const base = `${r.patientId}-${yyyy}${mm}${dd}`;
    const count = (reportSlugMap.get(base) || 0) + 1;
    reportSlugMap.set(base, count);
    r._slug = count > 1 ? `${base}-${count}` : base;
  }
  // Fix: first occurrence needs no suffix, but if there are dupes, retroactively tag the first
  const slugCounts = {};
  for (const r of reports) {
    const [dd, mm, yyyy] = r.date.split('.');
    const base = `${r.patientId}-${yyyy}${mm}${dd}`;
    slugCounts[base] = (slugCounts[base] || 0) + 1;
  }
  // Reset and reassign properly
  const slugIndex = {};
  for (const r of reports) {
    const [dd, mm, yyyy] = r.date.split('.');
    const base = `${r.patientId}-${yyyy}${mm}${dd}`;
    slugIndex[base] = (slugIndex[base] || 0) + 1;
    if (slugCounts[base] > 1) {
      r._slug = `${base}-${slugIndex[base]}`;
    } else {
      r._slug = base;
    }
  }
}
assignReportSlugs();

// ============================================================
// OVERVIEW
// ============================================================
function buildOverview() {
  const dateRange1 = '01.01.2023 – 01.01.2025';
  const dateRange2 = '01.06.2025 – 30.03.2026';
  
  const regionEntries = Object.entries(stats.regionCounts).sort((a, b) => b[1] - a[1]);
  const pathEntries = Object.entries(stats.pathCounts).sort((a, b) => b[1] - a[1]);
  const docEntries = Object.entries(stats.doctorCounts).filter(([k]) => k !== '').sort((a, b) => b[1] - a[1]);
  
  let md = `---
title: MSK MRI Knowledge Base — Overview
type: overview
created: ${new Date().toISOString().split('T')[0]}
total_reports: ${reports.length}
sources: 2
---

# 🦴 MSK MRI Knowledge Base

> A persistent, compounding wiki built from **${reports.length.toLocaleString()} Musculoskeletal MRI reports** using the [LLM-Wiki pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f).

## Data Sources

| Source File | Date Range | Reports |
|---|---|---|
| \`MRI MSK LAST 2 YEARS.txt\` | ${dateRange1} | ${reports.filter(r => r.source === 'MRI MSK LAST 2 YEARS.txt').length.toLocaleString()} |
| \`MRI MSK.txt\` | ${dateRange2} | ${reports.filter(r => r.source === 'MRI MSK.txt').length.toLocaleString()} |

## Demographics at a Glance

| Metric | Value |
|---|---|
| **Total Reports** | ${reports.length.toLocaleString()} |
| **Male** | ${stats.sexCounts.male?.toLocaleString() || 0} (${((stats.sexCounts.male / reports.length) * 100).toFixed(1)}%) |
| **Female** | ${stats.sexCounts.female?.toLocaleString() || 0} (${((stats.sexCounts.female / reports.length) * 100).toFixed(1)}%) |
| **Mean Age** | ${(reports.reduce((s, r) => s + r.age, 0) / reports.length).toFixed(1)} years |
| **Age Range** | ${Math.min(...reports.map(r => r.age))} – ${Math.max(...reports.map(r => r.age))} years |

### Age Distribution

| Age Group | Count | Percentage |
|---|---|---|
${Object.entries(stats.ageBuckets).map(([k, v]) => `| ${k} | ${v.toLocaleString()} | ${((v / reports.length) * 100).toFixed(1)}% |`).join('\n')}

→ See full analysis: [[analysis/demographics]]

## Body Regions

| Region | Reports | % of Total |
|---|---|---|
${regionEntries.map(([k, v]) => `| [[regions/${slug(k)}|${k}]] | ${v.toLocaleString()} | ${((v / reports.length) * 100).toFixed(1)}% |`).join('\n')}

## Top 20 Pathologies

| Pathology | Count | Prevalence |
|---|---|---|
${pathEntries.slice(0, 20).map(([k, v]) => `| [[pathologies/${slug(k)}|${k}]] | ${v.toLocaleString()} | ${((v / reports.length) * 100).toFixed(1)}% |`).join('\n')}

→ See all pathologies: [[index#Pathology Pages]]

## Reporting Radiologists

| Doctor | Reports | % |
|---|---|---|
${docEntries.slice(0, 15).map(([k, v]) => `| [[radiologists/${slug(k)}|${k}]] | ${v.toLocaleString()} | ${((v / reports.length) * 100).toFixed(1)}% |`).join('\n')}

→ See all: [[index#Radiologist Pages]]

## Wiki Structure

- **[[index]]** — Complete catalog of all wiki pages
- **[[log]]** — Chronological record of wiki operations
- **/regions/** — One page per body region with case tables
- **/pathologies/** — One page per pathology concept with case tables
- **/radiologists/** — One page per reporting doctor
- **/analysis/** — Cross-cutting analytics and insights
`;

  fs.writeFileSync(path.join(WIKI, 'overview.md'), md, 'utf-8');
  console.log('✓ overview.md');
}

// ============================================================
// BODY REGION PAGES
// ============================================================
function buildRegionPages() {
  const regionMap = {};
  for (const r of reports) {
    if (!regionMap[r.bodyRegion]) regionMap[r.bodyRegion] = [];
    regionMap[r.bodyRegion].push(r);
  }
  
  ensureDir(path.join(WIKI, 'regions'));
  
  for (const [region, cases] of Object.entries(regionMap)) {
    // Pathology breakdown for this region
    const pathBreakdown = {};
    for (const c of cases) {
      for (const p of c.pathologies) {
        pathBreakdown[p] = (pathBreakdown[p] || 0) + 1;
      }
    }
    const pathEntries = Object.entries(pathBreakdown).sort((a, b) => b[1] - a[1]);
    
    // Doctor breakdown
    const docBreakdown = {};
    for (const c of cases) {
      if (c.doctor) docBreakdown[c.doctor] = (docBreakdown[c.doctor] || 0) + 1;
    }
    
    // Age stats
    const ages = cases.map(c => c.age);
    const meanAge = (ages.reduce((s, a) => s + a, 0) / ages.length).toFixed(1);
    const maleCount = cases.filter(c => c.sex === 'male').length;
    
    let md = `---
title: "${region} — MSK MRI"
type: body_region
region: "${region}"
total_cases: ${cases.length}
created: ${new Date().toISOString().split('T')[0]}
---

# ${region}

> **${cases.length.toLocaleString()} reports** | ${((cases.length / reports.length) * 100).toFixed(1)}% of total workload

## Demographics

| Metric | Value |
|---|---|
| Mean Age | ${meanAge} years |
| Male | ${maleCount} (${((maleCount / cases.length) * 100).toFixed(1)}%) |
| Female | ${cases.length - maleCount} (${(((cases.length - maleCount) / cases.length) * 100).toFixed(1)}%) |
| Age Range | ${Math.min(...ages)} – ${Math.max(...ages)} years |

## Pathology Breakdown

| Pathology | Count | Prevalence in ${region} |
|---|---|---|
${pathEntries.slice(0, 20).map(([k, v]) => `| [[pathologies/${slug(k)}|${k}]] | ${v} | ${((v / cases.length) * 100).toFixed(1)}% |`).join('\n')}

## Reporting Doctors

| Doctor | Reports |
|---|---|
${Object.entries(docBreakdown).filter(([k]) => k !== '').sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `| [[radiologists/${slug(k)}|${k}]] | ${v} |`).join('\n')}

## Case Registry (${cases.length.toLocaleString()} cases)

| # | Date | Patient ID | Age | Sex | Study | Impression | Doctor |
|---|---|---|---|---|---|---|---|
${cases.map((c, i) => {
  const imp = (c.impression || 'See report').substring(0, 120).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const study = (c.studyType || '').substring(0, 50).replace(/\|/g, '\\|');
  return `| ${i + 1} | ${c.date} | [[reports/${c._slug}${EP}${c.patientId}]] | ${c.age} | ${c.sex} | ${study} | ${imp} | ${c.doctor || '—'} |`;
}).join('\n')}

---
→ Back to [[overview]] | [[index]]
`;

    fs.writeFileSync(path.join(WIKI, 'regions', `${slug(region)}.md`), md, 'utf-8');
    console.log(`✓ regions/${slug(region)}.md (${cases.length} cases)`);
  }
}

// ============================================================
// PATHOLOGY PAGES
// ============================================================
function buildPathologyPages() {
  const pathMap = {};
  for (const r of reports) {
    for (const p of r.pathologies) {
      if (!pathMap[p]) pathMap[p] = [];
      pathMap[p].push(r);
    }
  }
  
  ensureDir(path.join(WIKI, 'pathologies'));
  
  for (const [pathology, cases] of Object.entries(pathMap)) {
    // Region breakdown
    const regionBreakdown = {};
    for (const c of cases) {
      regionBreakdown[c.bodyRegion] = (regionBreakdown[c.bodyRegion] || 0) + 1;
    }
    
    // Co-occurring pathologies
    const coPaths = {};
    for (const c of cases) {
      for (const p of c.pathologies) {
        if (p !== pathology) coPaths[p] = (coPaths[p] || 0) + 1;
      }
    }
    const coPathEntries = Object.entries(coPaths).sort((a, b) => b[1] - a[1]);
    
    const ages = cases.map(c => c.age);
    const meanAge = (ages.reduce((s, a) => s + a, 0) / ages.length).toFixed(1);
    const maleCount = cases.filter(c => c.sex === 'male').length;
    
    let md = `---
title: "${pathology}"
type: pathology
total_cases: ${cases.length}
prevalence: "${((cases.length / reports.length) * 100).toFixed(1)}%"
created: ${new Date().toISOString().split('T')[0]}
---

# ${pathology}

> **${cases.length.toLocaleString()} cases** | Prevalence: **${((cases.length / reports.length) * 100).toFixed(1)}%** across all MSK MRI reports

## Demographics

| Metric | Value |
|---|---|
| Mean Age | ${meanAge} years |
| Male | ${maleCount} (${((maleCount / cases.length) * 100).toFixed(1)}%) |
| Female | ${cases.length - maleCount} (${(((cases.length - maleCount) / cases.length) * 100).toFixed(1)}%) |

## Distribution by Body Region

| Region | Count | % of this pathology |
|---|---|---|
${Object.entries(regionBreakdown).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| [[regions/${slug(k)}|${k}]] | ${v} | ${((v / cases.length) * 100).toFixed(1)}% |`).join('\n')}

## Commonly Co-occurring Pathologies

| Pathology | Co-occurrence Count | % |
|---|---|---|
${coPathEntries.slice(0, 15).map(([k, v]) => `| [[pathologies/${slug(k)}|${k}]] | ${v} | ${((v / cases.length) * 100).toFixed(1)}% |`).join('\n')}

## Case Registry (${cases.length.toLocaleString()} cases)

| # | Date | Patient ID | Age | Sex | DOB | Region | Impression | Doctor |
|---|---|---|---|---|---|---|---|---|
${cases.map((c, i) => {
  const imp = (c.impression || 'See report').substring(0, 100).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  return `| ${i + 1} | ${c.date} | [[reports/${c._slug}${EP}${c.patientId}]] | ${c.age} | ${c.sex} | ${c.dob} | ${c.bodyRegion} | ${imp} | ${c.doctor || '—'} |`;
}).join('\n')}

---
→ Back to [[overview]] | [[index]]
`;

    fs.writeFileSync(path.join(WIKI, 'pathologies', `${slug(pathology)}.md`), md, 'utf-8');
    console.log(`✓ pathologies/${slug(pathology)}.md (${cases.length})`);
  }
}

// ============================================================
// RADIOLOGIST PAGES
// ============================================================
function buildRadiologistPages() {
  const docMap = {};
  for (const r of reports) {
    const doc = r.doctor || 'Unknown';
    if (doc === '' || doc === 'Unknown') continue;
    if (!docMap[doc]) docMap[doc] = [];
    docMap[doc].push(r);
  }
  
  ensureDir(path.join(WIKI, 'radiologists'));
  
  for (const [doctor, cases] of Object.entries(docMap)) {
    const regionBreakdown = {};
    const pathBreakdown = {};
    for (const c of cases) {
      regionBreakdown[c.bodyRegion] = (regionBreakdown[c.bodyRegion] || 0) + 1;
      for (const p of c.pathologies) {
        pathBreakdown[p] = (pathBreakdown[p] || 0) + 1;
      }
    }
    
    // Date range
    const dates = cases.map(c => {
      const [d, m, y] = c.date.split('.');
      return new Date(`${y}-${m}-${d}`);
    }).sort((a, b) => a - b);
    const firstDate = cases.find(c => {
      const [d, m, y] = c.date.split('.');
      return new Date(`${y}-${m}-${d}`).getTime() === dates[0].getTime();
    })?.date || '';
    const lastDate = cases.find(c => {
      const [d, m, y] = c.date.split('.');
      return new Date(`${y}-${m}-${d}`).getTime() === dates[dates.length - 1].getTime();
    })?.date || '';
    
    let md = `---
title: "${doctor}"
type: radiologist
total_reports: ${cases.length}
created: ${new Date().toISOString().split('T')[0]}
---

# ${doctor}

> **${cases.length.toLocaleString()} reports** | ${((cases.length / reports.length) * 100).toFixed(1)}% of total
> Active period: ${firstDate} → ${lastDate}

## Workload by Body Region

| Region | Reports | % |
|---|---|---|
${Object.entries(regionBreakdown).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| [[regions/${slug(k)}|${k}]] | ${v} | ${((v / cases.length) * 100).toFixed(1)}% |`).join('\n')}

## Top Pathologies Reported

| Pathology | Count |
|---|---|
${Object.entries(pathBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `| [[pathologies/${slug(k)}|${k}]] | ${v} |`).join('\n')}

## All Cases

| # | Date | Patient ID | Age | Sex | Study | Region |
|---|---|---|---|---|---|---|
${cases.map((c, i) => {
  const study = (c.studyType || '').substring(0, 50).replace(/\|/g, '\\|');
  return `| ${i + 1} | ${c.date} | [[reports/${c._slug}${EP}${c.patientId}]] | ${c.age} | ${c.sex} | ${study} | ${c.bodyRegion} |`;
}).join('\n')}

---
→ Back to [[overview]] | [[index]]
`;

    fs.writeFileSync(path.join(WIKI, 'radiologists', `${slug(doctor)}.md`), md, 'utf-8');
    console.log(`✓ radiologists/${slug(doctor)}.md (${cases.length})`);
  }
}

// ============================================================
// DEMOGRAPHICS ANALYSIS
// ============================================================
function buildDemographics() {
  ensureDir(path.join(WIKI, 'analysis'));
  
  // Age distribution by region
  const regionAgeMap = {};
  for (const r of reports) {
    if (!regionAgeMap[r.bodyRegion]) regionAgeMap[r.bodyRegion] = [];
    regionAgeMap[r.bodyRegion].push(r.age);
  }
  
  // Monthly volume
  const monthlyVolume = {};
  for (const r of reports) {
    const [d, m, y] = r.date.split('.');
    const key = `${y}-${m}`;
    monthlyVolume[key] = (monthlyVolume[key] || 0) + 1;
  }
  
  // Top pathologies by sex
  const malePathCounts = {};
  const femalePathCounts = {};
  for (const r of reports) {
    const target = r.sex === 'male' ? malePathCounts : femalePathCounts;
    for (const p of r.pathologies) {
      target[p] = (target[p] || 0) + 1;
    }
  }
  
  // Pediatric cases
  const pediatric = reports.filter(r => r.age <= 18);
  const geriatric = reports.filter(r => r.age >= 65);
  
  let md = `---
title: "Demographics Analysis"
type: analysis
created: ${new Date().toISOString().split('T')[0]}
---

# Demographics Analysis

## Overall Distribution

| Metric | Value |
|---|---|
| Total Reports | ${reports.length.toLocaleString()} |
| Male | ${stats.sexCounts.male} (${((stats.sexCounts.male / reports.length) * 100).toFixed(1)}%) |
| Female | ${stats.sexCounts.female} (${((stats.sexCounts.female / reports.length) * 100).toFixed(1)}%) |
| M:F Ratio | ${(stats.sexCounts.male / stats.sexCounts.female).toFixed(2)}:1 |
| Mean Age | ${(reports.reduce((s, r) => s + r.age, 0) / reports.length).toFixed(1)} years |
| Median Age | ${reports.map(r => r.age).sort((a, b) => a - b)[Math.floor(reports.length / 2)]} years |
| Pediatric (≤18y) | ${pediatric.length} (${((pediatric.length / reports.length) * 100).toFixed(1)}%) |
| Geriatric (≥65y) | ${geriatric.length} (${((geriatric.length / reports.length) * 100).toFixed(1)}%) |

## Age Distribution Table

| Age Group | Count | % | Male | Female |
|---|---|---|---|---|
${Object.entries(stats.ageBuckets).map(([k, v]) => {
  const male = reports.filter(r => {
    const ageGroup = r.age <= 20 ? '0-20' : r.age <= 40 ? '21-40' : r.age <= 60 ? '41-60' : r.age <= 80 ? '61-80' : '80+';
    return ageGroup === k && r.sex === 'male';
  }).length;
  return `| ${k} | ${v.toLocaleString()} | ${((v / reports.length) * 100).toFixed(1)}% | ${male} | ${v - male} |`;
}).join('\n')}

## Mean Age by Body Region

| Region | Mean Age | Youngest | Oldest | Count |
|---|---|---|---|---|
${Object.entries(regionAgeMap).sort((a, b) => b[1].length - a[1].length).map(([k, ages]) => {
  const mean = (ages.reduce((s, a) => s + a, 0) / ages.length).toFixed(1);
  return `| [[regions/${slug(k)}|${k}]] | ${mean} | ${Math.min(...ages)} | ${Math.max(...ages)} | ${ages.length} |`;
}).join('\n')}

## Monthly Volume

| Month | Reports |
|---|---|
${Object.entries(monthlyVolume).sort().map(([k, v]) => `| ${k} | ${v} |`).join('\n')}

## Sex-Specific Pathology Patterns

### Top pathologies — Males

| Pathology | Count |
|---|---|
${Object.entries(malePathCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `| [[pathologies/${slug(k)}|${k}]] | ${v} |`).join('\n')}

### Top pathologies — Females

| Pathology | Count |
|---|---|
${Object.entries(femalePathCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `| [[pathologies/${slug(k)}|${k}]] | ${v} |`).join('\n')}

## Pediatric Cases (≤18 years)

| # | Date | Patient ID | Age | Sex | DOB | Region | Study | Source |
|---|---|---|---|---|---|---|---|---|
${pediatric.map((c, i) => {
  const study = (c.studyType || '').substring(0, 50).replace(/\|/g, '\\|');
  return `| ${i + 1} | ${c.date} | ${c.patientId} | ${c.age} | ${c.sex} | ${c.dob} | ${c.bodyRegion} | ${study} | ${c.source} |`;
}).join('\n')}

---
→ Back to [[overview]] | [[index]]
`;

  fs.writeFileSync(path.join(WIKI, 'analysis', 'demographics.md'), md, 'utf-8');
  console.log('✓ analysis/demographics.md');
}

// ============================================================
// CLINICAL PATTERNS
// ============================================================
function buildClinicalPatterns() {
  ensureDir(path.join(WIKI, 'analysis'));
  
  // Co-occurrence matrix for top pathologies
  const topPaths = Object.entries(stats.pathCounts).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k]) => k);
  const coMatrix = {};
  for (const p1 of topPaths) {
    coMatrix[p1] = {};
    for (const p2 of topPaths) {
      coMatrix[p1][p2] = 0;
    }
  }
  for (const r of reports) {
    for (const p1 of r.pathologies) {
      if (!topPaths.includes(p1)) continue;
      for (const p2 of r.pathologies) {
        if (!topPaths.includes(p2) || p1 === p2) continue;
        coMatrix[p1][p2]++;
      }
    }
  }
  
  // Most common clinical presentations
  const clinicalMap = {};
  for (const r of reports) {
    if (r.clinicalProfile) {
      const normalized = r.clinicalProfile.toLowerCase();
      if (normalized.includes('pain')) clinicalMap['Pain'] = (clinicalMap['Pain'] || 0) + 1;
      if (normalized.includes('swelling')) clinicalMap['Swelling'] = (clinicalMap['Swelling'] || 0) + 1;
      if (normalized.includes('trauma') || normalized.includes('injury') || normalized.includes('rta')) clinicalMap['Trauma/Injury'] = (clinicalMap['Trauma/Injury'] || 0) + 1;
      if (normalized.includes('weakness') || normalized.includes('numbness')) clinicalMap['Weakness/Numbness'] = (clinicalMap['Weakness/Numbness'] || 0) + 1;
      if (normalized.includes('fall')) clinicalMap['Fall'] = (clinicalMap['Fall'] || 0) + 1;
      if (normalized.includes('sports') || normalized.includes('football') || normalized.includes('cricket')) clinicalMap['Sports Injury'] = (clinicalMap['Sports Injury'] || 0) + 1;
      if (normalized.includes('restrict') || normalized.includes('limited')) clinicalMap['Restricted Movement'] = (clinicalMap['Restricted Movement'] || 0) + 1;
      if (normalized.includes('lock')) clinicalMap['Locking'] = (clinicalMap['Locking'] || 0) + 1;
      if (normalized.includes('radiculopathy') || normalized.includes('radiat')) clinicalMap['Radiculopathy'] = (clinicalMap['Radiculopathy'] || 0) + 1;
    }
  }
  
  // Workstation distribution
  const wpMap = {};
  for (const r of reports) {
    wpMap[r.workplace] = (wpMap[r.workplace] || 0) + 1;
  }
  
  // Normal/unremarkable studies count
  const normalStudies = reports.filter(r => {
    const imp = (r.impression || '').toLowerCase();
    return imp.includes('no significant') || imp.includes('normal study') || imp.includes('unremarkable') || imp.includes('no abnormality');
  });
  
  let md = `---
title: "Clinical Patterns & Insights"
type: analysis
created: ${new Date().toISOString().split('T')[0]}
---

# Clinical Patterns & Insights

## Key Findings

- **Most common region**: Cervical Spine (${stats.regionCounts['Cervical Spine']} cases, ${((stats.regionCounts['Cervical Spine'] / reports.length) * 100).toFixed(1)}%)
- **Most common pathology**: Degenerative Changes (${stats.pathCounts['Degenerative Changes']} cases, ${((stats.pathCounts['Degenerative Changes'] / reports.length) * 100).toFixed(1)}%)
- **Near-normal / unremarkable studies**: ~${normalStudies.length} reports
- **Peak age group**: 41–60 years (${stats.ageBuckets['41-60']} cases)

## Clinical Presentations

| Presentation | Frequency |
|---|---|
${Object.entries(clinicalMap).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} |`).join('\n')}

## MRI Workstation Distribution

| Workplace | Reports | % |
|---|---|---|
${Object.entries(wpMap).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} | ${((v / reports.length) * 100).toFixed(1)}% |`).join('\n')}

## Pathology Co-occurrence (Top 10 pairs)

${(() => {
  const pairs = [];
  for (const p1 of topPaths) {
    for (const p2 of topPaths) {
      if (p1 < p2 && coMatrix[p1][p2] > 0) {
        pairs.push({ p1, p2, count: coMatrix[p1][p2] });
      }
    }
  }
  pairs.sort((a, b) => b.count - a.count);
  let table = '| Pathology A | Pathology B | Co-occurrence |\n|---|---|---|\n';
  for (const { p1, p2, count } of pairs.slice(0, 15)) {
    table += `| [[pathologies/${slug(p1)}|${p1}]] | [[pathologies/${slug(p2)}|${p2}]] | ${count} |\n`;
  }
  return table;
})()}

## Incidental Findings

Common incidental findings across MSK MRI reports:

| Finding | Estimated Count |
|---|---|
| [[pathologies/hemangioma|Vertebral Hemangioma]] | ${stats.pathCounts['Hemangioma'] || 0} |
| [[pathologies/lipoma|Lipoma]] | ${stats.pathCounts['Lipoma'] || 0} |
| [[pathologies/ganglion-cyst|Ganglion Cyst]] | ${stats.pathCounts['Ganglion Cyst'] || 0} |
| [[pathologies/baker-cyst|Baker Cyst]] | ${stats.pathCounts['Baker Cyst'] || 0} |
| Renal Cysts (noted in spine studies) | ~frequent (see reports) |

## Pattern: Spine Cascade

The classic degenerative spine cascade is the dominant pattern in this dataset:
1. **[[pathologies/disc-desiccation|Disc Desiccation]]** (${stats.pathCounts['Disc Desiccation']}) → earliest sign
2. **[[pathologies/disc-bulge-herniation|Disc Bulge/Herniation]]** (${stats.pathCounts['Disc Bulge/Herniation']}) → progression
3. **[[pathologies/annular-tear|Annular Tear]]** (${stats.pathCounts['Annular Tear'] || 0}) → disc integrity failure
4. **[[pathologies/spinal-stenosis|Spinal Stenosis]]** (${stats.pathCounts['Spinal Stenosis']}) → canal compromise
5. **[[pathologies/cord-signal-changes|Cord Signal Changes]]** (${stats.pathCounts['Cord Signal Changes']}) → neural impact
6. **[[pathologies/myelopathy|Myelopathy]]** (${stats.pathCounts['Myelopathy']}) → clinical myelopathy

---
→ Back to [[overview]] | [[index]]
`;

  fs.writeFileSync(path.join(WIKI, 'analysis', 'clinical-patterns.md'), md, 'utf-8');
  console.log('✓ analysis/clinical-patterns.md');
}

// ============================================================
// INDEX
// ============================================================
function buildIndex() {
  const regionEntries = Object.entries(stats.regionCounts).sort((a, b) => b[1] - a[1]);
  const pathEntries = Object.entries(stats.pathCounts).sort((a, b) => b[1] - a[1]);
  const docEntries = Object.entries(stats.doctorCounts).filter(([k]) => k !== '').sort((a, b) => b[1] - a[1]);
  
  let md = `---
title: "Wiki Index"
type: index
created: ${new Date().toISOString().split('T')[0]}
total_pages: ${regionEntries.length + pathEntries.length + docEntries.length + 4}
---

# 📖 Wiki Index

Complete catalog of all pages in the MSK MRI Knowledge Base.

## Core Pages

| Page | Description |
|---|---|
| [[overview]] | Dashboard — aggregate stats, key metrics, quick navigation |
| [[log]] | Chronological record of wiki operations |

## Analysis Pages

| Page | Description |
|---|---|
| [[analysis/demographics]] | Age, sex distribution, monthly volumes, pediatric/geriatric cases |
| [[analysis/clinical-patterns]] | Co-occurrence patterns, incidental findings, spine cascade |

## Region Pages

| Page | Cases | Description |
|---|---|---|
${regionEntries.map(([k, v]) => `| [[regions/${slug(k)}]] | ${v} | All ${k} MRI reports with pathology breakdown |`).join('\n')}

## Pathology Pages

| Page | Cases | Prevalence |
|---|---|---|
${pathEntries.map(([k, v]) => `| [[pathologies/${slug(k)}]] | ${v} | ${((v / reports.length) * 100).toFixed(1)}% |`).join('\n')}

## Radiologist Pages

| Page | Reports |
|---|---|
${docEntries.map(([k, v]) => `| [[radiologists/${slug(k)}]] | ${v} |`).join('\n')}

---
*Index auto-generated. ${regionEntries.length + pathEntries.length + docEntries.length + 4} total pages.*
`;

  fs.writeFileSync(path.join(WIKI, 'index.md'), md, 'utf-8');
  console.log('✓ index.md');
}

// ============================================================
// INDIVIDUAL REPORT PAGES
// ============================================================
function buildReportPages() {
  ensureDir(path.join(WIKI, 'reports'));
  
  let count = 0;
  for (const r of reports) {
    const reportTextClean = (r.reportText || '')
      .replace(/\|/g, '\\|')
      .replace(/\t/g, '  ');
    
    const pathLinks = r.pathologies.map(p => `[[pathologies/${slug(p)}|${p}]]`).join(', ') || 'None identified';
    const doctorLink = r.doctor ? `[[radiologists/${slug(r.doctor)}|${r.doctor}]]` : 'Not specified';
    const regionLink = `[[regions/${slug(r.bodyRegion)}|${r.bodyRegion}]]`;
    
    let md = `---
title: "Report: ${r.patientId} — ${r.date}"
type: report
patient_id: "${r.patientId}"
date: "${r.date}"
dob: "${r.dob}"
age: ${r.age}
sex: "${r.sex}"
region: "${r.bodyRegion}"
doctor: "${r.doctor || ''}"
source: "${r.source}"
created: ${new Date().toISOString().split('T')[0]}
---

# 📋 MRI Report — Patient ${r.patientId}

## Demographics

| Field | Value |
|---|---|
| **Date** | ${r.date} |
| **Patient ID** | ${r.patientId} |
| **Age** | ${r.age} years |
| **Sex** | ${r.sex} |
| **DOB** | ${r.dob} |
| **Workplace** | ${r.workplace || '—'} |

## Study

| Field | Value |
|---|---|
| **Study Type** | ${r.studyType || '—'} |
| **Body Region** | ${regionLink} |
| **Reporting Doctor** | ${doctorLink} |
| **Source File** | \`${r.source}\` |

## Clinical Profile

${r.clinicalProfile || '_Not recorded_'}

## Full Report Text

\`\`\`
${reportTextClean}
\`\`\`

## Impression

> ${(r.impression || '_No impression recorded_').replace(/\n/g, '\n> ')}

## Pathologies Identified

${pathLinks}

---
→ Back to ${regionLink} | [[overview]] | [[index]]
`;

    fs.writeFileSync(path.join(WIKI, 'reports', `${r._slug}.md`), md, 'utf-8');
    count++;
  }
  console.log(`✓ reports/ (${count} individual report pages)`);
}

// ============================================================
// LOG
// ============================================================
function buildLog() {
  const now = new Date().toISOString().split('T')[0];
  
  let md = `---
title: "Wiki Log"
type: log
---

# 📝 Wiki Log

Chronological record of wiki operations.

## [${now}] ingest | MRI MSK LAST 2 YEARS.txt
- Source: \`raw/MRI MSK LAST 2 YEARS.txt\` (12.8 MB)
- Date range: 01.01.2023 – 01.01.2025
- Reports parsed: ${reports.filter(r => r.source === 'MRI MSK LAST 2 YEARS.txt').length}
- Pages created/updated: overview, ${Object.keys(stats.regionCounts).length} region pages, ${Object.keys(stats.pathCounts).length} pathology pages
- Radiologists identified: ${Object.keys(stats.doctorCounts).filter(k => k !== '').length}

## [${now}] ingest | MRI MSK.txt
- Source: \`raw/MRI MSK.txt\` (2.7 MB)
- Date range: 01.06.2025 – 30.03.2026
- Reports parsed: ${reports.filter(r => r.source === 'MRI MSK.txt').length}
- Pages created/updated: merged into existing wiki pages

## [${now}] build | Initial Wiki Generation
- Total reports ingested: ${reports.length}
- Wiki pages created: ${Object.keys(stats.regionCounts).length + Object.keys(stats.pathCounts).length + Object.keys(stats.doctorCounts).filter(k => k !== '').length + 4}
- Architecture: Three-layer (raw → wiki → schema) per Karpathy llm-wiki pattern
- Features: Full patient traceability (IDs, DOB, demographics) in case registries
`;

  fs.writeFileSync(path.join(WIKI, 'log.md'), md, 'utf-8');
  console.log('✓ log.md');
}

// ============================================================
// RUN ALL
// ============================================================
console.log('Building MSK MRI wiki...\n');
buildOverview();
buildReportPages();
buildRegionPages();
buildPathologyPages();
buildRadiologistPages();
buildDemographics();
buildClinicalPatterns();
buildIndex();
buildLog();

// Count total pages
let pageCount = 0;
function countMd(dir) {
  for (const f of fs.readdirSync(dir)) {
    const fp = path.join(dir, f);
    if (fs.statSync(fp).isDirectory()) countMd(fp);
    else if (f.endsWith('.md')) pageCount++;
  }
}
countMd(WIKI);

// Bridge to Web Application:
const WEB_DATA_DIR = path.join(__dirname, 'web-app', 'public', 'data');
if (fs.existsSync(WEB_DATA_DIR)) {
  fs.copyFileSync(path.join(__dirname, 'parsed_reports.json'), path.join(WEB_DATA_DIR, 'parsed_reports.json'));
  fs.copyFileSync(path.join(__dirname, 'stats.json'), path.join(WEB_DATA_DIR, 'stats.json'));
  console.log('✓ Cloned datastore to Web Application');
}

console.log(`\n✅ Wiki built! ${pageCount} total markdown pages.`);
