const yargs = require('yargs')

const core = require('../../lib')

async function main (argv) {
  // get the connection
  const conn = await core.connection.initConnection(argv.connection)

  // retrieve the original query
  const query = await core.wds.getTrainingDataQuery(conn, { queryId: argv.query_id })

  // find the matching documents
  // this is important because sometimes a single query can reference the document in multiple examples
  // if the document has been split
  // the include_segments flag will match on all child documents when true, otherwise it is an exact id match only
  const qs = core.helpers.getMatchingQueriesAndExamples({ queries: query.data }, argv.document_id, argv.include_segments)

  const results = []
  // iterate over the matches and delete them one by one
  for (const i of qs) {
    const options = {
      documentId: i.documentId,
      queryId: i.query.query_id
    }
    try {
      results.push(await core.wds.deleteDocumentFromQuery(conn, options))
    } catch (e) {
      results.push(new core.classes.Result(0, 1, 0, []))
    }
  }

  return core.classes.Result.reduceResultSet(results)
}

function getArgs () {
  return yargs
    .option('document_id', {
      alias: 'd',
      describe: 'document id to remove from all training examples'
    })
    .option('query_id', {
      alias: 'q',
      describe: 'targeted query id'
    })
    .option('dry_run', {
      alias: 'z',
      describe: 'dry run of operation',
      type: 'boolean',
      default: false
    })
    .option('include_segments', {
      alias: 's',
      describe: 'include document and any associated segments',
      type: 'boolean',
      default: true
    })
    .option('connection', {
      alias: 'c',
      describe: 'WDS connection info JSON'
    })
    .demandOption(['document_id', 'query_id', 'connection'], 'Requires a document id and WDS connection')
    .argv
}

module.exports = () => { core.execution.execute(main, getArgs()) }
