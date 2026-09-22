import type {
  ResearchEvidence,
  ResearchRequest,
  ResearchResult,
} from "@/lib/intelligence/types";

const TAVILY_API_URL = "https://api.tavily.com/search";

type TavilyResult = {
  title?: string;
  url?: string;
  content?: string;
  published_date?: string;
};

type TavilyResponse = {
  results?: TavilyResult[];
};

function getTavilyApiKey(): string {
  const key = process.env.TAVILY_API_KEY;

  if (!key) {
    throw new Error("TAVILY_API_KEY is not configured.");
  }

  return key;
}

export async function researchWithTavily(
  request: ResearchRequest
): Promise<ResearchResult> {
  const apiKey = getTavilyApiKey();

  const response = await fetch(TAVILY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: apiKey,
      query: request.question,
      topic: "general",
      search_depth: "basic",
      max_results: 5,
      include_answer: false,
      include_raw_content: false,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Tavily search failed with status ${response.status}.`
    );
  }

  const data = (await response.json()) as TavilyResponse;
  const retrievedAt = new Date().toISOString();

  const evidence: ResearchEvidence[] = (data.results ?? [])
    .filter(
      (result): result is TavilyResult & { title: string; url: string } =>
        Boolean(result.title && result.url)
    )
    .map((result) => ({
      source: new URL(result.url).hostname,
      title: result.title,
      url: result.url,
      sourceType: "web",
      publishedAt: result.published_date ?? null,
      retrievedAt,
      observedInformation: result.content?.trim() || "No extractable summary provided.",
    }));

  return {
    researched: evidence.length > 0,
    evidence,
    confidence:
      evidence.length >= 3
        ? "high"
        : evidence.length > 0
          ? "medium"
          : "low",
    researchedAt: retrievedAt,
  };
}
