const fs = require('fs')
const files = require('./files')

exports.create = function (opts) {
  const db = load(opts.database)
  const emitter = files.read(opts.media, db)
  if (opts.database) {
    emitter.on('done', (files) => save(opts.database, files))
  }
  return emitter
}

function load (outputPath) {
  const content = loadIfExists(outputPath)
  try {
    const files = JSON.parse(content)
    validate(files)
    return files
  } catch (ex) {
    throw new Error('Invalid database file\n' + ex)
  }
}

function save (outputPath, files) {
  const content = JSON.stringify(files, null, '  ')
  fs.writeFileSync(outputPath, content)
}

function loadIfExists (path) {
  try {
    const content = fs.readFileSync(path).toString()
    if (content === '') return '[]'
    return content
  } catch (ex) {
    return '[]'
  }
}

function validate (db) {
  if (Array.isArray(db) === false) {
    throw new Error('Not an array')
  }
  if (db.length > 0 && typeof db[0].SourceFile !== 'string') {
    throw new Error('Unrecognised exiftool format')
  }
}
