/**
 * Document (PDF, DOCX, …) attachments for the Tinfoil `private/*` models.
 *
 * Tinfoil's chat endpoint only reads a `file` content part when the model is
 * vision-capable (it rasterises the pages); text-only models drop the part
 * without an error, so the model answers as if nothing was attached. The web
 * app never relies on that: it converts every document to markdown with
 * `/private/v1/convert/file` (Docling, inside the Tinfoil enclave) and sends the
 * text. This module does the same for proxy clients, over the same encrypted
 * channel, so a document works on every private model.
 *
 * Conversion is billed per call, and chat clients resend the whole
 * conversation on every turn, so results are cached by content hash (per API
 * key) for the lifetime of the proxy — one charge per distinct document, not
 * per turn.
 */

import { createHash } from "node:crypto";

/** Thrown for a request we can't serve; the handler maps it to a 4xx. */
export class DocumentError extends Error {
  constructor(message: string, readonly status: number = 400) {
    super(message);
    this.name = "DocumentError";
  }
}

/** Converts one file to markdown. Returns "" when the file has no text layer. */
export type DocumentConverter = (
  bytes: Buffer,
  filename: string,
  mimeType: string
) => Promise<string>;

const CACHE_MAX_ENTRIES = 64;
/**
 * Completed conversions, LRU by insertion order. Keyed by API key + document
 * hash so a proxy shared between keys still bills each key for its own
 * conversions.
 */
const cache = new Map<string, string>();
/** Conversions in progress, so concurrent identical requests pay once. */
const inFlight = new Map<string, Promise<string>>();

async function convertCached(
  key: string,
  run: () => Promise<string>
): Promise<string> {
  const hit = cache.get(key);
  if (hit !== undefined) {
    // Refresh recency (Map preserves insertion order).
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  let pending = inFlight.get(key);
  if (!pending) {
    pending = run()
      .then((markdown) => {
        cache.set(key, markdown);
        while (cache.size > CACHE_MAX_ENTRIES) {
          cache.delete(cache.keys().next().value as string);
        }
        return markdown;
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }
  return pending;
}

/** Split a `data:<mime>;base64,<data>` URL. Returns null for anything else. */
function parseDataUrl(url: string): { mimeType: string; bytes: Buffer } | null {
  const match = /^data:([^;,]+)?(?:;[^,]*)?;base64,(.*)$/s.exec(url);
  if (!match) return null;
  // Buffer.from silently skips invalid characters, so check the payload first:
  // a malformed attachment must not reach the (billed) converter.
  const payload = match[2].replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(payload)) return null;
  if (payload.includes("=") ? payload.length % 4 !== 0 : payload.length % 4 === 1) return null;
  const bytes = Buffer.from(payload, "base64");
  if (!bytes.length) return null;
  // Round-trip to reject bad padding/length, which Buffer.from tolerates.
  const canonical = (b64: string) => b64.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  if (canonical(bytes.toString("base64")) !== canonical(payload)) return null;
  return { mimeType: (match[1] || "application/octet-stream").toLowerCase(), bytes };
}

/** The wrapper both dialects use when a document is inlined as text. */
export function documentText(filename: string, markdown: string): string {
  return `<document name="${filename.replace(/"/g, "'")}">\n${markdown}\n</document>`;
}

/**
 * Replace every OpenAI `file` content part in `body.messages` with the
 * document's text. Mutates `body` in place.
 *
 * A part whose conversion comes back empty (a scanned PDF with no text layer)
 * is left as-is: a vision model can still read it as images, and a text-only
 * model is no worse off than before.
 */
export async function convertDocumentParts(
  body: Record<string, unknown>,
  convert: DocumentConverter,
  cacheScope: string
): Promise<number> {
  const scope = createHash("sha256").update(cacheScope).digest("hex").slice(0, 16);
  const messages = body.messages;
  if (!Array.isArray(messages)) return 0;

  let converted = 0;
  for (const message of messages) {
    if (!message || !Array.isArray(message.content)) continue;

    const parts: unknown[] = message.content;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i] as Record<string, any> | null;
      if (!part || part.type !== "file") continue;

      const file = (part.file ?? {}) as Record<string, unknown>;
      const fileData = typeof file.file_data === "string" ? file.file_data : "";
      if (!fileData) {
        throw new DocumentError(
          "File attachments must be sent inline as base64 `file_data` " +
            "(data:<mime>;base64,…). Uploaded `file_id` references are not supported."
        );
      }
      const decoded = parseDataUrl(fileData);
      if (!decoded) {
        throw new DocumentError(
          "File attachments for private models must be non-empty base64 data URLs " +
            "(data:<mime>;base64,…); remote URLs are not fetched."
        );
      }

      const filename =
        typeof file.filename === "string" && file.filename ? file.filename : "document";
      const key = `${scope}:${createHash("sha256").update(decoded.bytes).digest("hex")}`;
      const markdown = await convertCached(key, () =>
        convert(decoded.bytes, filename, decoded.mimeType)
      );
      if (!markdown.trim()) continue;

      parts[i] = { type: "text", text: documentText(filename, markdown) };
      converted++;
    }
  }
  return converted;
}

/**
 * Build a converter that posts to `/private/v1/convert/file` through the
 * attested Tinfoil client, exactly as the web app does.
 */
export function createDocumentConverter(
  encryptedFetch: (url: string, init: RequestInit) => Promise<Response>,
  apiBase: string,
  auth: string
): DocumentConverter {
  return async (bytes, filename, mimeType) => {
    const form = new FormData();
    form.append("files", new Blob([new Uint8Array(bytes)], { type: mimeType }), filename);

    let res: Response;
    try {
      res = await encryptedFetch(`${apiBase}/private/v1/convert/file`, {
        method: "POST",
        headers: { Authorization: auth, "x-query-source": "api" },
        body: form,
      });
    } catch (err: any) {
      // Pre-enclave auth/balance errors come back as plain JSON without EHBP
      // headers, which the secure client reports as a ProtocolError.
      if (err?.name === "ProtocolError") {
        throw new DocumentError(
          "Document conversion was rejected — check your API key and that your balance covers the conversion fee.",
          402
        );
      }
      throw err;
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      let message = detail;
      try {
        const parsed = JSON.parse(detail);
        message = parsed?.error?.message || parsed?.error || parsed?.message || detail;
      } catch {
        // Non-JSON body — use it as-is.
      }
      throw new DocumentError(
        `Document conversion failed (${res.status}): ${String(message).slice(0, 300)}`,
        res.status >= 400 && res.status < 500 ? res.status : 502
      );
    }

    const data = (await res.json()) as { document?: { md_content?: string } };
    return data?.document?.md_content ?? "";
  };
}
