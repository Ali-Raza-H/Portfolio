#!/usr/bin/env bash
#
# build-share-assets.sh — builds the icon set and the social share cards.
#
#   ./tools/build-share-assets.sh
#
# 1. Rasterises assets/icons/favicon.svg into the favicon PNG/ICO set.
# 2. Renders one 1200x630 Open Graph card per page into assets/social/.
#
# Requires: rsvg-convert, ImageMagick, curl.
#
# The cards use the same four typefaces as the site. Any face that is not
# installed is fetched from the Google Fonts repo for this run only — it is
# registered through a temporary fontconfig, nothing is installed system-wide.
# Override a face explicitly, e.g.
#
#   DISPLAY_FONT="Inter" ./tools/build-share-assets.sh
#
# These are build artefacts: the PNGs are what ships. Nothing here is loaded by
# the site itself.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ICONS="assets/icons"
SOCIAL="assets/social"

# Palette — kept in step with the tokens in css/global.css.
C_BG="#06080e"
C_ACCENT="#4fa8ff"
C_TEXT="#eef2f8"
C_MUTED="#8b97aa"
C_LINE="#1a2231"

SITE_DISPLAY="ali-raza-h.github.io/Portfolio"

# family|path within the google/fonts repo
FONT_SOURCES=(
  "Archivo|archivo/Archivo%5Bwdth,wght%5D.ttf"
  "Chakra Petch|chakrapetch/ChakraPetch-Regular.ttf"
  "Chakra Petch|chakrapetch/ChakraPetch-SemiBold.ttf"
  "Chakra Petch|chakrapetch/ChakraPetch-Bold.ttf"
  "Inter|inter/Inter%5Bopsz,wght%5D.ttf"
  "JetBrains Mono|jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf"
)
GF_BASE="https://github.com/google/fonts/raw/main/ofl"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Note: the family list is captured first and matched with a herestring. Using
# `fc-list | grep -q` would let grep close the pipe early, and under `pipefail`
# the resulting SIGPIPE upstream makes the match look like a failure.
have_font() {
  local families
  families="$(fc-list : family 2>/dev/null)" || return 1
  grep -qix "$1" <<< "$(tr ',' '\n' <<< "$families")"
}

# --- Fetch whatever is missing, for this run only --------------------------
mkdir -p "$TMP/fonts"
fetched=0
for entry in "${FONT_SOURCES[@]}"; do
  family="${entry%%|*}"
  path="${entry#*|}"

  # Already installed, or already queued in this loop? Then nothing to do.
  if have_font "$family"; then continue; fi
  if [ -f "$TMP/fonts/$(basename "$path")" ]; then continue; fi

  if curl -sSLf --max-time 40 -o "$TMP/fonts/$(basename "$path")" "$GF_BASE/$path"; then
    fetched=$((fetched + 1))
  else
    echo "! could not fetch $family" >&2
  fi
done

if [ "$fetched" -gt 0 ]; then
  cat > "$TMP/fontconfig.conf" <<EOF
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>$TMP/fonts</dir>
  <cachedir>$TMP/fc-cache</cachedir>
  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>
</fontconfig>
EOF
  export FONTCONFIG_FILE="$TMP/fontconfig.conf"
  echo "· registered $fetched font file(s) for this build"
fi

# Resolve each role, falling back if a face is unavailable on this machine.
resolve_font() {
  local preferred="$1" fallback="$2"
  if have_font "$preferred"; then printf '%s' "$preferred"; else printf '%s' "$fallback"; fi
}

DISPLAY_FONT="${DISPLAY_FONT:-$(resolve_font "Archivo" "Inter")}"
UI_FONT="${UI_FONT:-$(resolve_font "Chakra Petch" "Inter")}"
BODY_FONT="${BODY_FONT:-$(resolve_font "Inter" "DejaVu Sans")}"
MONO_FONT="${MONO_FONT:-$(resolve_font "JetBrains Mono" "DejaVu Sans Mono")}"

echo "· display=$DISPLAY_FONT  ui=$UI_FONT  body=$BODY_FONT  mono=$MONO_FONT"

# --- Icons -----------------------------------------------------------------
mkdir -p "$ICONS" "$SOCIAL"

if [ ! -f "$ICONS/favicon.svg" ]; then
  echo "! $ICONS/favicon.svg is missing" >&2
  exit 1
fi

for size in 16 32; do
  rsvg-convert -w "$size" -h "$size" "$ICONS/favicon.svg" -o "$ICONS/favicon-$size.png"
done

rsvg-convert -w 180 -h 180 "$ICONS/favicon.svg" -o "$ICONS/apple-touch-icon.png"

# 48px is only needed inside the multi-resolution .ico, so it is not committed.
rsvg-convert -w 48 -h 48 "$ICONS/favicon.svg" -o "$TMP/favicon-48.png"
magick "$ICONS/favicon-16.png" "$ICONS/favicon-32.png" "$TMP/favicon-48.png" "$ICONS/favicon.ico"

echo "· icons    -> $ICONS"

# --- Social cards ----------------------------------------------------------
# og_card <name> <eyebrow> <title> <subtitle line 1> <subtitle line 2>
og_card() {
  local name="$1" eyebrow="$2" title="$3" sub1="$4" sub2="$5"

  cat > "$TMP/$name.svg" <<SVG
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="$C_BG"/>
  <rect width="6" height="630" fill="$C_ACCENT"/>

  <text x="88" y="116" font-family="$MONO_FONT" font-size="22" font-weight="500" fill="$C_ACCENT" letter-spacing="4">$eyebrow</text>

  <text x="88" y="272" font-family="$DISPLAY_FONT" font-size="84" font-weight="900" fill="$C_TEXT" letter-spacing="-2.5">$title</text>

  <text x="88" y="352" font-family="$BODY_FONT" font-size="26" fill="$C_MUTED">$sub1</text>
  <text x="88" y="390" font-family="$BODY_FONT" font-size="26" fill="$C_MUTED">$sub2</text>

  <rect x="88" y="466" width="1024" height="1" fill="$C_LINE"/>

  <text x="88" y="528" font-family="$UI_FONT" font-size="22" font-weight="700" fill="$C_TEXT" letter-spacing="2">ALI RAZA</text>
  <text x="1112" y="528" font-family="$MONO_FONT" font-size="20" fill="$C_MUTED" text-anchor="end">$SITE_DISPLAY</text>
</svg>
SVG

  rsvg-convert -w 1200 -h 630 "$TMP/$name.svg" -o "$SOCIAL/$name.png"
}

og_card "og-home" \
  "SOFTWARE DEVELOPER / AI &amp; SYSTEMS ENGINEERING" \
  "Ali Raza" \
  "Hands-on experience across AI systems, full-stack web development," \
  "automation, and Linux environments."

og_card "og-skills" \
  "SKILLS &amp; JOURNEY" \
  "Technical Expertise" \
  "Python, AI/LLM engineering, full-stack development, automation," \
  "and Linux systems — with the timeline behind them."

og_card "og-projects" \
  "PROJECTS" \
  "What I've Built" \
  "CIEL, LifeOS, AutoDesign Markup Language," \
  "and the Portable Compute Protocol."

og_card "og-contact" \
  "CONTACT" \
  "Get In Touch" \
  "Software developer specialising in AI systems, full-stack web" \
  "development, automation, and Linux engineering."

echo "· cards    -> $SOCIAL"
echo "done."
