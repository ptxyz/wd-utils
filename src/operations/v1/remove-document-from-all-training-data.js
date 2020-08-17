const yargs = require('yargs')
const as = require('async')

const core = require('../../lib')

async function main (argv) {
  // get connection
  const conn = await core.connection.initConnection(argv.connection)
  // retrieve training data
  const td = (await core.wds.getTrainingData(conn)).data[0]

  // identify the affected queries
  const qs = core.helpers.getMatchingQueriesAndExamples(td, argv.document_id, argv.include_segments)

  const results = []
  try {
    // iterate over the affected queries
    // execute parallel_limit async operations simulataneously
    await as.mapLimit(qs, argv.parallel_limit, async (i) => {
      const options = {
        documentId: i.documentId,
        queryId: i.query.query_id
      }
      try {
        // delete the affected document
        await core.wds.deleteDocumentFromQuery(conn, options)
      } catch (e) {
        results.push(new core.classes.Result(0, 1, 0, []))
      }
      results.push(new core.classes.Result(1, 0, 0, [i]))
    })
  } catch (e) {
    throw new Error('an error occurred while removing document from all training data')
  }

  const ret = core.classes.Result.reduceResultSet(results)

  if (argv.report && !process.env.DRY_RUN) {
    await core.helpers.writeObjectToFile({ removedExamples: ret.data }, argv.report)
    console.log(`affected queries written to ${argv.report}`)
  }

  return ret
}

function getArgs () {
  return yargs
    .option('document_id', {
      alias: 'd',
      describe: 'document id to remove from all training examples'
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
    .option('out', {
      alias: 'o',
      describe: 'write backup training data to this file'
    })
    .option('report', {
      alias: 'r',
      describe: 'write affected training data to this file'
    })
    .option('include_segments', {
      alias: 's',
      describe: 'include document and any associated segments',
      type: 'boolean',
      default: true
    })
    .option('dry_run', {
      alias: 'z',
      describe: 'dry run of operation',
      type: 'boolean',
      default: false
    })
    .demandOption(['document_id', 'connection', 'out'], 'Requires a document id, WDS connection, and backup path')
    .argv
}

module.exports = () => { core.execution.execute(main, getArgs()) }
