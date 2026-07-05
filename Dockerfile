FROM debian:trixie-slim

ARG PI_NODE_VERSION=26.4.0
ARG PI_VERSION=0.79.1

# Update and install dependencies. build-essential is intentionally included so
# sandbox-local dependency installs can build native npm packages.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
  bash \
  build-essential \
  ca-certificates \
  curl \
  git \
  python3 \
  python3-pip \
  ripgrep \
  tini \
  unzip \
  xz-utils \
  && rm -rf /var/lib/apt/lists/*

ENV MISE_DATA_DIR=/root/.local/share/mise \
  MISE_CACHE_DIR=/root/.cache/mise \
  PATH=/root/.local/bin:/root/.local/share/mise/shims:$PATH \
  PI_STABLE_NODE_VERSION=$PI_NODE_VERSION

# Pi itself runs on a stable Node provided by mise. Project commands get their
# own Node/npm versions later in docker-entrypoint.sh via BASH_ENV.
RUN curl -fsSL https://mise.run | sh \
  && mise install node@$PI_NODE_VERSION \
  && mise exec node@$PI_NODE_VERSION -- npm install -g --ignore-scripts @earendil-works/pi-coding-agent@$PI_VERSION

COPY docker-entrypoint.sh /usr/local/bin/pi-docker-entrypoint
RUN chmod +x /usr/local/bin/pi-docker-entrypoint

ENV PI_CONTAINERIZED=true

WORKDIR /workspace
RUN git config --global --add safe.directory /workspace

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/pi-docker-entrypoint"]
