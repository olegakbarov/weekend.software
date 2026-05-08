import { useEffect, useRef, useState } from "react";
import {
  Chat,
  ChatComposer,
  ChatMessage,
  ChatMessageList,
  ChatProgressBar,
  ChatThinkingIndicator,
  type ChatMessageItem,
  type ChatStatus,
} from "@weekend/design/registry";
import { CodeBlock } from "../../components/code-block";
import { H } from "../../components/heading";

const SCRIPT = [
  "Sure thing — let me look that up.",
  " I'll check the source first.",
  "\n\nThe `Chat` composite is just a wiring of the parts.",
  " You pass `messages`, `streamingText`, `status`, and `onSend`.",
  "\n\n- Drop down to the parts when you need a custom layout.\n",
  "- Pass `renderMarkdown` to swap the default `Streamdown` renderer.\n",
  "- `<ChatProgressBar>` is exported separately so you can place it anywhere.",
];

const INITIAL_MESSAGES: ChatMessageItem[] = [
  { id: 1, role: "user", text: "What does the Chat composite actually do?" },
  {
    id: 2,
    role: "assistant",
    text: "It wires the chat primitives together via plain UI props. State (messages, streaming text, status) lives on the caller — Chat owns scroll and layout but knows nothing about transport.",
  },
];

export function PageChat(): React.JSX.Element {
  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Components</div>
        <h1>Chat</h1>
        <p className="lede">
          The canonical AI chat block, plus its individual primitives. Pure UI:
          the caller owns transport, persistence, and presets. The block owns
          scroll behavior, the message+streaming layout, and the composer.
        </p>
      </header>

      <div className="section">
        <H as="h2" id="composite">
          Chat composite
        </H>
        <p>
          A wired-up demo. Messages stream in word-by-word; tool calls animate
          through their lifecycle. Try sending a message — it&apos;ll echo back
          a scripted response.
        </p>
        <div className="example">
          <div className="example-stage">
            <div className="h-[420px] w-full max-w-[560px] overflow-hidden rounded-xl border border-border">
              <ChatDemo />
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="message">
          ChatMessage
        </H>
        <p>
          Single role-tagged bubble. Content is delegated via children, so
          callers choose plain text, Markdown, or anything else.
        </p>
        <div className="example">
          <div className="example-stage flex flex-col gap-2">
            <ChatMessage role="user">Hi, can you help with this?</ChatMessage>
            <ChatMessage role="assistant">
              Of course — what are you trying to do?
            </ChatMessage>
            <ChatMessage role="assistant" interrupted>
              I was answering when you stopped me…
            </ChatMessage>
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="composer">
          ChatComposer
        </H>
        <p>
          Auto-resizing textarea with Cmd/Ctrl+Enter to submit. While
          streaming, the send button swaps for a stop button.
        </p>
        <div className="example">
          <div className="example-stage flex flex-col gap-3">
            <ComposerDemo />
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="indicator">
          ChatThinkingIndicator
        </H>
        <p>
          Three bouncing dots, shown while the assistant has been called but no
          token has streamed yet. Lives inside the message list so the layout
          doesn&apos;t shift when the first token lands.
        </p>
        <div className="example">
          <div className="example-stage">
            <ChatThinkingIndicator />
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="progress">
          ChatProgressBar
        </H>
        <p>
          Thin shimmer bar. Render conditionally based on streaming state;
          this component does no internal logic.
        </p>
        <div className="example">
          <div className="example-stage">
            <div className="w-full max-w-md overflow-hidden rounded-md border border-border">
              <ChatProgressBar />
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="usage">
          Usage
        </H>
        <CodeBlock lang="tsx">{`<Chat
  messages={messages}
  streamingText={streamingText}
  streamingToolCalls={streamingToolCalls}
  status={status}
  onSend={handleSend}
  onAbort={handleAbort}
  emptyState={<p>Send a message to start.</p>}
  // renderMarkdown defaults to <Streamdown>; pass your own to swap it.
/>`}</CodeBlock>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Demos
// ─────────────────────────────────────────────────────────────────────

function ChatDemo() {
  const [messages, setMessages] = useState<ChatMessageItem[]>(INITIAL_MESSAGES);
  const [streamingText, setStreamingText] = useState("");
  const [status, setStatus] = useState<ChatStatus>("idle");
  const abortRef = useRef<{ aborted: boolean }>({ aborted: false });

  const handleSend = (text: string) => {
    abortRef.current = { aborted: false };
    const localAbort = abortRef.current;
    const userMsg: ChatMessageItem = {
      id: messages.length + 1,
      role: "user",
      text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setStatus("streaming");
    setStreamingText("");

    // Quick "thinking" pause, then stream the script word-by-word.
    let chunkIdx = 0;
    let assistantText = "";
    const tick = () => {
      if (localAbort.aborted) {
        finalize(assistantText, true);
        return;
      }
      if (chunkIdx >= SCRIPT.length) {
        finalize(assistantText, false);
        return;
      }
      assistantText += SCRIPT[chunkIdx]!;
      chunkIdx += 1;
      setStreamingText(assistantText);
      setTimeout(tick, 220);
    };
    setTimeout(tick, 700);

    const finalize = (final: string, interrupted: boolean) => {
      setMessages((prev) => [
        ...prev,
        {
          id: prev.length + 1,
          role: "assistant",
          text: final,
          ...(interrupted ? { interrupted: true } : {}),
        },
      ]);
      setStreamingText("");
      setStatus("idle");
    };
  };

  const handleAbort = () => {
    abortRef.current.aborted = true;
  };

  return (
    <Chat
      messages={messages}
      streamingText={streamingText}
      status={status}
      onSend={handleSend}
      onAbort={handleAbort}
      emptyState={<p className="text-xs text-muted-foreground">Send a message to start.</p>}
      composerPlaceholder="Ask anything…"
    />
  );
}

function ComposerDemo() {
  const [value, setValue] = useState("");
  const [streaming, setStreaming] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const handleSubmit = (text: string) => {
    setValue("");
    setStreaming(true);
    timerRef.current = setTimeout(() => setStreaming(false), 2000);
  };

  return (
    <div className="w-full max-w-md overflow-hidden rounded-md border border-border bg-background">
      <ChatComposer
        value={value}
        onValueChange={setValue}
        onSubmit={handleSubmit}
        isStreaming={streaming}
        onAbort={() => setStreaming(false)}
        placeholder="Type and press Cmd+Enter…"
      />
    </div>
  );
}
