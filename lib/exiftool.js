const childProcess = require('child_process')
const debug = require('debug')('exiftool')
const MemoryStream = require('memory-stream')

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

  debug(`$ exiftool ${args.join(' ')}`)
  const child = childProcess.spawn('exiftool', args, {
    cwd: root,
    stdio: [ 'pipe', 'pipe', 'pipe' ]
  })

  const output = new MemoryStream()
  child.stdout.pipe(output)

  child.stderr.on('data', (data) => {
    debug(`exiftool output: ${data.toString()}`)
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
    callback(err)
  })

  child.on('exit', (code, signal) => {
    debug(`exiftool exited with code ${code}`)
    const data = output.toString()
    var obj = []
    try {
      obj = JSON.parse(data)
    } catch (ex) {
    }
    callback(null, obj)
  })

  const allFiles = files.join('\n')
  child.stdin.write(allFiles + '\n')
  child.stdin.end()
}
