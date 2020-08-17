const yargs = require('yargs')
const objectPath = require('object-path')
const glob = require('glob')
const as = require('async')
const path = require('path')

const core = require('../../lib')

async function main (argv) {
  // get connection
  const conn = await core.connection.initConnection(argv.connection)

  let mapping = {}

  // load a mapping file, if specified
  if (argv.mapping_file) {
    mapping = core.helpers.loadJSONFile(argv.mapping_file)
  }

  // collect the contents of this directory
  const fns = glob.sync(argv.documents_path + '/*', {})
  const results = []
  // iterate over the contents of the directory
  // execute parallel_limit async operations simultaneously
  await as.mapLimit(fns, argv.parallel_limit, async (fn) => {
    // start with minimum information
    const params = { path: fn }
    // try to find matching mapping information, populate id and metadata if found
    if (objectPath.has(mapping, [path.basename(fn)])) {
      const m = objectPath.get(mapping, [path.basename(fn)])
      if (m.length > 0) {
        if (m[0].id) params.id = m[0].id
        if (m[0].metadata) params.metadata = m[0].metadata
      }
    }
    // then perform the upsert
    results.push(await core.wds.upsertDocument(conn, params))
  })
  return core.classes.Result.reduceResultSet(results)
}

function getArgs () {
  return yargs
    .option('documents_path', {
      alias: 'd',
      describe: 'directory containing JSON documents'
    })
    .option('connection', {
      alias: 'c',
      describe: 'WDS connection info JSON'
    })
    .option('parallel_limit', {
      alias: 'p',
      describe: 'parallel operations (default 15)',
      default: 15
    })
    .option('mapping_file', {
      alias: 'm',
      describe: 'optionally load a mapping file generated with "backup-file-metadata"'
    })
    .option('dry_run', {
      alias: 'z',
      describe: 'dry run of operation',
      type: 'boolean',
      default: false
    })
    .demandOption(['documents_path', 'connection'], 'Requires documents directory and WDS connection')
    .argv
}

module.exports = () => { core.execution.execute(main, getArgs()) }
