# External dependencies & APIs

## GitHub

- [octokit/rest.js](https://github.com/octokit/rest.js)
- [repos.createRelease](https://octokit.github.io/rest.js/#repos-create-release)
- [repos.uploadReleaseAsset](https://octokit.github.io/rest.js/#repos-upload-release-asset)

## GitLab

- [GitLab API](https://docs.gitlab.com/ce/api/)
- [Releases API](https://docs.gitlab.com/ce/api/releases/)
- [Upload a file](https://docs.gitlab.com/ce/api/projects.html#upload-a-file)
- [Create a new release](https://docs.gitlab.com/ce/api/tags.html#create-a-new-release)

### Docker

- [Install GitLab with Docker](https://docs.gitlab.com/ce/install/docker.html)
- [GitLab Docker images](https://hub.docker.com/r/gitlab/gitlab-ce/)

To run the nightly build of GitLab:

```bash
docker run --hostname localhost --publish 443:443 --publish 80:80 --publish 22:22 --name gitlab --restart always --volume config:/etc/gitlab --volume logs:/var/log/gitlab --volume data:/var/opt/gitlab gitlab/gitlab-ce:nightly
```
