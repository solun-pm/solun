# Schema.org Implementation Guide for Solun

This folder contains ready-to-implement Schema.org structured data for Solun.pm.

## Files

### 1. `homepage-enhanced.json`
**Where to implement:** Homepage (https://solun.pm)

This comprehensive schema uses `@graph` to combine multiple schema types:
- **Organization**: Enhanced with logo, contact info, and social links
- **WebSite**: Includes SearchAction for Google sitelinks search box
- **SoftwareApplication**: Positions Solun as a software tool (KEY for SEO)
- **Service**: Details the services offered

**How to implement in Next.js:**
```jsx
// In your app/page.tsx or app/layout.tsx
export const metadata = {
  // ... existing metadata
}

export default function HomePage() {
  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      // Paste the contents from homepage-enhanced.json here
    ]
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
      />
      {/* Rest of your page */}
    </>
  );
}
```

**Important replacements needed:**
- Update `softwareVersion` to match your actual version
- If you don't want SearchAction (no search function), remove that section
- Update `foundingDate` if you have a specific date

---

### 2. `article-template.json`
**Where to implement:** All /learn/* pages

This template provides complete Article schema with all required and recommended properties.

**Placeholders to replace:**
- `ARTICLE_TITLE_HERE` → Your article headline
- `ARTICLE_DESCRIPTION_HERE` → Article meta description
- `ARTICLE_URL_HERE` → Full URL to the article
- `YYYY-MM-DDTHH:MM:SSZ` → ISO 8601 date format (e.g., "2024-01-15T00:00:00Z")
- `ADD_RELEVANT_KEYWORDS_HERE` → Array of relevant keywords

**Example for "Secure Paste Sharing" article:**
```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Secure Paste Sharing",
  "description": "A practical guide to secure paste sharing, when to use it, and how to reduce leaks.",
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://solun.pm/learn/secure-paste-sharing"
  },
  "datePublished": "2024-06-15T00:00:00Z",
  "dateModified": "2026-02-20T00:00:00Z",
  "keywords": [
    "secure paste",
    "encrypted paste",
    "privacy",
    "pastebin alternative",
    "burn after read"
  ]
  // ... rest of schema
}
```

**CRITICAL:**
- `datePublished` and `dateModified` are REQUIRED for Google rich results
- Use actual publication/modification dates from your CMS or git history
- Image should be 1200x630px for optimal social sharing

---

### 3. `breadcrumb-template.json`
**Where to implement:** All /learn/* pages and /roadmap

Enables breadcrumb rich results in Google Search.

**Example for /learn/secure-paste-sharing:**
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://solun.pm"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Learn",
      "item": "https://solun.pm/learn"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Secure Paste Sharing",
      "item": "https://solun.pm/learn/secure-paste-sharing"
    }
  ]
}
```

**Note:** You can dynamically generate this based on URL path in Next.js.

---

## Implementation Priority

### Week 1 (Critical)
1. ✅ Implement `homepage-enhanced.json` on homepage
2. ✅ Add dates to existing Article schemas
3. ✅ Implement breadcrumbs on all /learn pages

### Week 2-3 (Important)
4. ✅ Add proper images to Article schemas
5. ✅ Validate all schema with Google Rich Results Test
6. ✅ Monitor Google Search Console for errors

---

## Testing Checklist

After implementing each schema:

1. **Validate JSON syntax**
   - Use a JSON validator to ensure no syntax errors
   - Check that all strings are properly escaped

2. **Test with Google Rich Results Test**
   - URL: https://search.google.com/test/rich-results
   - Paste your page URL or HTML code
   - Fix any errors or warnings

3. **Validate with Schema.org Validator**
   - URL: https://validator.schema.org/
   - Paste the JSON-LD code
   - Ensure it's valid Schema.org markup

4. **Check in Google Search Console**
   - Navigate to Enhancements section
   - Monitor for any schema errors
   - Check if rich results are being indexed

---

## Common Mistakes to Avoid

1. **Missing @context**
   - ALWAYS include `"@context": "https://schema.org"` at the top
   - Use HTTPS, not HTTP

2. **Placeholder text in production**
   - Never deploy with text like "[Business Name]" or "REPLACE_THIS"
   - All values must be real data

3. **Missing required properties**
   - Article: MUST have datePublished and dateModified
   - Organization: SHOULD have logo (required for Knowledge Panel)
   - Publisher in Article: MUST have logo

4. **Incorrect date format**
   - Use ISO 8601: "2024-01-15T00:00:00Z"
   - NOT: "January 15, 2024" or "01/15/2024"

5. **Relative URLs**
   - Use absolute URLs: "https://solun.pm/logo.svg"
   - NOT: "/logo.svg"

6. **Duplicate @context**
   - If using @graph, only one @context at the top
   - Each item in @graph should NOT have its own @context

---

## Dynamic Implementation (Next.js)

For automated schema generation, consider creating a utility function:

```typescript
// lib/schema-generator.ts

export function generateArticleSchema(article: {
  title: string;
  description: string;
  url: string;
  publishedAt: Date;
  modifiedAt: Date;
  keywords: string[];
  imageUrl?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": article.title,
    "description": article.description,
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": article.url
    },
    "datePublished": article.publishedAt.toISOString(),
    "dateModified": article.modifiedAt.toISOString(),
    "author": {
      "@type": "Organization",
      "name": "Solun",
      "@id": "https://solun.pm/#organization"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Solun",
      "@id": "https://solun.pm/#organization",
      "logo": {
        "@type": "ImageObject",
        "url": "https://solun.pm/logo.svg",
        "width": 512,
        "height": 512
      }
    },
    "image": article.imageUrl ? {
      "@type": "ImageObject",
      "url": article.imageUrl,
      "width": 1200,
      "height": 630
    } : undefined,
    "keywords": article.keywords,
    "articleSection": "Security Guides",
    "inLanguage": "en-US"
  };
}

export function generateBreadcrumbSchema(breadcrumbs: Array<{name: string, url: string}>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbs.map((crumb, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": crumb.name,
      "item": crumb.url
    }))
  };
}
```

---

## Expected SEO Impact

### Immediate (1-2 weeks)
- Breadcrumb rich results in Google Search
- Enhanced Organization snippet
- Proper indexing of Article content

### Medium-term (1-2 months)
- SoftwareApplication rich results for app-related searches
- Potential inclusion in "Pastebin alternative" comparison tables
- Improved click-through rates from enhanced snippets

### Long-term (3-6 months)
- Possible Google Knowledge Panel
- Featured snippets for "how to" queries
- Higher rankings for privacy tool searches

---

## Support

If you encounter issues:

1. **Validation errors**: Check for missing commas, quotes, or brackets
2. **Schema not appearing**: Wait 1-2 weeks for Google to recrawl
3. **Rich results not showing**: Ensure you meet Google's quality guidelines
4. **Questions**: Open an issue on GitHub or consult Google's structured data documentation

---

## Resources

- **Google Rich Results Test**: https://search.google.com/test/rich-results
- **Schema.org Validator**: https://validator.schema.org/
- **Google Search Central Docs**: https://developers.google.com/search/docs/appearance/structured-data
- **Schema.org Documentation**: https://schema.org/

---

**Last Updated:** 2026-02-20
