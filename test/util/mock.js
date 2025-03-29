import { MockServer, FetchMocker } from 'mentoss';

export const mockFetch = baseUrls => {
  const servers = [baseUrls].flat().map(url => new MockServer(url));

  const mocker = new FetchMocker({
    servers
  });

  return [mocker, ...servers];
};
