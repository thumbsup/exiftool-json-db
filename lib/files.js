const async = require('async')
const debug = require('debug')('exiftool-json-db')
const EventEmitter = require('events')
const fs = require('fs')
const glob = require('glob')
const moment = require('moment')
const path = require('path')
const exiftool = require('./exiftool')

const PHOTO_EXT = ['bmp', 'gif', 'jpg', 'jpeg', 'png', 'tif', 'tiff', 'webp']
const VIDEO_EXT = ['3gp', 'flv', 'm2ts', 'mkv', 'mp4', 'mov', 'mts', 'ogg', 'ogv', 'webm']
const MEDIA_GLOB = '**/*.{' + PHOTO_EXT.join(',') + ',' + VIDEO_EXT.join(',') + '}'
const EXIF_DATE_FORMAT = 'YYYY:MM:DD HH:mm:ssZ'

exports.read = function (mediaPath, existingData) {
  const emitter = new EventEmitter()

  // hashmap to lookup existing file metadata easily
  const fileMap = existingData.reduce(function (acc, file) {
    acc[file.SourceFile] = file
    return acc
  }, {})

  function findFiles (callback) {
    const globOptions = {
      cwd: mediaPath,
      nonull: false,
      nocase: true
    }
    glob(MEDIA_GLOB, globOptions, callback)
  }

  function readStats (filePath, callback) {
    const absolute = path.join(mediaPath, filePath)
    fs.stat(absolute, function (err, stats) {
      if (err) return callback(err)
      callback(null, {
        absolute: absolute,
        relative: filePath,
        fileDate: stats.mtime.getTime()
      })
    })
  }

  findFiles((err, files) => {
    if (err) return emitter.emit('error', err)
    async.mapLimit(files, 1, readStats, (err, stats) => {
      if (err) return emitter.emit('error', err)
      debug(`Found ${stats.length} files`)
      const paths = findNewer(fileMap, stats)
      emitter.emit('stats', {
        unchanged: paths.unchanged.length,
        added: paths.added.length,
        modified: paths.modified.length,
        deleted: paths.deleted.length,
        total: files.length
      })
      const toProcess = union(paths.added, paths.modified)
      exiftool.read(mediaPath, toProcess, (progress) => {
        emitter.emit('file', progress)
      }, (err, newData) => {
        if (err) return emitter.emit('error', err)
        const unchangedData = paths.unchanged.map(u => fileMap[u])
        const all = union(unchangedData, newData)
        emitter.emit('done', all)
      })
    })
  })

  return emitter
}

function findNewer (databaseMap, diskStats) {
  var i = 0
  const unchanged = []
  const added = []
  const modified = []
  // find which items have changed
  for (i = 0; i < diskStats.length; ++i) {
    var filePath = diskStats[i].relative
    var fromDisk = diskStats[i]
    var fromDatabase = databaseMap[filePath]
    if (!fromDatabase) {
      debug(`Not in database: ${filePath}`)
      added.push(fromDisk.relative)
    } else {
      var lastModified = moment(fromDatabase.File.FileModifyDate, EXIF_DATE_FORMAT).valueOf()
      // ExifTool saves FileModifyDate to the nearest second, but some systems provide `mtime` to the millisecond
      // So modification = more than a second difference
      if (Math.abs(lastModified - fromDisk.fileDate) >= 1000) {
        debug(`In database, updated: ${filePath} (from ${fromDatabase.File.FileModifyDate} to ${fromDisk.fileDate})`)
        modified.push(fromDisk.relative)
      } else {
        // debug(`In database, unchanged: ${filePath}`)
        unchanged.push(fromDisk.relative)
      }
    }
  }
  // and which items no longer exist
  // var allKeys = Object.keys(databaseMap)
  var allKeys = Object.assign({}, databaseMap)
  modified.forEach(file => delete allKeys[file])
  unchanged.forEach(file => delete allKeys[file])
  const deleted = Object.keys(allKeys)
  deleted.forEach(file => debug(`Removed from database: ${file}`))
  // return full stats
  return {
    unchanged: unchanged,
    added: added,
    modified: modified,
    deleted: deleted
  }
}

function union (a, b) {
  return a.concat(b.filter(function (el) {
    return a.indexOf(el) === -1
  }))
}
