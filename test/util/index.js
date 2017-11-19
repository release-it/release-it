const fs = require('fs');
const path = require('path');

const readFile = file =>
  new Promise((resolve, reject) => {
    fs.readFile(path.resolve(file), 'utf8', (err, data) => {
      if (err) reject(err);
      resolve(data);
    });
  });

const readJSON = file => readFile(file).then(JSON.parse);

module.exports = {
  readFile,
  readJSON
};
