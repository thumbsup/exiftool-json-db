const childProcess = require('child_process')
const path = require('path')
const should = require('should/as-function')
const sinon = require('sinon')
const exiftool = require('../lib/exiftool')

const NO_PROGRESS = () => {}
const ROOT = path.join(__dirname, '..', 'fixtures')

describe('exiftool', function () {
  beforeEach(function () {
    sinon.spy(childProcess, 'spawn')
  })

  afterEach(function () {
    childProcess.spawn.restore()
  })

  describe('single file', function () {
    it('return basic file info even if it does not support metadata', function (done) {
      const file = path.join('files', 'text.txt')
      exiftool.read(ROOT, [file], NO_PROGRESS, (err, data) => {
        should(err).eql(null)
        should(data).have.length(1)
        should(data[0]['SourceFile']).eql('files/text.txt')
        should(data[0]['File']['FileSize']).eql('10 bytes')
        done()
      })
    })

    it('returns more file info for known formats', function (done) {
      const file = path.join('files', 'animation.gif')
      exiftool.read(ROOT, [file], NO_PROGRESS, (err, data) => {
        should(err).eql(null)
        should(data).have.length(1)
        should(data[0]['File']['MIMEType']).eql('image/gif')
        done()
      })
    })

    it('can read photo metadata', function (done) {
      const file = path.join('files', 'photo.jpg')
      exiftool.read(ROOT, [file], NO_PROGRESS, (err, data) => {
        should(err).eql(null)
        should(data).have.length(1)
        should(data[0]['EXIF']['DateTimeOriginal']).eql('2016:10:25 16:38:54')
        should(data[0]['EXIF']['ImageDescription']).eql('Some description')
        should(data[0]['IPTC']['Caption-Abstract']).eql('Some description')
        should(data[0]['IPTC']['Keywords']).eql(['sunset', 'ocean'])
        done()
      })
    })

    it('can read video metadata', function (done) {
      const file = path.join('files', 'video.mov')
      exiftool.read(ROOT, [file], NO_PROGRESS, (err, data) => {
        should(err).eql(null)
        should(data).have.length(1)
        should(data[0]['QuickTime']['TrackCreateDate']).eql('2016:10:23 07:34:10')
        should(data[0]['QuickTime']['MediaDuration']).eql('1.72 s')
        should(data[0]['Composite']['Rotation']).eql(0)
        done()
      })
    })

    it('returns an empty array if the image does not exist', function (done) {
      const file = path.join('files', 'does-not-exist.jpg')
      exiftool.read(ROOT, [file], NO_PROGRESS, (err, data) => {
        should(err).match(/Failed/)
        should(data).eql([])
        done()
      })
    })
  })
  describe('multiple files', function () {
    it('does not call <exiftool> at all if the array is empty', function (done) {
      const files = []
      exiftool.read(ROOT, files, NO_PROGRESS, (err, data) => {
        should(err).eql(null)
        should(data).eql([])
        should(childProcess.spawn.called).eql(false)
        done()
      })
    })
    it('returns metadata about a list of files at once', function (done) {
      const files = [
        path.join('files', 'animation.gif'),
        path.join('files', 'photo.jpg'),
        path.join('files', 'video.mov')
      ]
      exiftool.read(ROOT, files, NO_PROGRESS, (err, data) => {
        should(err).eql(null)
        should(data.length).eql(3)
        should(data[0]['SourceFile']).eql(files[0])
        should(data[1]['SourceFile']).eql(files[1])
        should(data[2]['SourceFile']).eql(files[2])
        done()
      })
    })
    it('ignores files that do not exist / are not accesible', function (done) {
      const files = [
        path.join('files', 'photo.jpg'),
        path.join('files', 'does-not-exist.jpg')
      ]
      exiftool.read(ROOT, files, NO_PROGRESS, (err, data) => {
        should(err).eql(null)
        should(data.length).eql(1)
        should(data[0]['SourceFile']).eql(files[0])
        done()
      })
    })
    it('reports progress with a separate callback', function (done) {
      const files = [
        path.join('files', 'animation.gif'),
        path.join('files', 'photo.jpg'),
        path.join('files', 'video.mov')
      ]
      const progress = []
      function progressCallback (file) {
        progress.push(`${file.index}/${file.total}: ${file.path}`)
      }
      exiftool.read(ROOT, files, progressCallback, (err, data) => {
        should(err).eql(null)
        should(progress).eql([
          '1/3: ' + files[0],
          '2/3: ' + files[1],
          '3/3: ' + files[2]
        ])
        done()
      })
    })
  })
})
