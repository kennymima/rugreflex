const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5.6-luna";

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY;

  if (!key) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  return key;
}

function extractText(data: OpenAIResponse): string {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const text = data.output
    ?.flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("\n")
    .trim();

  return text || "";
}

export async function generateRugReflexAI(params: {
  instructions: string;
  input: string;
  model?: string;
}): Promise<string> {
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model || process.env.OPENAI_MODEL || DEFAULT_MODEL,
      instructions: params.instructions,
      input: params.input,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenAI API request failed (${response.status}): ${errorText.slice(0, 500)}`
    );
  }

  const data = (await response.json()) as OpenAIResponse;
  const text = extractText(data);

  if (!text) {
    throw new Error("OpenAI returned an empty response.");
  }

  return text;
}
