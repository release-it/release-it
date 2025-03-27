import { create as createTar } from 'tar'
import { Readable } from 'node:stream'

export function createRemoteTarBlob(
  dir,
) {
  const stream = new Readable({
    read() {},
  })

  createTar(
    {
      gzip: true,
      portable: true,
      sync: false,
      cwd: dir,
    },
    ['.']
  )
    .on('data', (chunk) => stream.push(chunk))
    .on('end', () => stream.push(null));

  return stream;
}
