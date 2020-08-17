const yargs = require('yargs')
const util = require('util')
const core = require('../../lib')

async function main (argv) {
  // get connection
  const conn = await core.connection.initConnection(argv.connection)

  let expected // expected number of documents

  try {
    expected = (await core.wds.getDocumentCount(conn, { filter: argv.filter })).data[0]
  } catch (e) {
    throw new Error('failed to retrieve document count during backup')
  }

  let mapping

  try {
    // generate mapped relationship
    mapping = (await core.wds.getDocumentIdFieldMap(conn, {
      mappedFields: argv.mapped_fields,
      parallelLimit: argv.parallel_limit,
      chunkSize: argv.chunk_size,
      filter: argv.filter,
      idField: argv.id_field
    })).data[0]
  } catch (e) {
    throw new Error('unable to generate id field mapping')
  }

  if (!argv.out) {
    console.log(util.inspect(mapping, { depth: 8, maxArrayLength: Infinity, colors: true }))
  }

  // write training data (unless dry run)
  if (!process.env.DRY_RUN) {
    if (argv.out) {
      await core.helpers.writeObjectToFile(mapping, argv.out)
    }
  }

  const successes = Object.keys(mapping).length
  return new core.classes.Result(successes, 0, expected - successes, [mapping])
}

function getArgs () {
  return yargs
    .option('connection', {
      alias: 'c',
      describe: 'WDS connection info JSON'
    })
    .option('out', {
      alias: 'o',
      describe: 'write training data to this file'
    })
    .option('mapped_fields', {
      alias: 'm',
      describe: 'document fields to map id to, comma separated',
      default: 'title'
    })
    .option('filter', {
      alias: 'f',
      describe: 'Optionally apply a filter',
      default: ''
    })
    .option('parallel_limit', {
      alias: 'p',
      describe: 'parallel operations (default 15)',
      default: 15
    })
    .option('id_field', {
      alias: 'i',
      describe: 'field to use as id. Defaults to empty string, which will use id or document_id',
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
    .demandOption(['connection'], 'Requires a WDS connection')
    .argv
}

module.exports = () => { core.execution.execute(main, getArgs()) }
