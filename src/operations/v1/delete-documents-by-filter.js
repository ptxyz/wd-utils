const yargs = require('yargs')
const as = require('async')

const core = require('../../lib')

async function main (argv) {
  // get the connection
  const conn = await core.connection.initConnection(argv.connection)

  // guarantee that the user has specified an empty directory
  // or that the directory does not currently exist
  if (!process.env.DRY_RUN) {
    core.helpers.guaranteeEmptyDir(argv.documents_path)
  }

  let expected

  try {
    // get expected affected documents
    expected = (await core.wds.getDocumentCount(conn, { filter: argv.filter })).data[0]
  } catch (e) {
    console.error(e.message)
    throw new Error('failed to retrieve document count during backup')
  }
  const ids = []

  try {
    // iterate over all documents
    // execute up to parallel_limit async operations simulataneously
    // iteration will return documents in chunks, as specified
    await as.mapLimit(core.wds.iterateDocuments(conn, { filter: argv.filter, chunkSize: argv.chunk_size }), argv.parallel_limit, async (f) => {
      const r = await f()
      // first, the documents should be backed up
      for (const d of r.data[0].results) {
        const id = core.helpers.getDocumentId(d)
        if (!id) throw new Error('document missing id field')
        delete d.result_metadata
        if (!process.env.DRY_RUN) {
          await core.helpers.writeObjectToFile(d, argv.documents_path + '/' + id + '.json')
        } else {
          core.helpers.logDryRunOperation('Write File', argv.documents_path + '/' + id + '.json')
        }
        // ids of affected documents are tracked
        ids.push(id)
      }
    })
  } catch (e) {
    console.error(e.message)
    console.error('batch failed, aborting')
  }

  let successes = 0

  try {
    // iterate over the list of affected ids
    // execute up to parallel_limit async operations simulataneously
    await as.mapLimit(ids, argv.parallel_limit, async (id) => {
      // simply delete the document by id from the collection
      const r = await core.wds.deleteDocument(conn, { documentId: id })
      successes += r.successes
    })
  } catch (e) {

  }

  return new core.classes.Result(successes, expected - successes, 0, ids)
}

function getArgs () {
  return yargs
    .option('filter', {
      alias: 'f',
      describe: 'filter to apply before deleting documents. No input will affect every document',
      default: ''
    })
    .option('documents_path', {
      alias: 'd',
      describe: 'backup deleted documents to this directory'
    })
    .option('dry_run', {
      alias: 'z',
      describe: 'dry run of operation',
      type: 'boolean',
      default: false
    })
    .option('connection', {
      alias: 'c',
      describe: 'WDS connection info JSON'
    })
    .option('chunk_size', {
      describe: 'Optionally, specify a specific batch size for document retrieval',
      default: 100
    })
    .option('parallel_limit', {
      alias: 'p',
      describe: 'parallel operations (default 15)',
      default: 15
    })
    .demandOption(['connection', 'documents_path'], 'Requires a document path and WDS connection')
    .argv
}

module.exports = () => { core.execution.execute(main, getArgs()) }
