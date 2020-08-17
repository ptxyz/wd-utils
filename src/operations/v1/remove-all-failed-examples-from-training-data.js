const yargs = require('yargs')
const as = require('async')

const core = require('../../lib')

async function main (argv) {
  // get the connection
  const conn = await core.connection.initConnection(argv.connection)

  // retrieve training data
  const td = (await core.wds.getTrainingData(conn)).data[0]
  // write training data (unless dry run)
  if (!process.env.DRY_RUN) {
    await core.helpers.writeObjectToFile(td, argv.out)
  }

  // get all notices
  const notices = (await core.wds.getNotices(conn, {
    filter: 'notices.notice_id::missing_document_id'
  })).data[0]

  const qs = []

  // reduce the data returned in notice array to query data
  for (const i of notices) {
    for (const n of i.notices) {
      qs.push({ documentId: n.document_id, queryId: n.query_id })
    }
  }

  const results = []
  try {
    // iterate over notice query data
    // execute parallel limit async operations in parallel
    await as.mapLimit(qs, argv.parallel_limit, async (q) => {
      try {
        // delete the affected documents
        results.push(await core.wds.deleteDocumentFromQuery(conn, q))
      } catch (e) {
        results.push(new core.classes.Result(0, 1, 0, []))
      }
    })
  } catch (e) {
    throw Error('an error occurred while removing failed examples')
  }

  return core.classes.Result.reduceResultSet(results)
}

function getArgs () {
  return yargs
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
    .option('dry_run', {
      alias: 'z',
      describe: 'dry run of operation',
      type: 'boolean',
      default: false
    })
    .demandOption(['out', 'connection'], 'Requires a backup path and WDS connection')
    .argv
}

module.exports = () => { core.execution.execute(main, getArgs()) }
