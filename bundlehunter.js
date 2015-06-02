var _ = require('lodash'),
    path = require('path'),
    fs = require('fs'),
    glob = require('glob');

module.exports = (function bundleHunter() {
  var bundleRegex = /<!-- bundle:([a-z]+)\s(\w+) -->((?:.|\n)+?)<!-- \/bundle -->/gim,
      tagRegex = /<.*?(?:(?:src)|(?:href)|(?:data))="(.+?)".*?>/gi,
      bundlesBySourceFile = {};

  return function findIn(sourceFiles, options) {
    var outputBundles = {},
        parseBundle;

    options = _.defaults({}, options, {
      types: ['js', 'css'],
      excludeBundles: [],
      force: false
    });

    parseBundle = _.spread(function spreadParseBundle(match, type, name, contents) {
      var tag,
          bundleFiles = [];

      while (tag = tagRegex.exec(contents)) {
        bundleFiles.push(tag[1]);
      }

      // Reset index so the next bundle can re-use this regex
      tagRegex.lastIndex = 0;

      return {
        type: type,
        name: name,
        files: bundleFiles
      };
    });

    if (_.isString(sourceFiles)) {
      if (glob.hasMagic(sourceFiles)) {
        sourceFiles = glob.sync(sourceFiles);
      } else {
        sourceFiles = [sourceFiles];
      }
    }

    _.each(sourceFiles, function huntInFile(file) {
      var fileContents,
          bundleString,
          bundle;

      if (!bundlesBySourceFile[file] || options.force) {
        bundlesBySourceFile[file] = {};

        fileContents = fs.readFileSync(file, {encoding: 'utf8'});

        while (bundleString = bundleRegex.exec(fileContents)) {
          bundle = parseBundle(bundleString);

          if (!bundlesBySourceFile[file][bundle.type]) {
            bundlesBySourceFile[file][bundle.type] = [];
          }

          bundlesBySourceFile[file][bundle.type].push(bundle);
        }

        // Reset index so the next bundle can re-use this regex
        bundleRegex.lastIndex = 0;
      }

      _.each(bundlesBySourceFile[file], function setOutputBundles(bundles, type) {
        if (_.contains(options.types, type)) {
          if (!outputBundles[type]) {
            outputBundles[type] = [];
          }

          outputBundles[type] = outputBundles[type].concat(bundles);
        }
      });
    });

    _.each(outputBundles, function filterOutputBundles(bundles, type) {
      outputBundles[type] = _.reject(bundles, function checkBundleAgainstExclusions(bundle) {
        return _.contains(options.excludeBundles, bundle.name);
      });
    });

    return outputBundles;
  };
})();
