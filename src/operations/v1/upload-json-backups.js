const yargs = require('yargs')
const objectPath = require('object-path')
const glob = require('glob')
const as = require('async')

const core = require('../../lib')

async function main (argv) {
  // get connection
  const conn = await core.connection.initConnection(argv.connection)

  // identify the contents of the directory
  const fns = glob.sync(argv.documents_path + '/*.json', {})
  const results = []
  // iterate over the contents of the directory
  // execute parallel_limit async operations simultaneously
  await as.mapLimit(fns, argv.parallel_limit, async (fn) => {
    // load the document and upsert it
    const d = core.helpers.loadJSONFile(fn)
    const id = objectPath.get(d, argv.id_field)
    results.push(await core.wds.upsertJSONBackupDocument(conn, {
      document: d,
      id: id
    }))
  })

  console.log('')
  console.log('*** please note that these files were uploaded as JSON documents. the original documents were not uploaded. ***')
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
    .option('id_field', {
      alias: 'i',
      describe: 'id field in JSON document',
      default: 'id'
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
