import { Readable } from 'node:stream';
import { create as createTar } from 'tar';
import { appendFile, mkTmpDir } from './helpers.js';

export function createTarBlob(dir) {
  const stream = new Readable({
    read() {}
  });

  createTar(
    {
      gzip: true,
      portable: true,
      sync: false,
      cwd: dir
    },
    ['.']
  )
    .on('data', chunk => stream.push(chunk))
    .on('end', () => stream.push(null));

  return stream;
}

export function createTarBlobByRawContents(contents) {
  const dir = mkTmpDir();
  for (const [key, value] of Object.entries(contents)) {
    appendFile(value, key, dir);
  }

  return createTarBlob(dir);
}
