const yargs = require('yargs')

const core = require('../../lib')

async function main (argv) {
  // get connection
  const conn = await core.connection.initConnection(argv.connection)

  // upsert documents
  return await core.wds.upsertDocument(conn, { path: argv.file, id: argv.id, metadata: argv.metadata ? JSON.parse(argv.metadata) : {} })
}

function getArgs () {
  return yargs
    .option('file', {
      alias: 'f',
      describe: 'document to upload'
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
    .option('id', {
      alias: 'i',
      describe: 'id to use for document'
    })
    .option('metadata', {
      alias: 'm',
      describe: 'optional metadata'
    })
    .option('dry_run', {
      alias: 'z',
      describe: 'dry run of operation',
      type: 'boolean',
      default: false
    })
    .demandOption(['file', 'connection'], 'Requires document and WDS connection')
    .argv
}

module.exports = () => { core.execution.execute(main, getArgs()) }
