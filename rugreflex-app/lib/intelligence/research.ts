import type {
  ResearchRequest,
  ResearchResult,
} from "@/lib/intelligence/types";

export interface ResearchProvider {
  research(request: ResearchRequest): Promise<ResearchResult>;
}

export async function research(
  _request: ResearchRequest
): Promise<ResearchResult> {
  return {
    researched: false,
    evidence: [],
    confidence: "low",
    researchedAt: new Date().toISOString(),
  };
}
