/**
 * MSK MRI Report Parser
 * Parses semicolon-delimited MRI reports from raw text files into structured JSON.
 * Each report block: demographics line → blank line → report text → separator dashes
 */

const fs = require('fs');
const path = require('path');

function parseFile(filePath, sourceLabel) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const reports = [];
  
  // Split into lines
  const lines = content.split(/\r?\n/);
  
  let i = 0;
  // Skip header lines (Search criteria, Date range, column header)
  while (i < lines.length && !lines[i].match(/^\d{2}\.\d{2}\.\d{4};/)) {
    i++;
  }
  
  while (i < lines.length) {
    // Look for a demographics line: DD.MM.YYYY;sex;DOB;workplace;patientID;age;...
    const line = lines[i].trim();
    const demoMatch = line.match(/^(\d{2}\.\d{2}\.\d{4});(male|female);(\d{2}\.\d{2}\.\d{4});([^;]*);(\d+);(\d+)/i);
    
    if (demoMatch) {
      const demo = {
        date: demoMatch[1],
        sex: demoMatch[2],
        dob: demoMatch[3],
        workplace: demoMatch[4],
        patientId: demoMatch[5],
        age: parseInt(demoMatch[6]),
        source: sourceLabel
      };
      
      // Next lines should be blank then report text
      i++;
      // Skip blank lines
      while (i < lines.length && lines[i].trim() === '') i++;
      
      // Collect report text until next demographics line or end
      let reportText = '';
      while (i < lines.length) {
        const nextLine = lines[i].trim();
        // Check if this is a new demographics line
        if (nextLine.match(/^\d{2}\.\d{2}\.\d{4};(male|female);/i)) {
          break;
        }
        if (nextLine !== '') {
          reportText += (reportText ? '\n' : '') + nextLine;
        }
        i++;
      }
      
      // Clean up separator dashes from report text
      reportText = reportText.replace(/-{20,}/g, '').trim();
      
      // Extract study type from the beginning
      const studyMatch = reportText.match(/^(MRI\s+(?:SCAN\s+)?(?:OF\s+)?[A-Z\s\/]+?)(?:Clinical|clinical|Technique|And\s+screening)/i);
      let studyType = '';
      if (studyMatch) {
        studyType = studyMatch[1].trim().replace(/\s+/g, ' ');
      } else {
        // Try broader match
        const broadMatch = reportText.match(/^(MRI[^.]+?)(?:Clinical|Technique)/i);
        if (broadMatch) {
          studyType = broadMatch[1].trim().replace(/\s+/g, ' ');
        }
      }
      
      // Extract impression
      let impression = '';
      const impMatch = reportText.match(/IMPRESSION\s*:?\s*([\s\S]*?)(?:Suggested\s+clinical|Dr[.\s])/i);
      if (impMatch) {
        impression = impMatch[1].trim()
          .replace(/"/g, '')
          .replace(/\t/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
      
      // Extract doctor name
      let doctor = '';
      const docMatch = reportText.match(/(?:Dr\.?\s*|Dr\s+)([A-Za-z\s]+?)(?:\s*-{3,}|\s*$)/i);
      if (docMatch) {
        doctor = 'Dr. ' + docMatch[1].trim().replace(/\s+/g, ' ');
        doctor = normalizeDoctorName(doctor);
      }
      
      // Extract clinical profile
      let clinicalProfile = '';
      const clinMatch = reportText.match(/Clinical\s+[Pp]rofile\s*:?\s*(.*?)(?:Technique|\.(?:\s*Technique))/i);
      if (clinMatch) {
        clinicalProfile = clinMatch[1].trim().replace(/\s+/g, ' ');
      }
      
      // Classify body region
      const bodyRegion = classifyRegion(studyType, reportText);
      
      // Extract key findings/pathologies
      const pathologies = extractPathologies(reportText, impression);
      
      if (reportText.length > 50) {
        reports.push({
          ...demo,
          studyType,
          clinicalProfile,
          bodyRegion,
          reportText,
          impression,
          doctor,
          pathologies
        });
      }
    } else {
      i++;
    }
  }
  
  return reports;
}

// ============================================================
// DOCTOR NAME NORMALIZATION
// ============================================================
const DOCTOR_ALIASES = {
  'Dr. Barani gomathy': 'Dr. Barani Gomathy',
  'Dr. Lokesh': 'Dr. V Lokesh',
  'Dr. P Manthreswar': 'Dr. P Manthreshwar',
  'Dr. Manthreshwar': 'Dr. P Manthreshwar',
  'Dr. Thamaraikkkannan': 'Dr. Thamaraikkannan',
  'Dr. Sathismani': 'Dr. Sathishmani',
  'Dr. Prakhyath Gambhira': 'Dr. Prakhyath',
  'Dr. Barani': 'Dr. Barani Gomathy',
  'Dr. Ramkumaran R': 'Dr. Ramkumaran',
};

function normalizeDoctorName(name) {
  return DOCTOR_ALIASES[name] || name;
}

// ============================================================
// REGION CLASSIFICATION — study type takes priority over report text
// ============================================================
function classifyRegionFromText(text) {
  // Filter out non-MSK studies
  if (text.includes('BRAIN')) return 'Non-MSK';
  
  // Spine — order matters: most specific first
  if (text.includes('LUMBOSACRAL') || text.includes('LUMBAR SPINE') || text.includes('LS SPINE') || text.includes('L-SPINE')) return 'Lumbosacral Spine';
  if (text.includes('DORSAL SPINE') || text.includes('THORACIC SPINE') || text.includes('D-SPINE')) return 'Dorsal Spine';
  if (text.includes('CERVICAL SPINE') || text.includes('C-SPINE') || text.includes('CERVICAL')) return 'Cervical Spine';
  if (text.includes('WHOLE SPINE')) return 'Spine (General)';
  
  // Extremities
  if (text.includes('SHOULDER')) return 'Shoulder';
  if (text.includes('KNEE')) return 'Knee';
  if (text.includes('HIP') || text.includes('PELVIS') || text.includes('BONY PELVIS')) return 'Hip/Pelvis';
  if (text.includes('ANKLE') || text.includes('FOOT')) return 'Ankle/Foot';
  if (text.includes('WRIST') || text.includes('HAND') || text.includes('THUMB')) return 'Wrist/Hand';
  if (text.includes('ELBOW')) return 'Elbow';
  if (text.includes('SI JOINT') || text.includes('SACROILIAC')) return 'SI Joint';
  if (text.includes('TEMPOROMANDIBULAR') || text.includes('TMJ')) return 'TMJ';
  if (text.includes('BRACHIAL PLEXUS')) return 'Brachial Plexus';
  if (text.includes('THIGH') || text.includes('FEMUR')) return 'Thigh/Femur';
  if (text.includes('LEG') || text.includes('TIBIA') || text.includes('CALF')) return 'Leg/Tibia';
  if (text.includes('FOREARM') || text.includes('ARM')) return 'Forearm';
  if (text.includes('NECK')) return 'Neck Soft Tissue';
  if (text.includes('THORAX') || text.includes('BONY THORAX')) return 'Thorax/Chest Wall';
  
  return null; // no match
}

function classifyRegion(studyType, reportText) {
  // STEP 1: Try study type alone (most reliable — it's the ordered exam)
  if (studyType) {
    const st = studyType.toUpperCase();
    const fromStudy = classifyRegionFromText(st);
    if (fromStudy) return fromStudy;
  }
  
  // STEP 2: Fall back to report text, but only the FIRST 3 lines
  // (avoids misclassification from "screening of rest of spine" mentions)
  const firstLines = reportText.split('\n').slice(0, 3).join(' ').toUpperCase();
  const fromHeader = classifyRegionFromText(firstLines);
  if (fromHeader) return fromHeader;
  
  // STEP 3: Last resort — full text (only for extremities, NOT spine)
  const fullText = reportText.toUpperCase();
  if (fullText.includes('SHOULDER')) return 'Shoulder';
  if (fullText.includes('KNEE')) return 'Knee';
  if (fullText.includes('ANKLE') || fullText.includes('FOOT')) return 'Ankle/Foot';
  
  return 'Other MSK';
}

function extractPathologies(reportText, impression) {
  const text = (reportText + ' ' + impression).toUpperCase();
  const found = [];
  
  const pathologyPatterns = [
    { pattern: /DISC\s*(?:BULGE|HERNIAT|PROTRUS|EXTRUS)/i, label: 'Disc Bulge/Herniation' },
    { pattern: /DISC\s*DESICCAT/i, label: 'Disc Desiccation' },
    { pattern: /SPINAL\s*(?:CANAL\s*)?STENO/i, label: 'Spinal Stenosis' },
    { pattern: /FORAMINAL\s*(?:STENO|NARROW)/i, label: 'Foraminal Stenosis' },
    { pattern: /SPONDYLOL(?:IS)?THESIS/i, label: 'Spondylolisthesis' },
    { pattern: /SPONDYLOL(?:Y)?SIS\b/i, label: 'Spondylolysis' },
    { pattern: /COMPRESS(?:ION)?\s*FRACTURE/i, label: 'Compression Fracture' },
    { pattern: /FRACTURE/i, label: 'Fracture' },
    { pattern: /ROTATOR\s*CUFF\s*TEAR/i, label: 'Rotator Cuff Tear' },
    { pattern: /SUPRASPINATUS\s*(?:TEAR|TENDIN)/i, label: 'Supraspinatus Pathology' },
    { pattern: /SUBSCAPULARIS\s*(?:TEAR|TENDIN)/i, label: 'Subscapularis Pathology' },
    { pattern: /INFRASPINATUS\s*(?:TEAR|TENDIN)/i, label: 'Infraspinatus Pathology' },
    { pattern: /LABR(?:AL|UM)\s*TEAR/i, label: 'Labral Tear' },
    { pattern: /MENISCAL?\s*TEAR/i, label: 'Meniscal Tear' },
    { pattern: /MENISCUS\s*TEAR/i, label: 'Meniscal Tear' },
    { pattern: /(?:ACL|ANTERIOR\s*CRUCIATE)\s*(?:TEAR|RUPTURE|INJUR)/i, label: 'ACL Injury' },
    { pattern: /(?:PCL|POSTERIOR\s*CRUCIATE)\s*(?:TEAR|RUPTURE|INJUR)/i, label: 'PCL Injury' },
    { pattern: /(?:MCL|MEDIAL\s*COLLATERAL)\s*(?:TEAR|RUPTURE|INJUR|SPRAIN)/i, label: 'MCL Injury' },
    { pattern: /(?:LCL|LATERAL\s*COLLATERAL)\s*(?:TEAR|RUPTURE|INJUR)/i, label: 'LCL Injury' },
    { pattern: /LIGAMENT\s*(?:TEAR|RUPTURE|INJUR)/i, label: 'Ligament Injury' },
    { pattern: /BONE\s*(?:MARROW\s*)?(?:EDEMA|CONTUS|BRUIS)/i, label: 'Bone Marrow Edema' },
    { pattern: /OSTEOCHOND(?:RAL|RITIS)/i, label: 'Osteochondral Lesion' },
    { pattern: /AVASCULAR\s*NECROSIS|AVN|OSTEONECROSIS/i, label: 'Avascular Necrosis' },
    { pattern: /OSTEOARTHRI/i, label: 'Osteoarthritis' },
    { pattern: /DEGENERATIVE/i, label: 'Degenerative Changes' },
    { pattern: /TENDIN(?:OSIS|OPATHY|ITIS)/i, label: 'Tendinopathy' },
    { pattern: /(?:BAKER|POPLITEAL)\s*CYST/i, label: 'Baker Cyst' },
    { pattern: /EFFUSION/i, label: 'Joint Effusion' },
    { pattern: /SYNOVITIS/i, label: 'Synovitis' },
    { pattern: /TUMOU?R|MASS\s*LESION|NEOPLASM/i, label: 'Tumor/Mass' },
    { pattern: /HEMANGIOMA/i, label: 'Hemangioma' },
    { pattern: /LIPOMA/i, label: 'Lipoma' },
    { pattern: /GANGLION/i, label: 'Ganglion Cyst' },
    { pattern: /INFECTION|OSTEOMYELITIS|ABSCESS/i, label: 'Infection' },
    { pattern: /PLANTAR\s*FASCI/i, label: 'Plantar Fasciitis' },
    { pattern: /ACHILLES/i, label: 'Achilles Tendon Pathology' },
    { pattern: /CARPAL\s*TUNNEL/i, label: 'Carpal Tunnel Syndrome' },
    { pattern: /NERVE\s*(?:ROOT\s*)?COMPRESS/i, label: 'Nerve Compression' },
    { pattern: /RADICULOPATHY/i, label: 'Radiculopathy' },
    { pattern: /MYELOPATHY/i, label: 'Myelopathy' },
    { pattern: /MODIC/i, label: 'Modic Changes' },
    { pattern: /SCHMORL/i, label: 'Schmorl Node' },
    { pattern: /ANNULAR\s*(?:TEAR|FISSURE)/i, label: 'Annular Tear' },
    { pattern: /SACROILIITIS/i, label: 'Sacroiliitis' },
    { pattern: /ANKYLOSING/i, label: 'Ankylosing Spondylitis' },
    { pattern: /MARROW\s*(?:SIGNAL\s*)?(?:ABNORMAL|INFILTRAT|REPLAC)/i, label: 'Marrow Signal Abnormality' },
    { pattern: /CORD\s*(?:SIGNAL\s*)?(?:CHANGE|ABNORMAL|MYELOPATHY)/i, label: 'Cord Signal Changes' },
  ];
  
  for (const { pattern, label } of pathologyPatterns) {
    if (pattern.test(text) && !found.includes(label)) {
      found.push(label);
    }
  }
  
  return found;
}

// ============================================================
// MAIN
// ============================================================

console.log('Parsing MRI MSK LAST 2 YEARS.txt...');
const reports1 = parseFile(path.join(__dirname, 'raw', 'MRI MSK LAST 2 YEARS.txt'), 'MRI MSK LAST 2 YEARS.txt');
console.log(`  Found ${reports1.length} reports`);

console.log('Parsing MRI MSK.txt...');
const reports2 = parseFile(path.join(__dirname, 'raw', 'MRI MSK.txt'), 'MRI MSK.txt');
console.log(`  Found ${reports2.length} reports`);

const allReports = [...reports1, ...reports2];
console.log(`Total reports: ${allReports.length}`);

// Save parsed JSON
fs.writeFileSync(
  path.join(__dirname, 'parsed_reports.json'),
  JSON.stringify(allReports, null, 2),
  'utf-8'
);
console.log('Saved parsed_reports.json');

// Print stats
const regionCounts = {};
const pathCounts = {};
const doctorCounts = {};
const sexCounts = {};
const ageBuckets = { '0-20': 0, '21-40': 0, '41-60': 0, '61-80': 0, '80+': 0 };

for (const r of allReports) {
  regionCounts[r.bodyRegion] = (regionCounts[r.bodyRegion] || 0) + 1;
  doctorCounts[r.doctor] = (doctorCounts[r.doctor] || 0) + 1;
  sexCounts[r.sex] = (sexCounts[r.sex] || 0) + 1;
  
  const age = r.age;
  if (age <= 20) ageBuckets['0-20']++;
  else if (age <= 40) ageBuckets['21-40']++;
  else if (age <= 60) ageBuckets['41-60']++;
  else if (age <= 80) ageBuckets['61-80']++;
  else ageBuckets['80+']++;
  
  for (const p of r.pathologies) {
    pathCounts[p] = (pathCounts[p] || 0) + 1;
  }
}

console.log('\n=== BODY REGIONS ===');
Object.entries(regionCounts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

console.log('\n=== TOP PATHOLOGIES ===');
Object.entries(pathCounts).sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

console.log('\n=== DOCTORS ===');
Object.entries(doctorCounts).sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

console.log('\n=== SEX DISTRIBUTION ===');
Object.entries(sexCounts).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

console.log('\n=== AGE DISTRIBUTION ===');
Object.entries(ageBuckets).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

// Save stats for wiki builder
fs.writeFileSync(
  path.join(__dirname, 'stats.json'),
  JSON.stringify({ regionCounts, pathCounts, doctorCounts, sexCounts, ageBuckets, totalReports: allReports.length }, null, 2),
  'utf-8'
);
console.log('\nSaved stats.json');
