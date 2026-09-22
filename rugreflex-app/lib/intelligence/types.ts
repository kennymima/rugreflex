export type ResearchSourceType =
  | "web"
  | "news"
  | "reddit"
  | "youtube"
  | "x";

export type ResearchConfidence = "low" | "medium" | "high";

export type ResearchEvidence = {
  source: string;
  title: string;
  url: string;
  sourceType: ResearchSourceType;
  publishedAt?: string | null;
  retrievedAt: string;
  observedInformation: string;
};

export type ResearchRequest = {
  question: string;
  tokenMint?: string | null;
  tokenSymbol?: string | null;
  topic?: string | null;
};

export type ResearchResult = {
  researched: boolean;
  evidence: ResearchEvidence[];
  confidence: ResearchConfidence;
  researchedAt: string;
};
