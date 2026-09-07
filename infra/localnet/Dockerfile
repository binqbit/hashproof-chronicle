# syntax=docker/dockerfile:1

# Reuse the official Anchor CLI binary/proxies, but select the Rust and Agave
# toolchains explicitly below. Host toolchains and target/ are never copied.
FROM solanafoundation/anchor:v0.31.1 AS anchor-tools
FROM node:22-bookworm-slim AS node-tools
FROM ubuntu:24.04 AS validator-tools

# Official Agave release, matching the validator used for contract verification.
# Update the version and checksum together.
ENV PATH="/opt/solana-release/bin:${PATH}"
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl bzip2 libssl3 libudev1 \
    && rm -rf /var/lib/apt/lists/* \
    && curl --fail --location --retry 3 \
       https://github.com/anza-xyz/agave/releases/download/v4.0.3/solana-release-x86_64-unknown-linux-gnu.tar.bz2 \
       -o /tmp/solana.tar.bz2 \
    && echo "50a6ed0474c958e1ce3fba298f45fc1cd3117db5c5df253cc0c7d8c827e813a8  /tmp/solana.tar.bz2" | sha256sum --check \
    && tar -xjf /tmp/solana.tar.bz2 -C /opt \
    && rm /tmp/solana.tar.bz2 \
    && solana-test-validator --version

FROM validator-tools AS contract-build
ENV CARGO_HOME=/usr/local/cargo \
    RUSTUP_HOME=/usr/local/rustup \
    RUSTUP_TOOLCHAIN=nightly-2026-09-06
ENV PATH="/usr/local/cargo/bin:${PATH}"
COPY --from=anchor-tools /root/.cargo/bin/ /usr/local/cargo/bin/
COPY --from=node-tools /usr/local/bin/node /usr/local/bin/node
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential pkg-config libssl-dev git \
    && rm -rf /var/lib/apt/lists/* \
    && rustup toolchain install "$RUSTUP_TOOLCHAIN" --profile minimal \
    && anchor --version \
    && node --version

WORKDIR /workspace/hash-timestamp
COPY hash-timestamp/ ./
COPY scripts/copy-metadata.sh /workspace/scripts/copy-metadata.sh
# Anchor 0.31 forwards Cargo args to both IDL and cargo-build-sbf, whose argument
# parsers differ. Check the lockfile explicitly instead of forwarding --locked.
RUN cp Cargo.lock /tmp/hash-timestamp-Cargo.lock \
    && bash scripts/test.sh --build-only \
    && cmp Cargo.lock /tmp/hash-timestamp-Cargo.lock \
    && sh /workspace/scripts/copy-metadata.sh /workspace/hash-timestamp

# Optional public artifact export via Docker BuildKit's local output.
FROM scratch AS artifacts
COPY --from=contract-build /workspace/accounts/build/ /

# Keep compilers, source, build caches and generated keypairs out of runtime.
FROM validator-tools AS localnet
COPY --from=contract-build /workspace/accounts/build/ /artifacts/
COPY examples/proof-chain/ledger/ /fixtures/proof-chain/
COPY infra/localnet/entrypoint.sh /usr/local/bin/localnet-entrypoint
WORKDIR /ledger
ENTRYPOINT ["sh", "/usr/local/bin/localnet-entrypoint"]
