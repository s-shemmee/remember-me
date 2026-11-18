import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/env";
import { sitemapFor } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapFor(siteUrl());
}
