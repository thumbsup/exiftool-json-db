const childProcess = require('child_process')
const MemoryStream = require('memory-stream')

exports.read = function (root, files, progress, callback) {
  if (files.length === 0) {
    return callback(null, [])
  }

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

  const child = childProcess.spawn('exiftool', args, {
    cwd: root,
    stdio: [ 'pipe', 'pipe', 'pipe' ]
  })

  const output = new MemoryStream()
  child.stdout.pipe(output)

  child.stderr.on('data', (data) => {
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
    console.log('ERROR', err)
  })

  child.on('exit', (code, signal) => {
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
