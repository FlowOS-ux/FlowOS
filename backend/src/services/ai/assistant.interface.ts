/**
 * FlowOS - src/services/ai/assistant.interface.ts
 * Contract for the AI assistant chat. Backed by Groq in production; swappable.
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface IAssistant {
  /** Returns the assistant's reply given the conversation so far. */
  chat(messages: ChatMessage[], system?: string): Promise<string>;
}
