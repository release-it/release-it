const conventionalRecommendedBump = require('conventional-recommended-bump');

const getConventionalRecommendedBump = preset =>
  new Promise((resolve, reject) => {
    conventionalRecommendedBump(
      {
        preset
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result.releaseType);
      }
    );
  });

const getRecommendedType = async increment => {
  const [system, preset] = (increment || '').split(':');
  if (system === 'conventional') {
    return await getConventionalRecommendedBump(preset);
  }
  return null;
};

const getIsLateChangeLog = ({ increment }) => {
  const [system] = (increment || '').split(':');
  return system === 'conventional';
};

module.exports = {
  getRecommendedType,
  getIsLateChangeLog
};
