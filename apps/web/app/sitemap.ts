import { learnSlugs } from "./learn/content";
import type { MetadataRoute } from "next";

const siteUrl = "https://solun.pm";

export default function sitemap(): MetadataRoute.Sitemap {
  const learnEntries = learnSlugs.map((slug) => ({
    url: `${siteUrl}/learn/${slug}`,
    lastModified: new Date()
  }));

  return [
    {
      url: siteUrl,
      lastModified: new Date()
    },
    {
      url: `${siteUrl}/learn`,
      lastModified: new Date()
    },
    {
      url: `${siteUrl}/learn/overview`,
      lastModified: new Date()
    },
    {
      url: `${siteUrl}/roadmap`,
      lastModified: new Date()
    },
    ...learnEntries
  ];
}
