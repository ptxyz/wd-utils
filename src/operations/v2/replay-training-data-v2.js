const yargs = require('yargs')
const as = require('async')

const core = require('../../lib')

async function main (argv) {
  // get connection
  const conn = await core.connection.initConnection(argv.connection)
  // load training data
  const td = core.helpers.loadJSONFile(argv.training)

  const results = []
  try {
    await as.mapLimit(td.queries, argv.parallel_limit, async (q) => {
      try {
        results.push(await core.wds_v2.createTrainingQueryV2(conn, q))
      } catch (e) {
        results.push(new core.classes.Result(0, 1, 0, []))
      }
    })
  } catch (e) {
    console.error(e)
    throw Error('an error occurred while replaying training data')
  }

  return core.classes.Result.reduceResultSet(results)
}

function getArgs () {
  return yargs
    .option('training', {
      alias: 't',
      describe: 'WDS training data to replay'
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
    .option('dry_run', {
      alias: 'z',
      describe: 'dry run of operation',
      type: 'boolean',
      default: false
    })
    .demandOption(['training', 'connection'], 'Requires an training data file and WDS connection')
    .argv
}

module.exports = () => { core.execution.execute(main, getArgs()) }
