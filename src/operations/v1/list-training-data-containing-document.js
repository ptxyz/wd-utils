const yargs = require('yargs')
const util = require('util')
const core = require('../../lib')

async function main (argv) {
  // get connection
  const conn = await core.connection.initConnection(argv.connection)
  // retrieve training data
  const td = (await core.wds.getTrainingData(conn)).data[0]

  // identify queries that are affected
  const qs = core.helpers.getMatchingQueriesAndExamples(td, argv.document_id, argv.include_segments)

  // inspect the matches
  console.log(util.inspect(qs, { depth: 8, maxArrayLength: Infinity, colors: true }))

  // calculate unique queries and examples affected
  const uniqueQueries = qs.map(v => v.query.query_id).filter(core.helpers.onlyUnique)

  console.log('')
  console.log(`training queries containing document: ${uniqueQueries.length}`)
  console.log(`matched examples in training data: ${qs.length}`)

  // TODO: merge multiple matches on same query into 1 single entry

  if (argv.report && !process.env.DRY_RUN) {
    await core.helpers.writeObjectToFile({ matchingExamples: qs }, argv.report)
    console.log(`affected queries written to ${argv.report}`)
  }

  return new core.classes.Result(1, 0, 0, [qs])
}

function getArgs () {
  return yargs
    .option('document_id', {
      alias: 'd',
      describe: 'document id to find in training examples'
    })
    .option('connection', {
      alias: 'c',
      describe: 'WDS connection info JSON'
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
    .demandOption(['document_id', 'connection'], 'Requires a document id and WDS connection')
    .argv
}

module.exports = () => { core.execution.execute(main, getArgs()) }
