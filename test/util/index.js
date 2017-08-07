import fs from 'fs';
import path from 'path';

export const readFile = file =>
  new Promise((resolve, reject) => {
    fs.readFile(path.resolve(file), 'utf8', (err, data) => {
      if (err) reject(err);
      resolve(data);
    });
  });

export const readJSON = file => readFile(file).then(JSON.parse);
