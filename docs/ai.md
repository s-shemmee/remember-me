# Noor and RAG

Noor's help assistant is optional and disabled by default. Remember Me works without an AI provider. Tests use `AI_MOCK=1` for predictable responses.

## Ask Noor and RAG

Ask Noor uses Retrieval-Augmented Generation (RAG) to answer product questions from reviewed Remember Me content rather than relying on a model's general knowledge.

The knowledge base is built from:

- The help articles in [`docs/help/`](help/).
- The landing page FAQ.
- The public Privacy and Terms pages.

The indexing utility splits these sources into sections, creates embeddings, and stores them in the `help_chunks` table. When a user asks a question, the Edge Function embeds the question and retrieves relevant sections using `match_help_chunks()`. If no section meets the relevance threshold, Noor does not call a text-generation provider.

For a grounded answer, the function sends the question and retrieved passages to a configured provider. Noor is instructed to answer only from those passages. Zod validates the response, and returned sources must belong to the retrieved set. The app links to the corresponding help pages.

## Privacy and safety

- Provider credentials belong only in the server-side Edge Function environment.
- Questions and generated responses are not stored as conversation history.
- User-provided text is treated as untrusted input.
- If generation fails or output is invalid, the app uses a safe fallback instead of inventing a successful result.
- Noor receives help content and the user's question, not account or reservation data.

## Development and tests

Use the local Supabase stack when indexing or testing Noor's help assistant. `AI_MOCK=1` supplies scripted answers for tests and end-to-end flows. Evaluation cases in [`docs/ai/evals/`](ai/evals/) use questions about Remember Me and are for checking answer quality, not for providing runtime answers.

The RAG implementation lives in `src/ai/ask-noor/`, `src/features/ask-noor/`, and the `ask-noor` and `index-help` Edge Functions. Add focused tests for retrieval, validation, refusals, source attribution, privacy boundaries, and fallback behavior when changing it.
