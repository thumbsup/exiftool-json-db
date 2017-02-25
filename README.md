# exiftool-json-db

> Maintain a JSON collection of photos and videos with their metadata

This is one of the core modules of [thumbsup.github.io](https://thumbsup.github.io).

[![NPM](http://img.shields.io/npm/v/exiftool-json-db.svg?style=flat-square)](https://npmjs.org/package/exiftool-json-db)
[![License](http://img.shields.io/npm/l/exiftool-json-db.svg?style=flat-square)](https://github.com/thumbsup/exiftool-json-db)
[![Build Status](http://img.shields.io/travis/thumbsup/exiftool-json-db.svg?style=flat-square)](http://travis-ci.org/thumbsup/exiftool-json-db)
[![Dependencies](http://img.shields.io/david/thumbsup/exiftool-json-db.svg?style=flat-square)](https://david-dm.org/thumbsup/exiftool-json-db)
[![Dev dependencies](http://img.shields.io/david/dev/thumbsup/exiftool-json-db.svg?style=flat-square)](https://david-dm.org/thumbsup/exiftool-json-db)

## Purpose

This package helps maintain a `JSON` database of photo & video files, including all their metadata. The result is the same as running [exiftool](http://www.sno.phy.queensu.ca/~phil/exiftool/) on an entire folder, except that results are cached and only updated when files are added/changed/deleted.

This means you can update the database within a few seconds when adding 20 photos to a collection of 10,000 - and then load that full collection in memory for processing (including captions, timestamps, GPS data...) in just a few milliseconds. See below for examples of useful queries to run.

## Requirements

This package requires `exiftool` from http://www.sno.phy.queensu.ca/~phil/exiftool/ (version 9.70 or above).

## Quick start

```bash
npm install -g exiftool-json-db
```

On the command line:

```bash
exiftool-json-db --media '/Photos/Holidays' --database '/Documents/holidays.json'
```

Or programmatically:

```js
const database = require('exiftool-json-db')
const emitter = database.create({
  media: '/Photos/Holidays',
  database: '/Documents/holidays.json'
})
emitter.on('done', => console.log('Updated!'))
```

This will create or update `/Documents/holidays.json` which uses the following format:

```js
[{
  "SourceFile": "NewYork/IMG_5364.jpg",
  "File": {
    "FileSize": "449 kB",
    "MIMEType": "image/jpeg",
    /* ... */
  },
  "EXIF": {
    "Orientation": "Horizontal (normal)",
    "DateTimeOriginal": "2017:01:07 13:59:56",
    /* ... */
  },
  "Composite": {
    "GPSLatitude": "+51.5285578",
    "GPSLongitude": -0.2420248,
    /* ... */
  }
}]
```

Some notes on the structure:
- the format is identical to the raw `exiftool` output
  * it doesn't try to parse date strings, and doesn't assume timezones when absent
  * doesn't fix GPS format oddities, like `-10.000` (number) and `"+10.000"` (string)
  * doesn't merge similar fields together, like `EXIF:ImageDescription` and `IPTC:Caption-Abstract`
- all `SourceFile` paths are relative to the input folder. This means the database stays valid when processing photos from a removable drive, or a drive whose mount point changes over time
- the name of the groups and tags are exactly as documented at  http://www.sno.phy.queensu.ca/~phil/exiftool/TagNames/index.html

## Examples of useful queries

Once you have run `exiftool-json-db` to update your database, you can run useful queries on the JSON data.
[Node.js](https://nodejs.org/en/) or [jQ](https://stedolan.github.io/jq/) are easy choices to process JSON.

- Find all camera models used

```bash
jq '[.[].EXIF.Model] | unique' holidays.json
```

- Group photos by aperture value

```bash
jq 'group_by(.Composite.Aperture) | map({Aperture: .[0].Composite.Aperture, Files: map(.SourceFile)})' holidays.json
```

- Find all "group" photos (where the camera identified more than 5 faces)

```bash
jq '.[] | select([.XMP.RegionInfo.RegionList[]? | select(.Type == "Face")] | select(length > 5)) | .SourceFile' holidays.json
```

- Find all photos within 10km of London

```js
const geodist = require('geodist')
const db = require('./holidays.json')

const LONDON = {lat: 51.5285578, long: -0.2420248}

db.forEach(file => {
  const coords = {
    lat: parseFloat(file.Composite.GPSLatitude),
    long: parseFloat(file.Composite.GPSLongitude)
  }
  const distance = geodist(coords, LONDON, {unit: 'km'})
  if (distance < 10) {
    console.log(`${file.SourceFile} ${distance}km`)
  }
})
```

## Programatic usage

### create()

```js
collection.create({
  // path to the folder containing all photos and videos
  media: '/Photos/Holidays',
  // path where to save the database file
  database: '/Documents/holidays.json'
})
```

### events

`create()` returns an event emitter that emits the following:

```js
// basic stats about the collection, before any processing is done
.on('stats', (stats) => console.log(`Updating database with ${stats.total} files`))

// before a file is processed (index is 1 based, e.g. 1/3)
.on('file', (file) => console.log(`Processing ${file.path} (${file.index}/${file.total})`))

// unexpected error, cannot recover
.on('error', (err) => console.log(`Unexpected error`, err))

// finished, passing the collection as an argument
.on('done', (files) => console.log(`Updated collection of ${files.length} files`))
```

In case you need to process the list of files straight away, you don't need to re-load `holidays.json` from disk.
The `done` event includes the whole updated array as an argument.
