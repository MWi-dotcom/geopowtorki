#!/usr/bin/env bash
# Pobiera warstwy Natural Earth (public domain) potrzebne do `npm run data:build`.
set -euo pipefail
DIR="${NE_DIR:-.ne}"
mkdir -p "$DIR"
BASE=https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson
for f in ne_10m_geography_regions_polys ne_10m_geography_marine_polys ne_10m_geography_regions_points \
         ne_10m_geography_regions_elevation_points ne_10m_rivers_lake_centerlines ne_10m_lakes \
         ne_10m_antarctic_ice_shelves_polys ne_10m_lakes_historic ne_50m_land; do
  [ -f "$DIR/$f.geojson" ] || curl -fsSL -o "$DIR/$f.geojson" "$BASE/$f.geojson"
done
echo "OK: $DIR"
