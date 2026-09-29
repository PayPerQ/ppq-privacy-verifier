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

## What the enclave keeps PPQ from doing

**Reading or keeping your queries.** Your connection is decrypted only inside
the enclave. The servers around it, PPQ's backend and PPQ's logs see
ciphertext. There is nothing to harvest, sell or hand over.

**Altering the answers.** The provider's response is decrypted inside the
enclave and encrypted to you again there. Nothing outside it can change a
word, and the only code that handles the reply in the clear is the published,
measured code anyone can read.

**Quietly serving a different model.** The enclave cannot stop PPQ's backend
from choosing a provider, but it reports the choice in a signed receipt,
described next.

## A receipt for every request

The enclave does not choose which provider serves your request; PPQ's backend
does, at the credit check. So attestation alone cannot tell you that your
request went to the model you paid for rather than a cheaper one.

For that, every streamed response carries a **routing receipt**: a line,
signed by the enclave with a key its attestation commits to, stating the model
you asked for, the provider the enclave actually connected to, and the model
id it sent there. It rides inside the encrypted response, so nothing outside
the enclave can alter it, and it is a comment line that OpenAI-compatible
clients ignore unless they look for it.

A receipt does not stop PPQ from substituting a model. It makes any
substitution undeniable: the statement comes from published, measured code and
can be checked against source anyone can read. When a request went through
OpenRouter, the receipt says so; in that case OpenRouter, not PPQ, picks the
underlying provider. To verify a receipt against the enclave's attestation
yourself, use
[`verify-receipt.mjs`](https://github.com/PayPerQ/ppq-enclave-proxy/blob/main/client/verify-receipt.mjs)
from the enclave repository.

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
