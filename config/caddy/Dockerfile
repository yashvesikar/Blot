ARG VERSION=2

FROM caddy:${VERSION}-builder AS builder

# Build the Caddy image with the xcaddy plugin to support custom plugins in the future
RUN xcaddy build

FROM caddy:${VERSION}

COPY --from=builder /usr/bin/caddy /usr/bin/caddy