const yargs = require('yargs')
const as = require('async')

const core = require('../../lib')

async function main (argv) {
  // get connection
  const conn = (await core.connection.initConnection(argv.connection))

  // guarantee that the user has specified an empty directory
  // or that the directory does not currently exist
  if (!process.env.DRY_RUN) {
    core.helpers.guaranteeEmptyDir(argv.documents_path)
  }

  // expected number of documents to write
  let expected

  try {
    expected = (await core.wds.getDocumentCount(conn, { filter: argv.filter })).data[0]
  } catch (e) {
    throw new Error('failed to retrieve document count during backup')
  }
  const ids = []

  try {
    // iterate over all documents
    // execute up to parallel_limit async operations simulataneously
    // iteration will return documents in chunks, as specified
    await as.mapLimit(core.wds.iterateDocuments(conn, { filter: argv.filter, chunkSize: argv.chunk_size }), argv.parallel_limit, async (f) => {
      const r = await f()
      for (const d of r.data[0].results) {
        const id = core.helpers.getDocumentId(d)
        if (!id) throw new Error('document missing id field')
        delete d.result_metadata

        if (!process.env.DRY_RUN) {
          await core.helpers.writeObjectToFile(d, argv.documents_path + '/' + id + '.json')
        } else {
          core.helpers.logDryRunOperation('Write File', argv.documents_path + '/' + id + '.json')
        }
        // track ids processed
        ids.push(id)
      }
    })
  } catch (e) {
    console.error('batch failed, aborting')
  }

  console.log('')
  console.log('*** please note that this is only a backup of the JSON documents and this is not a backup of the original documents. ***')

  // get final total of ids processed, compare to expected
  const successes = ids.filter(core.helpers.onlyUnique).length
  return new core.classes.Result(successes, expected - successes, 0, ids)
}

function getArgs () {
  return yargs
    .option('documents_path', {
      alias: 'd',
      describe: 'write training data to this directory'
    })
    .option('connection', {
      alias: 'c',
      describe: 'WDS connection info JSON'
    })
    .option('filter', {
      alias: 'f',
      describe: 'Optionally apply a filter',
      default: ''
    })
    .option('chunk_size', {
      describe: 'Optionally, specify a specific batch size for document retrieval',
      default: 100
    })
    .option('dry_run', {
      alias: 'z',
      describe: 'dry run of operation',
      type: 'boolean',
      default: false
    })
    .option('parallel_limit', {
      alias: 'p',
      describe: 'parallel operations (default 15)',
      default: 15
    })
    .demandOption(['documents_path', 'connection'], 'Requires an output file and WDS connection')
    .argv
}

module.exports = () => { core.execution.execute(main, getArgs()) }
