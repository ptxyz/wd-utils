const yargs = require('yargs')

const core = require('../../lib')

async function main (argv) {
  // get the connection
  const conn = await core.connection.initConnection(argv.connection)
  // remove a single document from a single query's examples
  return await core.wds.deleteDocument(conn, { documentId: argv.document_id })
}

function getArgs () {
  return yargs
    .option('document_id', {
      alias: 'd',
      describe: 'document id to remove from all training examples'
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
    .demandOption(['document_id', 'connection'], 'Requires a document id and WDS connection')
    .argv
}

module.exports = () => { core.execution.execute(main, getArgs()) }
