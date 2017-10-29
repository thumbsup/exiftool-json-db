const childProcess = require('child_process')
const debug = require('debug')('exiftool-json-db')
const fs = require('fs')
const tmp = require('tmp')

exports.read = function (root, files, progress, callback) {
  if (files.length === 0) {
    return callback(null, [])
  }

  debug(`Calling exiftool with ${files.length} files`)

  const args = [
    '-a', // include duplicate tags
    '-s', // use tag ID, not display name
    '-g', // include group names, as nested structures
    '-c', // specify format for GPS lat/long
    '%+.6f', // lat/long = float values
    '-struct', // preserve XMP structure
    '-json', // JSON output
    '-progress', // print progress on stderr
    '-@', // specify more arguments separately
    '-' // read arguments from standard in
  ]

  const tempPath = tmp.tmpNameSync({postfix: '.json'})
  debug(`Saving exiftool output to ${tempPath}`)
  const fileStream = fs.createWriteStream(tempPath)

  fileStream.on('open', () => {
    debug(`$ exiftool ${args.join(' ')}`)
    const child = childProcess.spawn('exiftool', args, {
      cwd: root,
      stdio: [ 'pipe', fileStream, 'pipe' ]
    })

    child.stderr.on('data', (data) => {
      debug(`Exiftool output: ${data.toString()}`)
      data.toString().split('\n').forEach(line => {
        const progressRegex = /^=+\s(.+)\s\[(\d+)\/(\d+)]\s*$/
        const match = progressRegex.exec(line)
        if (match) {
          progress({
            path: match[1],
            index: match[2],
            total: match[3]
          })
        }
      })
    })

    child.on('error', (err) => {
      debug(`Error: please verify that <exiftool> is installed on your system`)
      debug(err.toString())
      callback(err, [])
    })

    child.on('close', (code, signal) => {
      debug(`Exiftool exited with code ${code}`)
      fileStream.end()
    })

    const allFiles = files.join('\n')
    child.stdin.write(allFiles + '\n')
    child.stdin.end()
  })

  fileStream.on('close', () => {
    const data = fs.readFileSync(tempPath, 'utf-8')
    debug('Temp file closed')
    var obj = []
    try {
      obj = JSON.parse(data)
      debug(`Temp file contains ${obj.length} entries`)
    } catch (ex) {
      debug('Temp file contains invalid JSON')
    }
    fs.unlinkSync(tempPath)
    callback(null, obj)
  })
}
