import type { ResearchResult } from "@/lib/intelligence/types";

export function formatResearchContext(
  result: ResearchResult
): string {
  if (!result.researched || result.evidence.length === 0) {
    return "No fresh Internet research evidence was retrieved.";
  }

  const evidence = result.evidence
    .map(
      (item, index) =>
        [
          `SOURCE ${index + 1}`,
          `Title: ${item.title}`,
          `Source: ${item.source}`,
          `URL: ${item.url}`,
          `Published: ${item.publishedAt ?? "Unknown"}`,
          `Retrieved: ${item.retrievedAt}`,
          `Observed information: ${item.observedInformation}`,
        ].join("\n")
    )
    .join("\n\n");

  return [
    "FRESH INTERNET RESEARCH EVIDENCE:",
    `Research confidence: ${result.confidence}`,
    `Research retrieved at: ${result.researchedAt}`,
    "",
    evidence,
  ].join("\n");
}
