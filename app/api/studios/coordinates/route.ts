import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

type ParsedCoordinates = {
  latitude: number;
  longitude: number;
};

function parseEwkbHexPoint(hex: string): ParsedCoordinates | null {
  // PostGIS EWKB hex for POINT, e.g. 0101000020E6100000...
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length < 42 || hex.length % 2 !== 0) {
    return null;
  }

  try {
    const buffer = Buffer.from(hex, 'hex');
    const littleEndian = buffer.readUInt8(0) === 1;
    const wkbType = littleEndian ? buffer.readUInt32LE(1) : buffer.readUInt32BE(1);
    const hasSrid = (wkbType & 0x20000000) !== 0;
    const geometryType = wkbType & 0x0fffffff;

    // 1 = Point in WKB
    if (geometryType !== 1) return null;

    let offset = 5;
    if (hasSrid) {
      // Skip SRID (usually 4326)
      offset += 4;
    }

    if (buffer.length < offset + 16) return null;

    const x = littleEndian ? buffer.readDoubleLE(offset) : buffer.readDoubleBE(offset);
    const y = littleEndian ? buffer.readDoubleLE(offset + 8) : buffer.readDoubleBE(offset + 8);

    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

    // EWKB Point coordinates are [longitude, latitude]
    return { longitude: x, latitude: y };
  } catch {
    return null;
  }
}

function parseCoordinates(location: unknown): ParsedCoordinates | null {
  if (!location) return null;

  // GeoJSON shape: { type: 'Point', coordinates: [lng, lat] }
  if (typeof location === 'object' && location !== null && 'coordinates' in location) {
    const coordinates = (location as { coordinates?: unknown }).coordinates;
    if (
      Array.isArray(coordinates) &&
      coordinates.length >= 2 &&
      typeof coordinates[0] === 'number' &&
      typeof coordinates[1] === 'number'
    ) {
      return {
        longitude: coordinates[0],
        latitude: coordinates[1],
      };
    }
  }

  // Object shape: { longitude, latitude } or { lng, lat }
  if (typeof location === 'object' && location !== null) {
    const withLatLng = location as {
      latitude?: unknown;
      longitude?: unknown;
      lat?: unknown;
      lng?: unknown;
    };

    if (typeof withLatLng.latitude === 'number' && typeof withLatLng.longitude === 'number') {
      return {
        latitude: withLatLng.latitude,
        longitude: withLatLng.longitude,
      };
    }

    if (typeof withLatLng.lat === 'number' && typeof withLatLng.lng === 'number') {
      return {
        latitude: withLatLng.lat,
        longitude: withLatLng.lng,
      };
    }
  }

  // WKT shape: "POINT(lng lat)"
  if (typeof location === 'string') {
    // EWKB hex shape: "0101000020E6100000..."
    const ewkbPoint = parseEwkbHexPoint(location);
    if (ewkbPoint) {
      return ewkbPoint;
    }

    const pointMatch = location.match(/POINT\s*\(\s*(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s*\)/i);
    if (pointMatch) {
      return {
        longitude: Number(pointMatch[1]),
        latitude: Number(pointMatch[2]),
      };
    }
  }

  return null;
}

export async function GET() {
  try {
    const { data: studios, error } = await supabase
      .from('studios')
      .select(
        `
        id,
        name,
        type,
        address,
        is_featured,
        location
      `
      )
      .order('name');

    if (error) {
      console.error('Error fetching studio coordinates:', error);
      return NextResponse.json({ error: 'Failed to fetch studio coordinates' }, { status: 500 });
    }

    console.log(
      `[studios/coordinates] fetched studios: ${studios?.length || 0}`
    );
    if (studios && studios.length > 0) {
      console.log(
        '[studios/coordinates] sample raw locations:',
        studios.slice(0, 5).map((studio) => ({
          id: studio.id,
          name: studio.name,
          location: studio.location,
        }))
      );
    }

    const studiosWithoutCoordinates: Array<{ id: string; name: string; location: unknown }> = [];

    const normalizedStudios = (studios || [])
      .map((studio) => {
        const coordinates = parseCoordinates(studio.location);
        if (!coordinates) {
          studiosWithoutCoordinates.push({
            id: studio.id,
            name: studio.name,
            location: studio.location,
          });
          return null;
        }

        return {
          id: studio.id,
          name: studio.name,
          type: studio.type,
          address: studio.address,
          is_featured: studio.is_featured,
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
        };
      })
      .filter((studio): studio is NonNullable<typeof studio> => studio !== null);

    console.log(
      `[studios/coordinates] normalized: ${normalizedStudios.length}, skipped (no coordinates): ${studiosWithoutCoordinates.length}`
    );
    if (studiosWithoutCoordinates.length > 0) {
      console.log(
        '[studios/coordinates] skipped studios sample:',
        studiosWithoutCoordinates.slice(0, 10)
      );
    }

    return NextResponse.json({
      success: true,
      data: normalizedStudios,
    });
  } catch (error) {
    console.error('Studio coordinates API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
