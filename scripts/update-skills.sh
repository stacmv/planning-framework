#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE_DIR="${SCRIPT_DIR}/../skills"
TARGET_DIR="$(pwd)/.claude/skills"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --source)
            SOURCE_DIR="$2"
            shift 2
            ;;
        *)
            echo "Unknown argument: $1" >&2
            echo "Usage: $(basename "$0") [--source <path>]" >&2
            exit 1
            ;;
    esac
done

# Validate source directory
if [[ ! -d "$SOURCE_DIR" ]]; then
    echo "Error: source directory not found: $SOURCE_DIR" >&2
    exit 1
fi

# Check that source contains .md files
shopt -s nullglob
md_files=("$SOURCE_DIR"/*.md)
shopt -u nullglob

if [[ ${#md_files[@]} -eq 0 ]]; then
    echo "Error: no .md files found in source directory: $SOURCE_DIR" >&2
    exit 1
fi

# Create target directory if needed
mkdir -p "$TARGET_DIR"

# Counters
count_updated=0
count_new=0
count_unchanged=0

# Process each .md file
for src_file in "${md_files[@]}"; do
    filename="$(basename "$src_file")"
    dst_file="$TARGET_DIR/$filename"

    if [[ ! -f "$dst_file" ]]; then
        cp "$src_file" "$dst_file"
        printf "[new]       %s\n" "$filename"
        (( count_new++ )) || true
    elif diff -q "$src_file" "$dst_file" > /dev/null 2>&1; then
        printf "[unchanged] %s\n" "$filename"
        (( count_unchanged++ )) || true
    else
        cp "$src_file" "$dst_file"
        printf "[updated]   %s\n" "$filename"
        (( count_updated++ )) || true
    fi
done

echo ""
echo "${count_updated} updated, ${count_new} new, ${count_unchanged} unchanged"
