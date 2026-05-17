import React, { useState, useCallback, useRef } from "react";
import type { WordTranscript } from "@/transcription/types";
import type { EditSuggestion } from "@/text-edit-engine/types";
import { chunkTranscript } from "./transcript-chunker";
import { parseLLMResponse, formatTranscriptForLLM } from "./llm-parser";
import { cn } from "@/utils/ui";

interface Message {
	id: string;
	role: "user" | "assistant";
	content: string;
	timestamp: number;
	suggestions?: EditSuggestion[];
}

interface GemmaChatPanelProps {
	transcript: WordTranscript;
	videoDuration: number;
	onSuggestEdit: (suggestion: EditSuggestion) => void;
}

export const GemmaChatPanel: React.FC<GemmaChatPanelProps> = ({
	transcript,
	videoDuration,
	onSuggestEdit,
}) => {
	const [messages, setMessages] = useState<Message[]>([
		{
			id: "welcome",
			role: "assistant",
			content:
				"Hi! I can help you find content in your video or suggest edits. What would you like to do?",
			timestamp: Date.now(),
		},
	]);
	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	const scrollToBottom = useCallback(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	const handleSend = useCallback(async () => {
		if (!input.trim() || isLoading) return;

		const userMessage: Message = {
			id: `user-${Date.now()}`,
			role: "user",
			content: input.trim(),
			timestamp: Date.now(),
		};

		setMessages((prev) => [...prev, userMessage]);
		setInput("");
		setIsLoading(true);
		setError(null);

		const chunks = chunkTranscript(transcript, 4096, input.trim());
		const contextChunks = chunks.slice(0, 2);

		const contextText = contextChunks
			.map((chunk) => formatTranscriptForLLM(chunk.text, chunk.words))
			.join("\n\n---\n\n");

		const systemPrompt = `You are a video editing assistant. Based on the transcript below, suggest edits. 
Respond with JSON in this format:
{"suggestions": [{"description": "what to cut", "start": 0.0, "end": 10.0}]}

Only suggest edits that match the user's request. Use the word timings to be precise.
If no edits are needed, just respond conversationally.`;

		const fullPrompt = `${systemPrompt}\n\n${contextText}\n\nUser: ${input.trim()}`;

		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 30000);

			const response = await fetch("/api/gemma", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ prompt: fullPrompt }),
				signal: controller.signal,
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				throw new Error(`Server error: ${response.status}`);
			}

			const data = await response.json();
			const rawResponse = data.response || data.text || data.content || "";

			const suggestions = parseLLMResponse(rawResponse, videoDuration);

			const assistantMessage: Message = {
				id: `assistant-${Date.now()}`,
				role: "assistant",
				content: rawResponse,
				timestamp: Date.now(),
				suggestions: suggestions.length > 0 ? suggestions : undefined,
			};

			setMessages((prev) => [...prev, assistantMessage]);
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "Failed to get response";

			if (errorMessage.includes("aborted")) {
				setError("Request timed out after 30 seconds. Please try again.");
			} else {
				setError(errorMessage);
			}

			setMessages((prev) => [
				...prev,
				{
					id: `error-${Date.now()}`,
					role: "assistant",
					content: `Sorry, I couldn't process that request: ${errorMessage}`,
					timestamp: Date.now(),
				},
			]);
		} finally {
			setIsLoading(false);
		}
	}, [input, isLoading, transcript, videoDuration]);

	const handleSuggestionClick = useCallback(
		(suggestion: EditSuggestion) => {
			onSuggestEdit(suggestion);
		},
		[onSuggestEdit],
	);

	return (
		<div className="flex flex-col h-full">
			<div className="flex-1 overflow-y-auto p-4 space-y-4">
				{messages.map((message) => (
					<div
						key={message.id}
						className={cn(
							"flex",
							message.role === "user" ? "justify-end" : "justify-start",
						)}
					>
						<div
							className={cn(
								"max-w-[80%] rounded-lg p-3",
								message.role === "user"
									? "bg-primary text-primary-foreground"
									: "bg-accent",
							)}
						>
							<p className="text-sm whitespace-pre-wrap">{message.content}</p>

							{message.suggestions && message.suggestions.length > 0 && (
								<div className="mt-3 pt-3 border-t border-border/50">
									<p className="text-xs font-medium mb-2">Suggested edits:</p>
									<div className="space-y-2">
										{message.suggestions.map((suggestion) => (
											<button
												key={suggestion.id}
												onClick={() => handleSuggestionClick(suggestion)}
												className="w-full text-left p-2 rounded-md bg-background/50 hover:bg-background text-xs transition-colors"
											>
												<div className="font-medium">{suggestion.description}</div>
												<div className="text-muted-foreground mt-1">
													{suggestion.timeRange.start.toFixed(1)}s →{" "}
													{suggestion.timeRange.end.toFixed(1)}s
												</div>
											</button>
										))}
									</div>
								</div>
							)}
						</div>
					</div>
				))}

				{isLoading && (
					<div className="flex justify-start">
						<div className="bg-accent rounded-lg p-3">
							<div className="flex items-center gap-2">
								<div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" />
								<div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.1s]" />
								<div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.2s]" />
							</div>
						</div>
					</div>
				)}

				{error && (
					<div className="flex justify-center">
						<div className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">
							{error}
						</div>
					</div>
				)}

				<div ref={messagesEndRef} />
			</div>

			<div className="p-3 border-t">
				<div className="flex gap-2">
					<input
						type="text"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								handleSend();
							}
						}}
						placeholder="Ask about your video or request edits..."
						className="flex-1 px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
						disabled={isLoading}
					/>
					<button
						onClick={handleSend}
						disabled={isLoading || !input.trim()}
						className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						Send
					</button>
				</div>
			</div>
		</div>
	);
};
