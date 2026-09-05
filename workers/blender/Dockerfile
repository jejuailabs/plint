FROM ubuntu:22.04

ARG DEBIAN_FRONTEND=noninteractive
ARG BLENDER_VERSION=4.3.2

WORKDIR /app

# Blender's headless renderer still needs these shared libraries without a desktop session.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    libegl1 \
    libdbus-1-3 \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    libsm6 \
    libx11-6 \
    libxext6 \
    libxi6 \
    libxkbcommon0 \
    libxrender1 \
    python3 \
    python3-pip \
    xz-utils \
  && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL "https://download.blender.org/release/Blender4.3/blender-${BLENDER_VERSION}-linux-x64.tar.xz" -o /tmp/blender.tar.xz \
  && tar -xJf /tmp/blender.tar.xz -C /opt \
  && ln -s "/opt/blender-${BLENDER_VERSION}-linux-x64/blender" /usr/local/bin/blender \
  && rm /tmp/blender.tar.xz

COPY workers/blender/requirements.txt /app/requirements.txt
RUN pip3 install --no-cache-dir -r /app/requirements.txt

COPY workers/blender/handler.py /app/handler.py
COPY workers/blender/scripts /app/scripts

ENV PYTHONUNBUFFERED=1
CMD ["python3", "-u", "/app/handler.py"]
