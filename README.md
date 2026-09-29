# PPQ Privacy Verifier

Every request to PPQ.AI is served inside an AWS Nitro enclave. Your prompt is
encrypted to the enclave, decrypted only inside it, and sent from there to the
model's provider. PPQ's own backend sees a credit check and billing metadata,
never your content.

![How a request moves through PPQ's enclave](docs/img/ppq-enclave-flow.png)

The enclave's code is open source and reproducibly built, so anyone can check
that the enclave running in production is the code that was published. This
proxy is how you do that check yourself, on your machine, before anything is
sent.

## What the proxy does

Point any OpenAI- or Anthropic-compatible client at it. Before a request
leaves your computer, the proxy verifies the enclave's attestation against the
published code measurement and encrypts the request to a key only that enclave
holds. Which enclave depends on the model.

### Frontier models: Claude, GPT, Gemini, …

The proxy verifies PPQ's Nitro enclave and encrypts your query to it. The
enclave forwards the query to the model's provider.

PPQ cannot read your query. The provider can.

### `private/*` models

These models run inside a [Tinfoil](https://tinfoil.sh) enclave. The proxy
verifies that enclave and encrypts your query to it. PPQ's enclave relays the
ciphertext and bills your key; it cannot read the query.

Nobody but you can read your query. Not PPQ, and not Tinfoil.

## Without the proxy

You get the same privacy without it. A plain API request still enters PPQ's
enclave, and for `private/*` models the enclave verifies Tinfoil and encrypts
to it on your behalf. What the proxy adds is that *you* did the verifying.
