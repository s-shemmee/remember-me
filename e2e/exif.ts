/**
 * Builds a JPEG with an EXIF block holding a GPS tag, to prove uploads
 * lose their location. `base` is a plain JPEG (made in the browser).
 */
export function withGpsExif(base: Buffer): Buffer {
  if (base[0] !== 0xff || base[1] !== 0xd8) throw new Error("not a JPEG");
  // TIFF, big-endian: IFD0 with one entry (GPSInfo → GPS IFD), and a GPS IFD
  // with one entry (GPSLatitudeRef = "N").
  const tiff = Buffer.from(
    [
      "4d4d002a00000008", // TIFF header, big-endian, IFD0 at offset 8
      "0001", // IFD0: 1 entry
      "8825000400000001" + "0000001a", // GPSInfo → offset 26
      "00000000", // no next IFD
      "0001", // GPS IFD: 1 entry
      "0001000200000002" + "4e000000", // GPSLatitudeRef = "N"
      "00000000", // no next IFD
    ].join(""),
    "hex",
  );
  const payload = Buffer.concat([Buffer.from("Exif\0\0", "binary"), tiff]);
  const length = payload.length + 2;
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, length >> 8, length & 0xff]), payload]);
  return Buffer.concat([base.subarray(0, 2), app1, base.subarray(2)]);
}

/** EXIF in a JPEG ("Exif\0\0") or WebP ("EXIF" chunk), or XMP. */
export function hasMetadata(bytes: Buffer): boolean {
  const text = bytes.toString("latin1");
  return text.includes("Exif\0\0") || text.includes("EXIF") || text.includes("<x:xmpmeta");
}
