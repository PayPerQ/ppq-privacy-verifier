# Security Policy

This repository is the local verifier proxy for PayPerQ's enclave router. Its
job is to check, on your machine, that the enclave you are about to talk to
is running the published code, and to encrypt every request to that verified
enclave. A bug here can make the check pass when it should fail, so we treat
security reports as the highest-priority work in the repo.

## Reporting a vulnerability

**Please do not open a public GitHub issue for a security bug.**

Report privately through either channel:

- **GitHub private vulnerability reporting:** use the "Report a vulnerability"
  button on the Security tab of this repository.
- **Email:** matt@ppq.ai. No PGP key is published yet; ask in your first
  email if you need an encrypted channel and we will set one up.

Include what you can of: the affected file, the npm version or commit you
tested against, steps to reproduce, and what you believe the impact is. A
proof of concept is welcome but not required.

## What to expect from us

- **Acknowledgement within 2 business days.**
- A first assessment of severity and an intended fix path within 7 days.
- Progress updates at least weekly until the report is closed.
- Fix targets: issues that let the verifier accept an enclave it should
  reject, or send content it should have sealed, are our top priority and we
  aim to ship a fix within 30 days. Lower-severity issues are scheduled on
  their merits and we will tell you the target.

Fixes ship as a new release of the `ppq-private-mode` npm package and a new
tag in this repository.

## Coordinated disclosure

We ask for 90 days from the date of the report, or until a fixed release is
published, whichever comes first, before public disclosure. If we need longer
we will ask and explain why. If we are unresponsive for 14 days at any point,
you are free to disclose.

We will credit you in the release notes for the fixed version unless you ask
not to be named.

## Safe harbor

We will not pursue legal action against, or report to law enforcement, anyone
who in good faith:

- follows this policy,
- avoids privacy violations, data destruction, and service degradation
  (no denial-of-service testing against production),
- uses their own PayPerQ credit id and only accesses data belonging to it,
- and gives us a reasonable time to fix the issue before disclosing it.

If you are unsure whether something is in bounds, ask first via the channels
above.

## Scope

**In scope**

- Everything in this repository: attestation fetching and validation, PCR
  pin resolution against the published measurement, certificate and
  public-key binding, EHBP/HPKE sealing and unsealing, the OpenAI- and
  Anthropic-compatible request handling, and the Docker image.
- The release and build process for the `ppq-private-mode` npm package.

**Especially interested in**

- Any way for the verifier to accept an enclave that is not running the
  published measurement, or to be downgraded to an unverified or unsealed
  path without an error.
- Any way for a party on the network path, or PayPerQ itself, to read or
  alter request or response content that passed through the verifier.
- Any way for a malicious or compromised enclave response, or a malicious
  local client, to execute code or read files on the machine running the
  verifier.
- Any way, through this proxy, to get queries served without being billed
  for them, to be billed less than the metered cost, or to make PayPerQ pay a
  provider without a matching charge to a user.
- Supply-chain issues in the published npm package or Docker image that do
  not match this source.

**Out of scope for this repository** (report these to the right place instead)

- The enclave itself: https://github.com/PayPerQ/ppq-enclave-proxy has its
  own security policy and is the right place for anything on the server side.
- The ppq.ai web app and the billing backend, both closed source. Report
  those to the same email and we will triage from there.
- The `private/*` (Tinfoil TEE) models' own confidential-VM guarantees; those
  belong to Tinfoil.
- AWS Nitro Enclaves itself and upstream model providers.
- Denial of service, rate limiting, and resource exhaustion.
- Metadata visibility that the enclave repository's threat model already
  states PayPerQ can see (credit id, model, token counts, timing, client IP).

## Supported versions

Only the latest release of the `ppq-private-mode` npm package is supported.
Older versions are not patched; upgrade before reporting if you can.

## Bounty

We do not run a formal bug bounty program. We do pay, at our discretion and
in bitcoin, for reports that break the privacy or routing guarantee or that
let a user get queries served without paying for them. Tell us in your report
if you would like to be considered.

## Related

- The enclave, its threat model and known gaps:
  https://github.com/PayPerQ/ppq-enclave-proxy
- How to verify the running enclave by hand:
  https://github.com/PayPerQ/ppq-enclave-proxy/blob/main/VERIFY.md
