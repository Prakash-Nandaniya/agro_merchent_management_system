import React, { useCallback, useRef, useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { apiFetch } from "@/utils/apifetch";
import { settings } from "@/settings";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import "./chat.css";

// ---------- Types ----------
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatResponse {
  answer: string;
}

// ---------- Helpers ----------
const genId = () => crypto.randomUUID();

const chatKey = (threadId: string) => ["chat", threadId] as const;

const THREAD_STORAGE_KEY = "chat_thread_id";

function getOrCreateThreadId(): string {
  const stored = localStorage.getItem(THREAD_STORAGE_KEY);
  if (stored) return stored;
  const fresh = genId();
  localStorage.setItem(THREAD_STORAGE_KEY, fresh);
  return fresh;
}

async function postMessage(
  threadId: string,
  message: string,
): Promise<ChatResponse> {
  const res = await apiFetch(`${settings.BE_URL}/chat/${threadId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}`);
  }

  return res.json();
}

interface ChartSeries {
  key: string;
  color?: string;
}

interface ChartSpec {
  type: "bar" | "line" | "pie";
  xKey?: string;
  series: ChartSeries[];
  data: Record<string, string | number>[];
}

const PIE_COLORS = [
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
];

function ChartRenderer({ raw }: { raw: string }) {
  let spec: ChartSpec | null = null;
  try {
    spec = JSON.parse(raw);
  } catch {
    return <div className="chat-chart-error">Couldn't parse chart data.</div>;
  }

  if (!spec || !spec.data || !spec.series) {
    return <div className="chat-chart-error">Invalid chart spec.</div>;
  }

  return (
    <div className="chat-chart-wrap">
      <ResponsiveContainer width="100%" height={240}>
        {spec.type === "line" ? (
          <LineChart data={spec.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey={spec.xKey || "name"} fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip />
            <Legend />
            {spec.series.map((s, i) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={s.color || PIE_COLORS[i % PIE_COLORS.length]}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        ) : spec.type === "pie" ? (
          <PieChart>
            <Tooltip />
            <Legend />
            <Pie
              data={spec.data}
              dataKey={spec.series[0]?.key}
              nameKey={spec.xKey || "name"}
              outerRadius={80}
              label
            >
              {spec.data.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        ) : (
          <BarChart data={spec.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey={spec.xKey || "name"} fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip />
            <Legend />
            {spec.series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                fill={s.color || PIE_COLORS[i % PIE_COLORS.length]}
              />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

// ---------- Code block renderer for markdown ----------
function CodeBlock({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const match = /language-(\w+)/.exec(className || "");
  const isInline = !match;
  const language = match ? match[1] : undefined;
  const rawText = String(children).replace(/\n$/, "");

  if (isInline) {
    return <code className="chat-inline-code">{children}</code>;
  }

  if (language === "chart") {
    return <ChartRenderer raw={rawText} />;
  }

  return (
    <SyntaxHighlighter
      style={oneDark}
      language={language}
      PreTag="div"
      customStyle={{ borderRadius: 8, fontSize: "0.85rem", margin: "8px 0" }}
    >
      {rawText}
    </SyntaxHighlighter>
  );
}

// ---------- Main component ----------
export default function Chat() {
  const [threadId, setThreadId] = useState<string>(() => getOrCreateThreadId());
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const queryClient = useQueryClient();

  const { data: messages = [] } = useQuery<ChatMessage[]>({
    queryKey: chatKey(threadId),
    queryFn: () => Promise.resolve([]), 
    initialData: () =>
      queryClient.getQueryData<ChatMessage[]>(chatKey(threadId)) ?? [],
    staleTime: Infinity,
    gcTime: Infinity, 
  });

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }, []);

  const sendMutation = useMutation({
    mutationFn: (message: string) => postMessage(threadId, message),
    onMutate: async (message: string) => {
      const userMsg: ChatMessage = {
        id: genId(),
        role: "user",
        content: message,
      };
      queryClient.setQueryData<ChatMessage[]>(
        chatKey(threadId),
        (prev = []) => [...prev, userMsg],
      );
      scrollToBottom();
    },
    onSuccess: (data: ChatResponse) => {
      const assistantMsg: ChatMessage = {
        id: genId(),
        role: "assistant",
        content: data.answer,
      };
      queryClient.setQueryData<ChatMessage[]>(
        chatKey(threadId),
        (prev = []) => [...prev, assistantMsg],
      );
      scrollToBottom();
    },
    onError: () => {
      const errMsg: ChatMessage = {
        id: genId(),
        role: "assistant",
        content: "_Something went wrong. Please try again._",
      };
      queryClient.setQueryData<ChatMessage[]>(
        chatKey(threadId),
        (prev = []) => [...prev, errMsg],
      );
      scrollToBottom();
    },
  });

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || sendMutation.isPending) return;
    sendMutation.mutate(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    queryClient.removeQueries({ queryKey: chatKey(threadId) });
    const fresh = genId();
    localStorage.setItem(THREAD_STORAGE_KEY, fresh);
    setThreadId(fresh);
    setInput("");
  };

  return (
    <div className="chat-widget">
      <div className="chat-header">
        <button
          className="chat-clear-btn"
          onClick={handleClear}
          title="Clear chat"
          aria-label="Clear chat"
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>
        <span className="chat-title">Chat</span>
      </div>

      <div className="chat-messages" ref={listRef}>
        {messages.length === 0 && <div className="chat-empty"></div>}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`chat-bubble-row ${m.role === "user" ? "row-user" : "row-assistant"}`}
          >
            <div
              className={`chat-bubble ${m.role === "user" ? "bubble-user" : "bubble-assistant"}`}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code: CodeBlock as any,
                }}
              >
                {m.content}
              </ReactMarkdown>
            </div>
          </div>
        ))}

        {sendMutation.isPending && (
          <div className="chat-bubble-row row-assistant">
            <div className="chat-bubble bubble-assistant chat-typing">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </div>
          </div>
        )}
      </div>

      <div className="chat-search-bar">
        <input
          type="text"
          className="chat-input"
          placeholder="Type your message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sendMutation.isPending}
        />
        <button
          className="chat-send-btn"
          onClick={handleSend}
          disabled={sendMutation.isPending || !input.trim()}
          aria-label="Send message"
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}