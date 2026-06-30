FROM node:26.4-bookworm-slim

# Update and install dependencies
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    git \
    python3 \
    python3-pip \
    ripgrep \
    tini \
  && rm -rf /var/lib/apt/lists/*

# Install the pi-coding-agent
RUN npm install -g --ignore-scripts @earendil-works/pi-coding-agent@0.79.1

COPY docker-entrypoint.sh /usr/local/bin/pi-docker-entrypoint
RUN chmod +x /usr/local/bin/pi-docker-entrypoint

ENV PI_CONTAINERIZED=true

WORKDIR /workspace
RUN git config --global --add safe.directory /workspace

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/pi-docker-entrypoint"]