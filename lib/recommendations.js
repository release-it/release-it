const conventionalRecommendedBump = require('conventional-recommended-bump');

class Recommendations {
  getRecommendationDetails(increment) {
    const [system, preset] = (increment || '').split(':');
    return { system, preset };
  }
  isRecommendation(increment) {
    const { system } = this.getRecommendationDetails(increment);
    return system === 'conventional';
  }
  getRecommendedType(increment) {
    const { system, preset } = this.getRecommendationDetails(increment);
    if (system === 'conventional') {
      return this.getConventionalRecommendedBump(preset);
    }
    return null;
  }
  getConventionalRecommendedBump(preset) {
    return new Promise((resolve, reject) => {
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
  }
}

module.exports = Recommendations;
