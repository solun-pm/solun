# Schema.org Quick Start Guide

**TL;DR:** Your schema is good but missing key opportunities. Score: 72/100

---

## Critical Fixes (Do These First!)

### 1. Add Dates to Articles (URGENT - 1 hour)

All `/learn/*` articles need these two properties:

```json
"datePublished": "2024-06-15T00:00:00Z",
"dateModified": "2026-02-20T00:00:00Z"
```

**Why:** Without dates, your articles won't get rich results in Google Search.

**Where:** Every Article schema block on /learn pages

**How to find the dates:**
```bash
# Get file creation date from git
git log --follow --format=%aI --reverse path/to/article.md | head -1

# Get last modification date
git log --format=%aI -1 path/to/article.md
```

---

### 2. Add Logo to Organization (15 minutes)

```json
"logo": {
  "@type": "ImageObject",
  "url": "https://solun.pm/logo.svg",
  "width": 512,
  "height": 512
}
```

**Why:** Required for Google Knowledge Panel eligibility.

**Where:** Homepage Organization schema

---

### 3. Replace Homepage Schema (30 minutes)

Replace your current homepage schema with the content from:
`schema-implementations/homepage-enhanced.json`

**Why:** Adds SoftwareApplication schema (huge SEO boost for "pastebin alternative" searches)

---

## High-Impact Additions

### 4. Add Breadcrumbs (2-3 hours)

Use `breadcrumb-template.json` for all /learn pages.

**Visual result in Google:**
```
Home > Learn > Secure Paste Sharing
```

---

## File Guide

| File | Purpose | Priority |
|------|---------|----------|
| `homepage-enhanced.json` | Complete homepage schema | 🔴 High |
| `article-template.json` | Template for all articles | 🔴 High |
| `breadcrumb-template.json` | Breadcrumb navigation | 🟡 Medium |
| `example-secure-paste-sharing-complete.json` | Real-world example | 📘 Reference |

---

## Testing

After each change:

1. **Validate:** https://search.google.com/test/rich-results
2. **Check syntax:** https://validator.schema.org/
3. **Verify:** Paste your page URL into the tester

---

## Expected Results

**After fixes:**
- ✅ Articles eligible for rich results
- ✅ Breadcrumbs in search results
- ✅ Software carousel eligible
- ✅ Knowledge Panel eligible
- ✅ Better rankings for "pastebin alternative"

---

## Need Help?

- Full guide: `README.md`
- Detailed analysis: `../schema-analysis-report.md`
- Comparison: `BEFORE_AFTER_COMPARISON.md`
