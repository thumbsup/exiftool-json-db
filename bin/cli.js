#!/usr/bin/env node
const ProgressBar = require('progress')
const yargs = require('yargs')
const database = require('../lib/database')

var argv = yargs
    .usage('Usage: $0 [options]')
    .option('media', {
      alias: 'm',
      describe: 'root folder with photos and videos',
      demand: true
    })
    .option('database', {
      alias: 'd',
      describe: 'path to the JSON database file',
      demand: true
    })
    .argv

const format = '[:bar] :current/:total files (:etas)'
var bar = null

const emitter = database.create({
  media: argv.media,
  database: argv.database
})

emitter.on('stats', (stats) => {
  console.log(`Updating database with ${stats.total} files`)
  console.log(` - ${stats.unchanged} unchanged`)
  console.log(` - ${stats.added} added`)
  console.log(` - ${stats.modified} modified`)
  console.log(` - ${stats.deleted} deleted`)
  console.log('')
  const toProcess = stats.added + stats.modified
  if (toProcess > 0) {
    bar = new ProgressBar(format, { total: toProcess, width: 20 })
  }
})

emitter.on('file', (file) => {
  if (!process.env['DEBUG']) {
    bar.tick()
  }
})

emitter.on('done', (files) => {
  console.log(`\nFinished updating (${files.length} total)`)
})

emitter.on('error', (err) => {
  console.log(`Unexpected error`, err)
})
