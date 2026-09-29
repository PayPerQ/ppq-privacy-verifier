# PPQ's end-to-end encrypted models

A companion to the [README](../README.md). It covers the models PPQ labels
**E2EE**, how they differ from the enclave router, and what changes when you
use the PPQ Privacy Verifier with them.

## What are these models?

End-to-end encrypted models are open-weight models, such as Kimi and GLM,
that PPQ serves from inside a [Tinfoil](https://tinfoil.sh) enclave. The
model itself runs inside the TEE. Your prompt is decrypted only there, and
the answer is encrypted there before it leaves. Nobody sees the content of
your queries: not PPQ, and not even the provider, Tinfoil. These are the
models PPQ labels **E2EE**. Read more about them in our blog post,
[*Introducing Private AI Models*](https://ppq.ai/blog/introducing-tee-models).

## How do E2EE models differ from the enclave router?

The enclave router is PPQ's Nitro enclave, described in the README. It keeps
your prompt from PPQ, but it still hands the prompt to the model's provider
in the clear, because that is where Claude or GPT actually runs. The
provider sees your prompt.

With an E2EE model the provider is Tinfoil, and Tinfoil cannot read your
prompt or the answer either. The enclave your prompt is decrypted in is the
one running the model, so the only machine that ever holds your plaintext is
the one producing your answer.

## How are E2EE models processed in conjunction with the enclave router?

A `private/*` request still enters PPQ's Nitro enclave first, like every
other request: that is where your credit is checked and the request is
billed. From there it goes on to Tinfoil's enclave. How much the Nitro
enclave sees on the way depends on which of two paths you take.

**Path 1: you use the PPQ Privacy Verifier.** The proxy verifies Tinfoil's
attestation on your machine and encrypts your request directly to Tinfoil's
key. PPQ's Nitro enclave receives ciphertext it cannot open, relays it to
Tinfoil, and bills your key from the token counts Tinfoil reports. Your
plaintext exists in exactly two places: your machine and Tinfoil's enclave.

**Path 2: you send a plain request, without client-side EHBP.** The request
is decrypted inside PPQ's Nitro enclave, which then verifies Tinfoil's
attestation itself, encrypts your prompt to Tinfoil's key, and forwards it.
Your plaintext passes briefly through the Nitro enclave, inside measured code
that neither PPQ nor AWS can read, on its way to Tinfoil.

Both paths end in the same place, and on both PPQ is blind. The difference is
who verified Tinfoil: on path 1, you did; on path 2, PPQ's enclave did it on
your behalf.
