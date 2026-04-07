// its basicall accessing env file with key as VOYAGE_EMBEDDINGS_URL and EMBEDDING_MODEL
const VOYAGE_EMBEDDINGS_URL = process.env.VOYAGE_EMBEDDINGS_URL || 'https://ai.mongodb.com/v1/embeddings';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'voyage-3-large';


export async function generateQueryEmbedding(text: string): Promise<number[] | null> {
  const voyageApiKey = process.env.VOYAGE_API_KEY;

  if (!voyageApiKey) {
    return null;
  }

  try {
    const response = await fetch(VOYAGE_EMBEDDINGS_URL, {
    // Post request will send the text input to the voyage embeddings endpoint to generate an embedding vector for the query text
      method: 'POST',
      headers: {
        //Authorization sends the API key/token
        // tells the embeddings server who is making the request
        // Bearer is the standard format for token-based authentication
        Authorization: `Bearer ${voyageApiKey}`,
        'Content-Type': 'application/json'
      },
      // The body of the POST request contains the content that the embeddings endpoint expects:
      // the input text to embeddings to conert to embedding vector, the embedding model to use, and the input type (query in this case)
      // JSON.stringify converts the payload object into a JSON string so that it can be sent in the body of the POST request
      body: JSON.stringify({
        input: text,
        model: EMBEDDING_MODEL,
        input_type: 'query'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[MCP] Query embedding request failed:', errorText);
      return null;
    }

    // parse the JSON response from the embeddings endpoint into a typed object
    // the response payload is expected to have a data array where each element contains an embedding array of numbers
    // we extract the embedding vector from the first element of the data array, or return null if it is not present
    const payload = await response.json() as { data: Array<{ embedding: number[] }> };
    return payload.data[0]?.embedding ?? null;
  } catch (error) {
    console.error('[MCP] Query embedding failed:', error);
    return null;
  }
}
