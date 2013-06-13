/*
 * grunt-audit
 * https://github.com/azakus/grunt-audit
 *
 * Copyright (c) 2013 Daniel Freedman
 * Licensed under the BSD license.
 */

'use strict';

module.exports = function(grunt) {
  var crypto = require('crypto');
  var path = require('path');

  grunt.registerMultiTask('audit', 'Generate audit trail with sha1 hashes', function() {
    // Merge task-specific and/or target-specific options with these defaults.
    var options = this.options({
      separator: grunt.util.linefeed,
      repos: []
    });

    function fileHash(filepath) {
      var blob = grunt.file.read(filepath);
      var sha1sum = crypto.createHash('sha1');
      sha1sum.update(blob);
      var hex = sha1sum.digest('hex');
      return filepath + ' ' + hex;
    }

    function findRev(repoPath, callback) {
      grunt.util.spawn({
        cmd: 'git',
        args: ['--git-dir', path.resolve(repoPath, '.git'), 'rev-parse', 'HEAD']
      }, function(error, result, code) {
        if (error) {
          callback(error);
        } else {
          callback(null, path.basename(path.resolve(repoPath)) + ' ' + result);
        }
      });
    }

    function repoRevs(repos, callback) {
      repos = repos || [];
      grunt.util.async.map(repos, findRev, function(err, results) {
        if (err) {
          callback(err);
        } else {
          callback(null, results);
        }
      });
    }

    function moduleVersions(callback) {
      grunt.util.spawn({
        cmd: 'npm',
        args: ['list', '--depth=0']
      }, function(error, result, code) {
        callback(null, result.stdout);
      });
    }

    function out(revs, hashes, modules, dest) {
      // build audit log
      var log = [
        'AUDIT LOG ' + grunt.template.today('isoDateTime'),
        '---------',
        '',
        'NODEJS INFORMATION',
        'nodejs: ' + process.version,
        'modules:',
        modules,
        '',
        'REPO REVISIONS',
        '==============',
        revs.join(options.separator),
        '',
        'BUILD HASHES',
        '============',
        hashes
      ].join(options.separator);

      if (dest) {
        grunt.file.write(dest, log);
        grunt.log.writeln('Wrote audit log:', dest, 'successfully');
      } else {
        grunt.log.writeln(log);
      }
    }

    var done = this.async();
    // Iterate over all specified file groups.
    this.files.forEach(function(f) {
      // Concat specified files.
      var src = f.src.filter(function(filepath) {
        // Warn on and remove invalid source files (if nonull was set).
        if (!grunt.file.exists(filepath)) {
          grunt.log.warn('Source file "' + filepath + '" not found.');
          return false;
        } else {
          return true;
        }
      }).map(fileHash).join(options.separator);
      grunt.util.async.parallel([
        function(callback) {
          repoRevs(options.repos, callback);
        },
        function(callback) {
          moduleVersions(callback)
        }
      ], function(err, results) {
        if (!err) {
          out(results[0], src, results[1], f.dest);
        }
        done(err);
      });
    });
  });
};
