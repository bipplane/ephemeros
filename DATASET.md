# Dataset Statement

Ephemeros uses a bring-your-own synthetic dataset.

Files:

```text
data/synthetic-restricted-context.json
mock-secure-enclave/proprietary_data.txt
data/vpn-synthetic-schema.md
vpn-target/ephemeros-vpn-health.txt
```

Contents:

- Synthetic bond-yield table schema.
- Synthetic query policy notes.
- Synthetic legacy client stub.
- Synthetic secure-enclave export with relevant and irrelevant schema fragments.
- Synthetic HTTP target text used for the Tailscale/local proof.

Compliance position:

- No company confidential data.
- No client data.
- No personal information.
- No social media data.
- No scraped website data.
- Created for this proof of concept.

Purpose:

The dataset stands in for restricted enterprise context. It lets Bob demonstrate the workflow safely: request context, read the filtered result, generate code, and clean up.
