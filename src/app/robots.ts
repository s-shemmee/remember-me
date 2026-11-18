import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/env";
import { robotsFor } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return robotsFor(siteUrl());
}
