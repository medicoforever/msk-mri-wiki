# MSK MRI Knowledge Base — Schema (AGENTS.md)

> This file tells the LLM how the wiki is structured. It's the configuration file
> that makes the LLM a disciplined wiki maintainer rather than a generic chatbot.
> Architecture follows [Karpathy's llm-wiki pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f).

## Three-Layer Architecture

```
d:\DESKTOP\MSKREPORTS\
├── raw/                      # Layer 1: Immutable source files (never modify)
│   ├── MRI MSK LAST 2 YEARS.txt    (01.01.2023–01.01.2025, ~5,529 reports)
│   └── MRI MSK.txt                  (01.06.2025–30.03.2026, ~1,068 reports)
├── wiki/                     # Layer 2: LLM-generated markdown wiki (LLM owns this)
│   ├── index.md              # Content catalog — read this FIRST to navigate
│   ├── log.md                # Chronological operation log (append-only)
│   ├── overview.md           # Dashboard with aggregate stats
│   ├── regions/              # One page per body region (18 pages)
│   ├── pathologies/          # One page per pathology concept (46 pages)
│   ├── radiologists/         # One page per reporting doctor (30 pages)
│   ├── reports/              # One page per MRI report (6,248 pages)
│   └── analysis/             # Cross-cutting analytics
│       ├── demographics.md
│       └── clinical-patterns.md
├── parsed_reports.json       # Structured JSON of all 6,597 reports
├── stats.json                # Aggregate statistics
└── AGENTS.md                 # Layer 3: This file (schema/conventions)
```

## Source Format

Each report in the raw text files has this structure:
```
DD.MM.YYYY;sex;DD.MM.YYYY(DOB);workplace;patientID;age;[extra fields]

MRI STUDY TYPE AND BODY REGION
Clinical Profile: ...
Technique: ...
[Findings...]
IMPRESSION: ...
Suggested clinical correlation...Dr. Name---...
```

## Page Types & Templates

### Body Region Page (`regions/*.md`)
- Frontmatter: title, type=body_region, region, total_cases
- Sections: Demographics, Pathology Breakdown, Reporting Doctors, Case Registry
- Case Registry includes: Date, Patient ID, Age, Sex, Study, Impression, Doctor, Source file

### Pathology Page (`pathologies/*.md`)
- Frontmatter: title, type=pathology, total_cases, prevalence
- Sections: Demographics, Distribution by Region, Co-occurring Pathologies, Case Registry
- Case Registry includes: Date, Patient ID, Age, Sex, DOB, Region, Impression, Doctor, Source

### Radiologist Page (`radiologists/*.md`)
- Frontmatter: title, type=radiologist, total_reports
- Sections: Workload by Region, Top Pathologies, Recent Cases

### Report Page (`reports/*.md`)
- Filename: `{patientId}-{YYYYMMDD}[-n].md` (n for duplicates)
- Frontmatter: title, type=report, patient_id, date, dob, age, sex, region, doctor, source
- Sections: Demographics, Study, Clinical Profile, Full Report Text, Impression, Pathologies Identified
- Links: Region wikilink, Doctor wikilink, Pathology wikilinks
- Case tables in region/pathology/radiologist pages link Patient ID to these report pages

### Analysis Page (`analysis/*.md`)
- Free-form analysis pages with cross-references to regions/pathologies

## Conventions

1. **Wikilinks**: Use `[[path/slug|Display Name]]` for all cross-references
2. **Slugs**: lowercase, hyphens, no special chars (e.g., `disc-bulge-herniation`)
3. **Patient Data**: Include full patient IDs, DOB, demographics for source traceability
4. **Case Tables**: Always include Source column pointing to raw file name
5. **Frontmatter**: YAML with title, type, created date, and type-specific metadata

## Operations

### Ingest (adding new source files)
1. Copy new file to `raw/`
2. Parse with `parse_reports.js` (or extend it)
3. Rebuild wiki with `build_wiki.js`
4. Append entry to `wiki/log.md`

### Query (asking questions)
1. Read `wiki/index.md` to find relevant pages
2. Drill into specific pages
3. Synthesize answer with citations to wiki pages
4. If the answer is valuable, file it as a new analysis page

### Lint (health check)
1. Check for orphan pages with no inbound links
2. Verify all wikilinks resolve
3. Look for contradictions between pages
4. Identify pathologies mentioned but lacking their own page
5. Check for new source data that hasn't been ingested

## Key Statistics (current)

- **Total Reports**: 6,597 (6,248 MSK + 349 non-MSK filtered out)
- **Body Regions**: 18
- **Pathologies Tracked**: 46
- **Radiologists**: 30
- **Date Range**: 01.01.2023 – 30.03.2026
- **Wiki Pages**: 6,349
