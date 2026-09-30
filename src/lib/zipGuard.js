// XLSX/XLSM files are ZIP archives (of XML). SheetJS's XLSX.read() fully decompresses
// every entry into memory before parsing anything — a small, highly-compressible
// malicious file ("zip bomb") can expand to gigabytes before sheet_to_json even runs,
// hanging Node's single event loop or exhausting memory for every user on the process.
//
// A ZIP's Central Directory stores each entry's uncompressed size in a plain (never
// compressed) fixed-offset field, so we can sum up what a file would expand to WITHOUT
// decompressing anything — cheap enough to run on every upload before handing it to
// XLSX.read(). Plain CSV isn't a ZIP archive at all (no compression, so no amplification
// risk), so this only applies to files that actually look like a ZIP.

const ZIP_LOCAL_FILE_SIG = 0x04034b50;
const EOCD_SIG = 0x06054b50;
const CENTRAL_DIR_SIG = 0x02014b50;

const MAX_TOTAL_UNCOMPRESSED_BYTES = 200 * 1024 * 1024; // 200MB — generous for any real workbook
const MAX_ENTRIES = 2000; // a real workbook has dozens to low hundreds of internal parts

function looksLikeZip(buffer) {
  return buffer.length >= 4 && buffer.readUInt32LE(0) === ZIP_LOCAL_FILE_SIG;
}

// Scans backward for the End Of Central Directory record. The EOCD's trailing comment
// field is variable-length (0-65535 bytes), so it isn't always the last 22 bytes.
function findEndOfCentralDirectory(buffer) {
  const maxCommentLength = 65535;
  const searchStart = Math.max(0, buffer.length - 22 - maxCommentLength);
  for (let i = buffer.length - 22; i >= searchStart; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIG) return i;
  }
  return -1;
}

// Returns null if safe, or a string reason if the file should be rejected.
function checkZipDecompressionSafety(buffer) {
  if (!looksLikeZip(buffer)) return null; // not a ZIP (e.g. plain CSV) — no amplification risk

  const eocdOffset = findEndOfCentralDirectory(buffer);
  if (eocdOffset === -1) return 'Could not read this file\'s structure (missing end-of-archive marker).';

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirSize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirOffset = buffer.readUInt32LE(eocdOffset + 16);

  if (totalEntries > MAX_ENTRIES) {
    return `This file has an unusually high number of internal parts (${totalEntries}) — please re-save it and try again.`;
  }
  if (centralDirOffset + centralDirSize > buffer.length) {
    return 'This file\'s internal structure looks corrupted or was tampered with.';
  }

  let totalUncompressed = 0;
  let pos = centralDirOffset;
  const centralDirEnd = centralDirOffset + centralDirSize;

  for (let i = 0; i < totalEntries; i++) {
    if (pos + 46 > centralDirEnd || pos + 46 > buffer.length) {
      return 'This file\'s internal structure looks corrupted or was tampered with.';
    }
    if (buffer.readUInt32LE(pos) !== CENTRAL_DIR_SIG) {
      return 'This file\'s internal structure looks corrupted or was tampered with.';
    }
    const uncompressedSize = buffer.readUInt32LE(pos + 24);
    const filenameLength = buffer.readUInt16LE(pos + 28);
    const extraFieldLength = buffer.readUInt16LE(pos + 30);
    const commentLength = buffer.readUInt16LE(pos + 32);

    totalUncompressed += uncompressedSize;
    if (totalUncompressed > MAX_TOTAL_UNCOMPRESSED_BYTES) {
      return 'This file would expand to an unreasonably large size when opened — it may be corrupted or malicious.';
    }

    pos += 46 + filenameLength + extraFieldLength + commentLength;
  }

  return null;
}

module.exports = { checkZipDecompressionSafety };
