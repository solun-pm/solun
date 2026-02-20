import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/p/", "/s/", "/f/", "/api/"]
    },
    sitemap: "https://solun.pm/sitemap.xml"
  };
}
