const fs = require('fs')
const moment = require('moment')
const path = require('path')
const readdir = require('fs-readdir-recursive')
const should = require('should/as-function')
const files = require('../lib/files')

describe('files', function () {
  const mediaPath = path.join(__dirname, '..', 'fixtures', 'collection')
  const allPhotos = readdir(mediaPath)
  const beachPath = path.join(mediaPath, 'holidays', 'beach.jpg')

  it('emits all media files from the target folder', function (done) {
    const emitter = files.read(mediaPath, [])
    emitter.on('done', function (files) {
      should(files.length).eql(4)
      should(files.map(f => f.SourceFile)).eqlItems(allPhotos)
      done()
    })
  })

  it('emits all files, passed existing data about one of them', function (done) {
    const beachTime = fs.statSync(beachPath).mtime.getTime()
    const existing = [{
      SourceFile: beachPath,
      File: {
        FileModifyDate: moment(beachTime).local().format()
      }
    }]
    const emitter = files.read(mediaPath, existing)
    emitter.on('done', function (files) {
      should(files.length).eql(4)
      should(files.map(f => f.SourceFile)).eqlItems(allPhotos)
      done()
    })
  })

  it('emits all files, ignoring data about deleted files', function (done) {
    const existing = [{
      SourceFile: 'does-not-exist-anymore.jpg',
      File: {
        FileModifyDate: 1487140804000
      }
    }]
    const emitter = files.read(mediaPath, existing)
    emitter.on('done', function (files) {
      should(files.length).eql(4)
      should(files.map(f => f.SourceFile)).eqlItems(allPhotos)
      done()
    })
  })

  it('emits an event for every file processed', function (done) {
    var processed = []
    const emitter = files.read(mediaPath, [])
    emitter.on('file', (f) => processed.push(f.path))
    emitter.on('done', function (files) {
      should(processed.length).eql(4)
      should(processed).eqlItems(allPhotos)
      done()
    })
  })

  describe('stats', function () {
    it('counts files that are not yet in the database', function (done) {
      const emitter = files.read(mediaPath, [])
      emitter.on('stats', stats => {
        should(stats).eql({
          unchanged: 0,
          added: 4,
          modified: 0,
          deleted: 0,
          total: 4
        })
        done()
      })
    })

    it('counts files from the database that are no longer needed', function (done) {
      const database = [{
        'SourceFile': 'deleted.jpg',
        'File': {
          'FileModifyDate': '2017:01:12 17:42:37+00:00'
        }
      }]
      const emitter = files.read(mediaPath, database)
      emitter.on('stats', stats => {
        should(stats).eql({
          unchanged: 0,
          added: 4,
          modified: 0,
          deleted: 1,
          total: 4
        })
        done()
      })
    })

    it('counts files that are still the same as the database', function (done) {
      const beachTime = fs.statSync(beachPath).mtime.getTime()
      const database = [{
        'SourceFile': 'holidays/beach.jpg',
        'File': {
          'FileModifyDate': moment(beachTime).format('YYYY:MM:DD HH:mm:ssZ')
        }
      }]
      const emitter = files.read(mediaPath, database)
      emitter.on('stats', stats => {
        should(stats).eql({
          unchanged: 1,
          added: 3,
          modified: 0,
          deleted: 0,
          total: 4
        })
        done()
      })
    })

    it('counts files that have changed since the last database update', function (done) {
      const beachTime = fs.statSync(beachPath).mtime.getTime()
      const database = [{
        'SourceFile': 'holidays/beach.jpg',
        'File': {
          'FileModifyDate': moment(beachTime + 2000).format('YYYY:MM:DD HH:mm:ssZ')
        }
      }]
      const emitter = files.read(mediaPath, database)
      emitter.on('stats', stats => {
        should(stats).eql({
          unchanged: 0,
          added: 3,
          modified: 1,
          deleted: 0,
          total: 4
        })
        done()
      })
    })
  })

  describe('process only when needed', function () {
    it('reads metadata if the file is not in the database', function (done) {
      const emitter = files.read(mediaPath, [])
      const processed = []
      emitter.on('file', file => processed.push(file.path))
      emitter.on('done', function () {
        should(processed).eqlItems(allPhotos)
        done()
      })
    })

    it('does not read metadata if the file is in the database and up to date', function (done) {
      const beachTime = fs.statSync(beachPath).mtime.getTime()
      const existing = [{
        'SourceFile': 'holidays/beach.jpg',
        'File': {
          'FileSize': '449 kB',
          'FileModifyDate': moment(beachTime + 1).format('YYYY:MM:DD HH:mm:ssZ'),
          'MIMEType': 'image/jpeg'
        }
      }]
      const emitter = files.read(mediaPath, existing)
      const processed = []
      emitter.on('file', file => processed.push(file.path))
      emitter.on('done', function () {
        should(processed).not.containEql('holidays/beach.jpg')
        done()
      })
    })

    it('reads metadata if the file is in the database but has been modified since', function (done) {
      // ExifTool saves FileModifyDate to the nearest second, but some systems provide `mtime` to the millisecond
      // So modification = more than a second difference
      const beachTime = fs.statSync(beachPath).mtime.getTime()
      const existing = [{
        'SourceFile': 'holidays/beach.jpg',
        'File': {
          'FileSize': '449 kB',
          'FileModifyDate': moment(beachTime - 2000).format('YYYY:MM:DD HH:mm:ssZ'),
          'MIMEType': 'image/jpeg'
        }
      }]
      const emitter = files.read(mediaPath, existing)
      const processed = []
      emitter.on('file', file => processed.push(file.path))
      emitter.on('done', function () {
        should(processed).containEql('holidays/beach.jpg')
        done()
      })
    })
  })
})

should.Assertion.add('eqlItems', function (other) {
  this.params = { operator: 'to have same items' }
  this.obj.forEach(item => should(other).containEql(item))
  other.forEach(item => should(this.obj).containEql(item))
  should(this.obj.length).equal(other.length)
})
