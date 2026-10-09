#!/usr/bin/env bash
set -euo pipefail

export AWS_REGION="${AWS_REGION:-ap-southeast-2}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-$AWS_REGION}"

base=/opt/yitu-rental
umask 077

aws ssm get-parameters-by-path \
  --path /yitu-rental/production/app/ \
  --recursive \
  --with-decryption \
  --output json \
  | python3 -c '
import json, os, sys
destination = sys.argv[1]
parameters = json.load(sys.stdin).get("Parameters", [])
if not parameters:
    raise RuntimeError("no YITU Rental parameters returned from SSM")
lines = []
for parameter in sorted(parameters, key=lambda item: item["Name"]):
    name = parameter["Name"].rsplit("/", 1)[-1]
    value = parameter["Value"]
    if "\n" in value or "\r" in value:
        value = value.replace("\\", "\\\\").replace("\n", "\\n").replace("\r", "\\r")
    lines.append(f"{name}={value}")
temporary = destination + ".tmp"
with open(temporary, "w", encoding="utf-8") as handle:
    handle.write("\n".join(lines) + "\n")
os.chmod(temporary, 0o600)
os.replace(temporary, destination)
print(f"{len(lines)} environment variables written")
' "$base/.env"
