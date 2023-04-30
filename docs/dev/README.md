# External dependencies & APIs

## GitHub

- [octokit/rest.js][1]
- [repos.createRelease][2]
- [repos.uploadReleaseAsset][3]

## GitLab

- [GitLab API][4]
- [Releases API][5]
- [Upload a file][6]
- [Create a new release][7]

### Docker

- [Install GitLab with Docker][8]
- [GitLab Docker images][9]

To run the nightly build of GitLab:

```bash
docker run --hostname localhost --publish 443:443 --publish 80:80 --publish 22:22 --name gitlab --restart always --volume config:/etc/gitlab --volume logs:/var/log/gitlab --volume data:/var/opt/gitlab gitlab/gitlab-ce:nightly
```

[1]: https://github.com/octokit/rest.js
[2]: https://octokit.github.io/rest.js/#repos-create-release
[3]: https://octokit.github.io/rest.js/#repos-upload-release-asset
[4]: https://docs.gitlab.com/ce/api/
[5]: https://docs.gitlab.com/ce/api/releases/
[6]: https://docs.gitlab.com/ce/api/projects.html#upload-a-file
[7]: https://docs.gitlab.com/ce/api/tags.html#create-a-new-release
[8]: https://docs.gitlab.com/ce/install/docker.html
[9]: https://hub.docker.com/r/gitlab/gitlab-ce/
