const fs = require('fs')
const path = require('path')
const readdir = require('fs-readdir-recursive')
const should = require('should/as-function')
const tmp = require('tmp')
const database = require('../lib/database')

describe('database', function () {
  const mediaPath = path.join(__dirname, '..', 'fixtures', 'collection')
  const allPhotos = readdir(mediaPath)

  it('can create an in-memory-only database', function (done) {
    const emitter = database.create({media: mediaPath})
    emitter.on('done', function (files) {
      should(files.length).eql(4)
      should(files.map(f => f.SourceFile)).eql(allPhotos)
      done()
    })
  })

  describe('saving and loading', function () {
    const databasePath = tmp.tmpNameSync()

    it('can create a database from scratch and save it to disk', function (done) {
      const emitter = database.create({media: mediaPath, database: databasePath})
      emitter.on('done', function (files) {
        should(files.length).eql(4)
        should(files.map(f => f.SourceFile)).eql(allPhotos)
        done()
      })
    })

    it('can update an existing database', function (done) {
      // note: this re-uses the same database file as the previous test
      const emitter = database.create({media: mediaPath, database: databasePath})
      emitter.on('done', function (files) {
        should(files.length).eql(4)
        should(files.map(f => f.SourceFile)).eqlItems(allPhotos)
        done()
      })
    })
  })

  describe('format errors', function () {
    const invalidDB = tmp.fileSync().name
    it('throws an exception if the database is not JSON', function (done) {
      fs.writeFileSync(invalidDB, 'random data')
      should(() => {
        database.create({media: mediaPath, database: invalidDB})
      }).throw(/SyntaxError/i)
      done()
    })

    it('throws an exception if the database is not an array', function (done) {
      fs.writeFileSync(invalidDB, '{"invalid": "format"}')
      should(() => {
        database.create({media: mediaPath, database: invalidDB})
      }).throw(/not an array/i)
      done()
    })

    it('throws an exception if the database does not look like an <exiftool> output', function (done) {
      fs.writeFileSync(invalidDB, '[{"some": "data"}]')
      should(() => {
        database.create({media: mediaPath, database: invalidDB})
      }).throw(/exiftool format/i)
      done()
    })
  })
})

should.Assertion.add('eqlItems', function (other) {
  this.params = { operator: 'to have same items' }
  this.obj.forEach(item => should(other).containEql(item))
  other.forEach(item => should(this.obj).containEql(item))
  should(this.obj.length).equal(other.length)
})
