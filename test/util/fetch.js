import { Readable } from 'node:stream';
import { create as createTar } from 'tar';

export function createRemoteTarBlob(dir) {
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
