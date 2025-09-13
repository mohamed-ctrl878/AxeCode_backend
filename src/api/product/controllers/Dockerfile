FROM debian:bullseye-slim

# Install minimal requirements
RUN apt-get update && apt-get install -y \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -d /home/coderunner -s /bin/bash -u 1001 coderunner

# Create working directory and set permissions
RUN mkdir -p /home/coderunner/workspace && \
    chown -R coderunner:coderunner /home/coderunner

# Copy and set permissions for entrypoint
COPY entrypoint.sh /home/coderunner/
RUN chown coderunner:coderunner /home/coderunner/entrypoint.sh && \
    chmod +x /home/coderunner/entrypoint.sh

# Switch to non-root user
USER coderunner
WORKDIR /home/coderunner/workspace

ENTRYPOINT ["/home/coderunner/entrypoint.sh"]
