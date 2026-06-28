FROM node:26.4-bookworm-slim

# Update and install dependencies
RUN apt-get update
RUN apt-get install -y --no-install-recommends bash ca-certificates git ripgrep python3 python3-pip

# Clean up apt cache to reduce image size
RUN rm -rf /var/lib/apt/lists/*

# Install the pi-coding-agent
RUN npm install -g --ignore-scripts @earendil-works/pi-coding-agent@0.79.1

ENV PI_CONTAINERIZED=true

WORKDIR /workspace
RUN git config --global --add safe.directory /workspace

ENTRYPOINT ["pi"]