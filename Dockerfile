FROM ubuntu:22.04

RUN apt-get -y update && \
    apt-get install -y curl git ruby-dev build-essential libffi-dev libxslt-dev libxml2-dev dos2unix parallel
RUN git clone https://github.com/shinkuan/mjai-3p.git && \
    cd mjai-3p && \
    gem build mjai.gemspec && \
    gem install ./mjai-0.0.7.gem
RUN mkdir -p /workspace/outputs

COPY <<'EOF' run.sh
#!/bin/bash
PAT="([0-9a-z\-]+)\.mjlog"

convert_mjai () {
  echo "Processing $1..."
  file_name="${1##*/}"
  file="${file_name%.*}"
  mjai convert "$1" "/workspace/outputs/${file}.mjson"
  # if [[ "$1" =~ $PAT ]]; then
  #   mjai convert "$1" "/workspace/outputs/${BASH_REMATCH[1]}.mjson"
  # fi
}

export -f convert_mjai
find "$1" -type f -name '*.mjlog' | parallel -j 4 convert_mjai
EOF
RUN chmod +x run.sh
RUN dos2unix /run.sh

ENTRYPOINT ["bash", "/run.sh"]
