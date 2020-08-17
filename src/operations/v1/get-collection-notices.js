const yargs = require('yargs')
const util = require('util')

const core = require('../../lib')

async function main (argv) {
  // get connection
  const conn = await core.connection.initConnection(argv.connection)
  // retrieve training data
  const res = await core.wds.getNotices(conn, {
    filter: argv.filter
  })

  if (!argv.out) {
    console.log(util.inspect(res.data[0], { depth: 8, maxArrayLength: Infinity, colors: true }))
  }

  // write training data (unless dry run)
  if (!process.env.DRY_RUN) {
    if (argv.out) {
      await core.helpers.writeObjectToFile(res.data[0], argv.out)
    }
  }
  return res
}

function getArgs () {
  return yargs
    .option('connection', {
      alias: 'c',
      describe: 'WDS connection info JSON'
    })
    .option('out', {
      alias: 'o',
      describe: 'write notices to this file'
    })
    .option('filter', {
      alias: 'f',
      describe: 'apply a filter to query',
      filter: ''
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
