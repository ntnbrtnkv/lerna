"use strict";

const fs = require("fs-extra");
const ssri = require("ssri");
const tar = require("tar");

module.exports = getPacked;

function getPacked(pkg, tmpFilePath, outputFileName) {
  const bundledWanted = new Set(pkg.bundleDependencies || pkg.bundledDependencies || []);
  const bundled = new Set();
  const files = [];

  let totalEntries = 0;
  let totalEntrySize = 0;

  return tar
    .t({
      file: tmpFilePath,
      onentry(entry) {
        totalEntries += 1;
        totalEntrySize += entry.size;

        const p = entry.path;

        if (p.startsWith("package/node_modules/")) {
          const name = p.match(/^package\/node_modules\/((?:@[^/]+\/)?[^/]+)/)[1];

          if (bundledWanted.has(name)) {
            bundled.add(name);
          }
        } else {
          files.push({
            path: entry.path.replace(/^package\//, ""),
            size: entry.size,
            mode: entry.mode,
          });
        }
      },
      strip: 1,
    })
    .then(() =>
      Promise.all([
        fs.stat(tmpFilePath),
        ssri.fromStream(fs.createReadStream(tmpFilePath), {
          algorithms: ["sha1", "sha512"],
        }),
      ])
    )
    .then(([stat, { sha1, sha512 }]) => {
      const shasum = sha1[0].hexDigest();

      return {
        id: `${pkg.name}@${pkg.version}`,
        name: pkg.name,
        version: pkg.version,
        size: stat.size,
        unpackedSize: totalEntrySize,
        shasum,
        integrity: ssri.parse(sha512[0]),
        filename: outputFileName,
        files,
        entryCount: totalEntries,
        bundled: Array.from(bundled),
      };
    });
}
