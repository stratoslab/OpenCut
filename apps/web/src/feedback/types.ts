export const MAX_MESSAGE_LENGTH = 5000;

export interface FeedbackEntry {
	id: string;
	message: string;
	createdAt: string;
}

export interface SubmitFeedbackInput {
	message: string;
}

/**
 * Sanitizes feedback messages for safe display.
 * Strips all HTML tags to prevent stored XSS.
 * Must be called before rendering any feedback message to the DOM.
 */
export function sanitizeFeedback(message: string): string {
	return message
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#x27;");
}
