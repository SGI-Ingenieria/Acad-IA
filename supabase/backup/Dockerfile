FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    coreutils \
    gzip \
    postgresql-client \
    rclone \
    tar \
  && rm -rf /var/lib/apt/lists/*

COPY supabase/backup/run.sh /usr/local/bin/acad-ia-backup

RUN chmod 0555 /usr/local/bin/acad-ia-backup

USER 65532:65532

ENTRYPOINT ["/usr/local/bin/acad-ia-backup"]
