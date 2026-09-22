"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import RugReflexNav from "@/app/components/RugReflexNav";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const starters = [
  "What should I check before buying a Solana token?",
  "Explain holder concentration and why it matters.",
  "What does locked liquidity actually tell me?",
  "How should I interpret a RugReflex risk score?",
];

function ChatPageContent() {
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Welcome to RugReflex Intelligence. Ask me about token risk, holders, liquidity, security authorities, deployers, Alpha Radar signals, or how to interpret an investigation.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  useEffect(() => {
    const savedConversationId = window.localStorage.getItem(
      "rugreflex_chat_conversation_id"
    );

    if (savedConversationId) {
      setConversationId(savedConversationId);
    }
  }, []);

  useEffect(() => {
    if (conversationId) {
      window.localStorage.setItem(
        "rugreflex_chat_conversation_id",
        conversationId
      );
    }
  }, [conversationId]);

  useEffect(() => {
    const savedConversationId = conversationId;
    if (!savedConversationId) return;

    const conversationIdForRequest: string = savedConversationId;

    let cancelled = false;

    async function restoreConversation() {
      try {
        const response = await fetch(
          `/api/chat?conversationId=${encodeURIComponent(conversationIdForRequest)}`
        );

        if (!response.ok) {
          if (response.status === 404 || response.status === 403) {
            window.localStorage.removeItem(
              "rugreflex_chat_conversation_id"
            );
            setConversationId(null);
          }
          return;
        }

        const data = await response.json();

        if (
          !cancelled &&
          Array.isArray(data.messages) &&
          data.messages.length > 0
        ) {
          setMessages(
            data.messages
              .filter(
                (message: unknown): message is Message =>
                  typeof message === "object" &&
                  message !== null &&
                  "role" in message &&
                  "content" in message &&
                  (message as { role?: unknown }).role !== "system" &&
                  (message as { role?: unknown }).role !== "tool" &&
                  typeof (message as { content?: unknown }).content ===
                    "string"
              )
              .map((message: Message) => ({
                role: message.role,
                content: message.content,
              }))
          );
        }
      } catch (error) {
        console.error("Unable to restore RugReflex chat:", error);
      }
    }

    restoreConversation();

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();

    const question = input.trim();
    if (!question || loading) return;

    const nextMessages = [...messages, { role: "user" as const, content: question }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: question,
          history: nextMessages.slice(-10),
          conversationId,
          tokenMint: tokenFromUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to reach RugReflex Intelligence.");
      }

      if (typeof data.conversationId === "string") {
        setConversationId(data.conversationId);
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.answer,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "Something went wrong. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#100308] text-white">
      <RugReflexNav />

      <section className="mx-auto flex h-[calc(100vh-72px)] max-w-5xl flex-col overflow-hidden px-5 py-6 sm:px-6 sm:py-8 lg:py-10">
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">
              Intelligence Online
            </span>
          </div>

          <h1 className="text-4xl font-black tracking-[-0.04em] sm:text-5xl">
            AI Intelligence
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">
            Ask questions about Solana token risk and learn how to interpret
            the signals RugReflex investigates.
          </p>

          {tokenFromUrl && (
            <div className="mt-4 inline-flex max-w-full items-center gap-2 rounded-xl border border-red-400/20 bg-red-950/30 px-3 py-2">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
              <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-red-300/70">
                Investigating
              </span>
              <span className="max-w-[260px] truncate font-mono text-[10px] text-white/50 sm:max-w-[420px]">
                {tokenFromUrl}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.025]">
          <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-7">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                    message.role === "user"
                      ? "bg-white text-[#4d1022]"
                      : "border border-white/[0.07] bg-black/20 text-white/65"
                  }`}
                >
                  <div className="space-y-3 text-sm leading-7">
                    {message.content.split("\n").map((line, lineIndex) => {
                      const trimmed = line.trim();

                      if (!trimmed) {
                        return <div key={lineIndex} className="h-1" />;
                      }

                      if (trimmed.startsWith("### ")) {
                        return (
                          <h4
                            key={lineIndex}
                            className="pt-1 text-sm font-black tracking-wide text-white"
                          >
                            {trimmed.slice(4)}
                          </h4>
                        );
                      }

                      if (trimmed.startsWith("## ")) {
                        return (
                          <h3
                            key={lineIndex}
                            className="pt-2 text-base font-black tracking-wide text-white"
                          >
                            {trimmed.slice(3)}
                          </h3>
                        );
                      }

                      if (trimmed.startsWith("# ")) {
                        return (
                          <h2
                            key={lineIndex}
                            className="pt-2 text-lg font-black tracking-wide text-white"
                          >
                            {trimmed.slice(2)}
                          </h2>
                        );
                      }

                      if (trimmed.startsWith("- ")) {
                        return (
                          <div key={lineIndex} className="flex gap-2">
                            <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                            <span>{trimmed.slice(2)}</span>
                          </div>
                        );
                      }

                      const parts = trimmed.split(/(\*\*.*?\*\*|`.*?`)/g);

                      return (
                        <p key={lineIndex}>
                          {parts.map((part, partIndex) => {
                            if (
                              part.startsWith("**") &&
                              part.endsWith("**")
                            ) {
                              return (
                                <strong
                                  key={partIndex}
                                  className="font-bold text-white"
                                >
                                  {part.slice(2, -2)}
                                </strong>
                              );
                            }

                            if (
                              part.startsWith("`") &&
                              part.endsWith("`")
                            ) {
                              return (
                                <code
                                  key={partIndex}
                                  className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-xs text-red-200"
                                >
                                  {part.slice(1, -1)}
                                </code>
                              );
                            }

                            return <span key={partIndex}>{part}</span>;
                          })}
                        </p>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="text-xs text-white/30">
                RugReflex Intelligence is thinking...
              </div>
            )}
          </div>

          {messages.length === 1 && (
            <div className="border-t border-white/[0.06] px-5 py-4">
              <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.18em] text-white/25">
                Try asking
              </p>
              <div className="flex flex-wrap gap-2">
                {starters.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => setInput(starter)}
                    className="rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-[10px] text-white/45 transition hover:bg-white/[0.06] hover:text-white/70"
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form
            onSubmit={sendMessage}
            className="border-t border-white/[0.07] p-4 sm:p-5"
          >
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask about token risk..."
                className="min-w-0 flex-1 rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-white/[0.16]"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="rounded-2xl bg-white px-5 py-3 text-xs font-black tracking-wider text-[#64122b] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ASK →
              </button>
            </div>
          </form>
        </div>

        <p className="mt-4 text-center text-[9px] uppercase tracking-[0.15em] text-white/20">
          RugReflex intelligence is informational and not financial advice.
        </p>
      </section>
    </main>
  );
}


export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatPageContent />
    </Suspense>
  );
}
