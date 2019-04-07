const fs = require('fs');
const path = require('path');
const sh = require('shelljs');
const tmp = require('tmp');

const mkTmpDir = () => {
  const dir = tmp.dirSync({ prefix: 'release-it-' });
  return dir.name;
};

const readFile = file =>
  new Promise((resolve, reject) => {
    fs.readFile(path.resolve(file), 'utf8', (err, data) => {
      if (err) reject(err);
      resolve(data);
    });
  });

const gitAdd = (content, file, message) => {
  sh.ShellString(content).toEnd(file);
  sh.exec(`git add ${file}`);
  sh.exec(`git commit -m "${message}"`);
};

module.exports = {
  mkTmpDir,
  readFile,
  gitAdd
};
